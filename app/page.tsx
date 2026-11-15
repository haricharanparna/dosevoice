"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dose, DoseStatus, Med, Settings } from "@/lib/types";
import { dateKey, hhmm, readPref, setSpeechRate, speak, to12h, writePref } from "@/lib/client";
import TodayView, { buildSchedule } from "@/components/TodayView";
import ScanView from "@/components/ScanView";
import MedsView from "@/components/MedsView";
import SettingsView from "@/components/SettingsView";
import { IconBell, IconCamera, IconCheck, IconPill, IconShield, IconSliders, IconToday, Logo } from "@/components/Icons";

const TABS = [
  { id: "today", label: "Today", Icon: IconToday },
  { id: "scan", label: "Scan", Icon: IconCamera },
  { id: "meds", label: "Medications", Icon: IconPill },
  { id: "settings", label: "Settings", Icon: IconSliders },
] as const;
type Tab = (typeof TABS)[number]["id"];
const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

const DEFAULT_SETTINGS: Settings = { size: "normal", theme: "system", contrast: false, rate: 0.95, autoRead: true };

type Toast = { msg: string; action?: { label: string; run: () => void } };
type Reminder = { med: Med; time: string; test?: boolean };

export default function Home() {
  const [tab, setTabState] = useState<Tab>("today");
  const [meds, setMeds] = useState<Med[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [storage, setStorage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [toast, setToast] = useState<Toast | null>(null);
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [notif, setNotif] = useState<NotificationPermission | "unsupported">("default");
  const snoozed = useRef<Map<string, number>>(new Map());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const today = dateKey(now);

  // ── Tabs (synced to the URL hash so the back button and deep links work) ──
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const h = location.hash.slice(1);
    if (isTab(h)) setTabState(h);
    const onHash = () => { const v = location.hash.slice(1); if (isTab(v)) setTabState(v); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // ── Settings ──
  useEffect(() => {
    try {
      const raw = readPref("dv-settings");
      if (raw) setSettingsState({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch { /* ignore bad prefs */ }
    setNotif("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.size = settings.size;
    el.dataset.contrast = settings.contrast ? "high" : "normal";
    if (settings.theme === "system") delete el.dataset.theme;
    else el.dataset.theme = settings.theme;
    setSpeechRate(settings.rate);
  }, [settings]);
  const setSettings = (s: Settings) => { setSettingsState(s); writePref("dv-settings", JSON.stringify(s)); };

  // ── Data ──
  const loadMeds = useCallback(async () => {
    const r = await fetch("/api/meds");
    if (!r.ok) throw new Error(`meds ${r.status}`);
    const j = await r.json();
    setMeds(j.meds ?? []);
    setStorage(j.storage ?? "");
    return (j.meds ?? []) as Med[];
  }, []);
  const loadDoses = useCallback(async (date: string) => {
    const r = await fetch(`/api/doses?date=${date}`);
    if (!r.ok) throw new Error(`doses ${r.status}`);
    const j = await r.json();
    setDoses(j.doses ?? []);
  }, []);
  useEffect(() => {
    Promise.all([loadMeds(), loadDoses(dateKey())])
      .then(([m]) => {
        if (!m.length && !isTab(location.hash.slice(1))) setTabState("scan");
      })
      .catch(() => {
        setTabState("scan");
        setToast({ msg: "Couldn't load your saved medications. You can still scan labels." });
      })
      .finally(() => setLoaded(true));
  }, [loadMeds, loadDoses]);
  useEffect(() => { if (loaded) loadDoses(today).catch(() => {}); }, [today, loaded, loadDoses]);

  // ── Toasts ──
  const showToast = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Dose tracking (optimistic) ──
  const markDose = useCallback(async (med: Med, time: string, status: DoseStatus | null, quiet = false) => {
    const prev = doses;
    setDoses((d) => {
      const rest = d.filter((x) => !(x.medId === med._id && x.time === time));
      return status ? [...rest, { medId: med._id, date: today, time, status }] : rest;
    });
    try {
      const r = await fetch("/api/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medId: med._id, date: today, time, status }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setDoses(prev);
      showToast({ msg: "Couldn't save that. Check your connection." });
      return;
    }
    if (quiet) return;
    if (status === "taken") {
      speak(`${med.drugName} marked as taken.`);
      showToast({ msg: `${med.drugName} marked as taken`, action: { label: "Undo", run: () => markDose(med, time, null, true) } });
    } else if (status === "skipped") {
      showToast({ msg: `${med.drugName} skipped`, action: { label: "Undo", run: () => markDose(med, time, null, true) } });
    }
  }, [doses, today, showToast]);

  // ── Reminder engine ──
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      const t = hhmm(d);
      const day = d.toDateString();
      // Snoozed reminders whose time has come
      for (const [key, at] of snoozed.current) {
        if (Date.now() >= at) {
          snoozed.current.delete(key);
          const [medId, time] = key.split("|");
          const med = meds.find((m) => m._id === medId);
          if (med && !doses.some((x) => x.medId === medId && x.time === time)) fire({ med, time });
        }
      }
      for (const item of buildSchedule(meds, doses, d)) {
        if (item.time !== t || item.status) continue;
        const key = `dv-fired-${item.med._id}-${item.time}`;
        if (readPref(key) === day) continue;
        writePref(key, day);
        fire({ med: item.med, time: item.time });
      }
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [meds, doses]); // eslint-disable-line react-hooks/exhaustive-deps

  function fire(r: Reminder) {
    setReminder(r);
    const msg = `Time to take ${r.med.drugName}, ${r.med.strength}. ${r.med.instructions}`;
    speak(msg);
    void notify(r);
  }

  // Browser notification with "I took it" / "Snooze" buttons. Uses the service worker
  // (required on Android Chrome), falling back to a plain notification on desktop.
  async function notify(r: Reminder) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const title = `${r.test ? "Test: " : ""}Time for ${r.med.drugName}`;
    const body = `${to12h(r.time)} · ${r.med.strength}. ${r.med.instructions}`;
    const tag = `dv-${r.med._id}-${r.time}`;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body, tag, requireInteraction: true, icon: "/icon.svg", badge: "/icon.svg",
          data: { medId: r.med._id, time: r.time, date: dateKey(), test: !!r.test },
          actions: [{ action: "take", title: "I took it" }, { action: "snooze", title: "Snooze 10 min" }],
        } as NotificationOptions);
        return;
      }
    } catch { /* fall through */ }
    try { new Notification(title, { body, tag, requireInteraction: true }); } catch { /* unsupported */ }
  }

  async function closeNotification(r: Reminder) {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      (await reg?.getNotifications({ tag: `dv-${r.med._id}-${r.time}` }))?.forEach((n) => n.close());
    } catch { /* ignore */ }
  }

  // Register the service worker once.
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Buttons pressed on a notification (handled by the service worker) come back here.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const m = e.data || {};
      if (m.type === "dv-dose-taken") {
        setReminder(null);
        if (!m.test) loadDoses(dateKey()).catch(() => {});
        const med = meds.find((x) => x._id === m.medId);
        showToast({ msg: m.test ? "Test reminder: marked as taken" : `${med?.drugName ?? "Dose"} marked as taken` });
      } else if (m.type === "dv-snooze") {
        const med = meds.find((x) => x._id === m.medId);
        if (med) snooze({ med, time: m.time, test: m.test });
        else if (m.test && reminder) snooze(reminder);
      } else if (m.type === "dv-open-reminder") {
        const med = meds.find((x) => x._id === m.medId);
        if (med) setReminder({ med, time: m.time });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // While a reminder is open, flash the tab title so it's noticeable from another tab.
  useEffect(() => {
    if (!reminder) return;
    const base = document.title;
    const alt = `⏰ Time for ${reminder.med.drugName}`;
    let on = false;
    const id = setInterval(() => { on = !on; document.title = on ? alt : base; }, 1000);
    return () => { clearInterval(id); document.title = base; void closeNotification(reminder); };
  }, [reminder]); // eslint-disable-line react-hooks/exhaustive-deps

  function snooze(r: Reminder) {
    if (!r.test) snoozed.current.set(`${r.med._id}|${r.time}`, Date.now() + 10 * 60_000);
    setReminder(null);
    speak("Okay. I'll remind you again in 10 minutes.");
    showToast({ msg: "Snoozed for 10 minutes" });
  }

  useEffect(() => {
    if (!reminder) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") snooze(reminder); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  async function requestNotif() {
    if (!("Notification" in window)) return;
    setNotif(await Notification.requestPermission());
  }

  // ── Med mutations ──
  async function onSaved(med: Med, message: string) {
    await loadMeds();
    speak(message);
    showToast({ msg: message });
    if (notif === "default") requestNotif();
    setTab(med.times.length ? "today" : "meds");
  }
  async function onDelete(med: Med) {
    await fetch(`/api/meds/${med._id}`, { method: "DELETE" });
    await loadMeds();
    setDoses((d) => d.filter((x) => x.medId !== med._id));
    speak(`${med.drugName} removed.`);
    showToast({ msg: `${med.drugName} removed` });
  }
  async function onUpdateTimes(med: Med, times: string[]) {
    await fetch(`/api/meds/${med._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ times }) });
    await loadMeds();
    showToast({ msg: "Reminder times updated" });
  }

  const overdue = buildSchedule(meds, doses, now).filter((s) => s.overdue).length;

  const tabProps = (t: Tab) => ({
    role: "tab" as const,
    "aria-selected": tab === t,
    "aria-controls": "main",
    id: `tab-${t}`,
    onClick: () => setTab(t),
  });

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand"><Logo /> <div>DoseVoice<small>Hear your labels</small></div></div>
        <div role="tablist" aria-orientation="vertical" style={{ display: "grid", gap: 4 }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className="side-tab" {...tabProps(id)}>
              <Icon size={22} /> {label}
              {id === "today" && overdue > 0 && <span className="count" aria-label={`${overdue} overdue`}>{overdue}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <strong><IconShield size={16} /> Not medical advice</strong>
          DoseVoice helps you read and remember. Always confirm with your pharmacist.
        </div>
      </nav>

      <main id="main" ref={mainRef} tabIndex={-1} className="content" role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ outline: "none" }}>
        <div className="topbar">
          <div className="brand"><Logo size={32} /> DoseVoice</div>
        </div>

        {!loaded ? (
          <div className="card card-pad" aria-busy="true" style={{ color: "var(--muted)" }}>Loading…</div>
        ) : tab === "today" ? (
          <TodayView meds={meds} doses={doses} now={now} onMark={markDose} goScan={() => setTab("scan")} />
        ) : tab === "scan" ? (
          <ScanView autoRead={settings.autoRead} onSaved={onSaved} />
        ) : tab === "meds" ? (
          <MedsView meds={meds} onDelete={onDelete} onUpdateTimes={onUpdateTimes} goScan={() => setTab("scan")} />
        ) : (
          <SettingsView settings={settings} setSettings={setSettings} notif={notif} requestNotif={requestNotif} storage={storage}
            testReminder={() => fire({
              test: true, time: hhmm(),
              med: meds[0] ?? { _id: "test", drugName: "Amoxicillin", strength: "500 mg", instructions: "Take 1 capsule with food.", summary: "", warnings: [], times: [] },
            })} />
        )}
      </main>

      <nav className="tabbar" role="tablist" aria-label="Main">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className="tab" {...tabProps(id)} id={`mtab-${id}`}>
            <Icon size={24} />
            {label === "Medications" ? "Meds" : label}
            {id === "today" && overdue > 0 && <span className="badge-dot" aria-label={`${overdue} overdue`}>{overdue}</span>}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          <IconCheck size={18} /> {toast.msg}
          {toast.action && <button onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>}
        </div>
      )}

      {reminder && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && snooze(reminder)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="rem-h" aria-describedby="rem-d">
            <div className="ring-icon"><IconBell size={30} /></div>
            <p className="eyebrow">{to12h(reminder.time)}{reminder.test ? " · Test" : ""}</p>
            <h2 id="rem-h">Time for {reminder.med.drugName}</h2>
            <p id="rem-d">{reminder.med.strength}. {reminder.med.instructions}</p>
            <div className="stack" style={{ marginTop: 22 }}>
              <button className="btn btn-primary btn-lg btn-block" autoFocus onClick={() => {
                if (!reminder.test) markDose(reminder.med, reminder.time, "taken");
                else speak("Marked as taken.");
                setReminder(null);
              }}>
                <IconCheck /> I took it
              </button>
              <div className="btn-row">
                <button className="btn btn-lg" style={{ flex: 1 }} onClick={() => snooze(reminder)}>Snooze 10 min</button>
                <button className="btn btn-lg btn-ghost" style={{ flex: 1 }} onClick={() => {
                  if (!reminder.test) markDose(reminder.med, reminder.time, "skipped");
                  setReminder(null);
                }}>Skip</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
