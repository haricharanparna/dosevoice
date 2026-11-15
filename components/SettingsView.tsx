"use client";

import type { Settings } from "@/lib/types";
import { speak } from "@/lib/client";
import { IconBell, IconMoon, IconShield, IconSun, IconVolume } from "./Icons";

type Props = {
  settings: Settings;
  setSettings: (s: Settings) => void;
  notif: NotificationPermission | "unsupported";
  requestNotif: () => void;
  testReminder: () => void;
  storage: string;
};

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: React.ReactNode; aria?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} aria-label={o.aria} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export default function SettingsView({ settings, setSettings, notif, requestNotif, testReminder, storage }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...settings, [k]: v });

  return (
    <div className="fade-in">
      <header className="page-head">
        <p className="eyebrow">Settings</p>
        <h1 className="title">Make it yours</h1>
        <p className="subtitle">Adjust text, contrast, and voice so DoseVoice is comfortable to use.</p>
      </header>

      <h2 className="section-title">Display</h2>
      <section className="card setting-list">
        <div className="setting">
          <div><p className="s-label">Text size</p><p className="s-desc">Makes everything bigger, including buttons.</p></div>
          <Segmented label="Text size" value={settings.size} onChange={(v) => set("size", v)} options={[
            { value: "normal", label: <span style={{ fontSize: 14 }}>A</span>, aria: "Normal" },
            { value: "large", label: <span style={{ fontSize: 18 }}>A</span>, aria: "Large" },
            { value: "xl", label: <span style={{ fontSize: 22 }}>A</span>, aria: "Extra large" },
          ]} />
        </div>
        <div className="setting">
          <div><p className="s-label">Theme</p><p className="s-desc">Dark mode can reduce glare.</p></div>
          <Segmented label="Theme" value={settings.theme} onChange={(v) => set("theme", v)} options={[
            { value: "system", label: "Auto" },
            { value: "light", label: <><IconSun size={16} /> Light</> },
            { value: "dark", label: <><IconMoon size={16} /> Dark</> },
          ]} />
        </div>
        <div className="setting">
          <div><p className="s-label">High contrast</p><p className="s-desc">Stronger outlines and darker text.</p></div>
          <Switch label="High contrast" checked={settings.contrast} onChange={(v) => set("contrast", v)} />
        </div>
      </section>

      <h2 className="section-title">Voice</h2>
      <section className="card setting-list">
        <div className="setting">
          <div><p className="s-label">Read results aloud automatically</p><p className="s-desc">Speak each label as soon as it&apos;s read.</p></div>
          <Switch label="Read results aloud automatically" checked={settings.autoRead} onChange={(v) => set("autoRead", v)} />
        </div>
        <div className="setting">
          <div>
            <label className="s-label" htmlFor="rate">Speaking speed</label>
            <p className="s-desc">{settings.rate < 0.85 ? "Slow" : settings.rate > 1.1 ? "Fast" : "Normal"} ({settings.rate.toFixed(2)}×)</p>
          </div>
          <div className="row">
            <input id="rate" type="range" min={0.6} max={1.4} step={0.05} value={settings.rate}
              onChange={(e) => set("rate", Number(e.target.value))} />
            <button className="btn btn-sm" onClick={() => speak("This is how DoseVoice will sound when reading your labels.")}>
              <IconVolume size={18} /> Test
            </button>
          </div>
        </div>
      </section>

      <h2 className="section-title">Reminders</h2>
      <section className="card setting-list">
        <div className="setting">
          <div>
            <p className="s-label">Notifications</p>
            <p className="s-desc">
              {notif === "granted" ? "On. You'll get a notification at each dose time."
                : notif === "denied" ? "Blocked. Turn them on in your browser's site settings."
                : notif === "unsupported" ? "This browser doesn't support notifications."
                : "Get alerted even when DoseVoice is in the background."}
            </p>
          </div>
          {notif === "default" && <button className="btn btn-primary btn-sm" onClick={requestNotif}><IconBell size={18} /> Turn on</button>}
          {notif === "granted" && <span className="badge badge-ok">On</span>}
        </div>
        <div className="setting">
          <div><p className="s-label">Test a reminder</p><p className="s-desc">See and hear what a reminder looks like.</p></div>
          <button className="btn btn-sm" onClick={testReminder}><IconBell size={18} /> Send test</button>
        </div>
      </section>

      <p className="fineprint">
        <IconShield size={16} />
        <span>
          DoseVoice uses Google Gemini to read labels and {storage === "mongodb" ? "MongoDB Atlas" : "temporary storage"} to keep your list.
          It helps you read and remember. It is not medical advice. Always confirm with your pharmacist or doctor.
        </span>
      </p>
    </div>
  );
}
