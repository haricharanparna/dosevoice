"use client";

import type { CSSProperties } from "react";
import type { Dose, DoseStatus, Med } from "@/lib/types";
import { greeting, hueFor, humanizeMinutes, minutesOf, partOfDay, speak, to12h } from "@/lib/client";
import {
  IconCamera, IconCheck, IconMoon, IconPill, IconSkip, IconSun, IconSunrise, IconUndo, IconVolume,
} from "./Icons";

export type DoseItem = { med: Med; time: string; status: DoseStatus | null; overdue: boolean };

export function buildSchedule(meds: Med[], doses: Dose[], now: Date): DoseItem[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const items: DoseItem[] = [];
  for (const med of meds) {
    for (const time of med.times) {
      const d = doses.find((x) => x.medId === med._id && x.time === time);
      const status = d?.status ?? null;
      items.push({ med, time, status, overdue: !status && minutesOf(time) + 30 < nowMin });
    }
  }
  return items.sort((a, b) => minutesOf(a.time) - minutesOf(b.time) || a.med.drugName.localeCompare(b.med.drugName));
}

const GROUP_ICON = { Morning: IconSunrise, Afternoon: IconSun, Evening: IconSun, Night: IconMoon } as const;

function Ring({ done, total }: { done: number; total: number }) {
  const r = 44, c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="ring" role="img" aria-label={`${done} of ${total} doses taken today`}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle className="ring-bg" cx="52" cy="52" r={r} fill="none" strokeWidth="10" />
        <circle className="ring-fg" cx="52" cy="52" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="ring-label" aria-hidden="true">
        <div><b>{done}/{total}</b><span>taken</span></div>
      </div>
    </div>
  );
}

type Props = {
  meds: Med[];
  doses: Dose[];
  now: Date;
  onMark: (med: Med, time: string, status: DoseStatus | null) => void;
  goScan: () => void;
};

export default function TodayView({ meds, doses, now, onMark, goScan }: Props) {
  const schedule = buildSchedule(meds, doses, now);
  const taken = schedule.filter((s) => s.status === "taken").length;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next =
    schedule.find((s) => !s.status && s.overdue) ??
    schedule.find((s) => !s.status && minutesOf(s.time) >= nowMin - 30);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const groups: Record<string, DoseItem[]> = {};
  for (const s of schedule) (groups[partOfDay(s.time)] ??= []).push(s);

  function readDay() {
    if (!schedule.length) return speak("You have no doses scheduled today.");
    const left = schedule.filter((s) => !s.status);
    const parts = [`You have taken ${taken} of ${schedule.length} doses today.`];
    if (left.length) parts.push(`Still to take: ${left.map((s) => `${s.med.drugName} at ${to12h(s.time)}`).join(", ")}.`);
    else parts.push("You're all done for today. Great job.");
    speak(parts.join(" "));
  }

  return (
    <div className="fade-in">
      <header className="page-head row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1 className="title">{greeting(now)}</h1>
          <p className="subtitle">
            {schedule.length
              ? taken === schedule.length
                ? "Every dose is done for today. Nice work."
                : `${schedule.length - taken} dose${schedule.length - taken === 1 ? "" : "s"} left today.`
              : "Add a medication to start your daily plan."}
          </p>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={readDay}>
          <IconVolume size={20} /> Read my day
        </button>
      </header>

      {meds.length === 0 ? (
        <div className="card empty">
          <div className="circle"><IconPill size={32} /></div>
          <h3>No medications yet</h3>
          <p>Scan a prescription label and DoseVoice builds your daily schedule for you.</p>
          <button className="btn btn-primary btn-lg" onClick={goScan} style={{ marginTop: 8 }}>
            <IconCamera /> Scan your first label
          </button>
        </div>
      ) : (
        <>
          <div className="hero-grid">
            <section className="next-card" aria-labelledby="next-h">
              <p className="label" id="next-h">{next ? (next.overdue ? "Overdue" : "Up next") : "All set"}</p>
              {next ? (
                <>
                  <p className="when">{to12h(next.time)}</p>
                  <p className="what">
                    {next.med.drugName} · {next.med.strength}
                    <br />
                    <span style={{ opacity: 0.85, fontWeight: 500 }}>
                      {next.overdue ? "Take it as soon as you can" : humanizeMinutes(minutesOf(next.time) - nowMin)}
                    </span>
                  </p>
                  <div className="btn-row" style={{ marginTop: 16, position: "relative", zIndex: 1 }}>
                    <button className="btn btn-solid" onClick={() => onMark(next.med, next.time, "taken")}>
                      <IconCheck size={20} /> Mark as taken
                    </button>
                    <button className="btn" aria-label={`Hear details for ${next.med.drugName}`}
                      onClick={() => speak(`${next.med.drugName}, ${next.med.strength}. ${next.med.instructions}`)}>
                      <IconVolume size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="when">Done</p>
                  <p className="what">No more doses today.</p>
                </>
              )}
            </section>

            <section className="card card-pad progress-card" aria-label="Today's progress">
              <Ring done={taken} total={schedule.length} />
              <div>
                <p style={{ fontWeight: 750, fontSize: "1.05rem" }}>Today&apos;s progress</p>
                <p style={{ color: "var(--muted)", fontSize: "0.92rem", marginTop: 4 }}>
                  {meds.length} medication{meds.length === 1 ? "" : "s"} · {schedule.length} dose
                  {schedule.length === 1 ? "" : "s"}
                </p>
                {schedule.some((s) => s.overdue) && (
                  <span className="badge badge-warn" style={{ marginTop: 10 }}>
                    {schedule.filter((s) => s.overdue).length} overdue
                  </span>
                )}
              </div>
            </section>
          </div>

          <h2 className="section-title">Schedule</h2>
          {schedule.length === 0 && (
            <p className="card card-pad" style={{ color: "var(--text-2)" }}>
              None of your medications have reminder times. Add times in the Medications tab.
            </p>
          )}
          {Object.entries(groups).map(([group, items]) => {
            const GI = GROUP_ICON[group as keyof typeof GROUP_ICON];
            return (
              <section key={group} aria-label={group}>
                <p className="group-label"><GI size={16} /> {group}</p>
                <ul className="timeline" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {items.map((s) => (
                    <li key={`${s.med._id}-${s.time}`}
                      className={`dose ${s.status === "taken" ? "is-taken" : ""} ${s.status === "skipped" ? "is-skipped" : ""} ${s.overdue ? "is-overdue" : ""}`}>
                      <div className="dose-time">
                        {to12h(s.time)}
                        <small>
                          {s.status === "taken" ? "Taken" : s.status === "skipped" ? "Skipped" : s.overdue ? "Overdue" : "Scheduled"}
                        </small>
                      </div>
                      <div className="dose-main">
                        <div className="avatar avatar-sm" style={{ "--h": hueFor(s.med.drugName) } as CSSProperties}>
                          <IconPill size={20} />
                        </div>
                        <div>
                          <p className="name">{s.med.drugName}</p>
                          <p className="meta">{s.med.strength}</p>
                        </div>
                      </div>
                      <div className="dose-actions">
                        {s.status ? (
                          <button className="btn btn-sm btn-ghost" onClick={() => onMark(s.med, s.time, null)}
                            aria-label={`Undo ${s.status} for ${s.med.drugName} at ${to12h(s.time)}`}>
                            <IconUndo size={18} /> <span className="take-label">Undo</span>
                          </button>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-ghost" onClick={() => onMark(s.med, s.time, "skipped")}
                              aria-label={`Skip ${s.med.drugName} at ${to12h(s.time)}`}>
                              <IconSkip size={18} />
                            </button>
                            <button className="btn btn-sm btn-primary take-btn" onClick={() => onMark(s.med, s.time, "taken")}
                              aria-label={`Mark ${s.med.drugName} at ${to12h(s.time)} as taken`}>
                              <IconCheck size={18} /> <span className="take-label">Take</span>
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
