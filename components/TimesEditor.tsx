"use client";

import { useId } from "react";
import { IconPlus, IconX } from "./Icons";

const PRESETS: { label: string; times: string[] }[] = [
  { label: "Once daily", times: ["09:00"] },
  { label: "Twice daily", times: ["09:00", "21:00"] },
  { label: "3× daily", times: ["08:00", "14:00", "20:00"] },
  { label: "4× daily", times: ["08:00", "12:00", "16:00", "20:00"] },
  { label: "Bedtime", times: ["22:00"] },
];

export default function TimesEditor({ times, onChange }: { times: string[]; onChange: (t: string[]) => void }) {
  const id = useId();
  const nextFree = () => {
    for (const t of ["09:00", "13:00", "18:00", "21:00", "12:00"]) if (!times.includes(t)) return t;
    return "12:00";
  };
  return (
    <div>
      <div className="times-editor" role="group" aria-label="Reminder times">
        {times.map((t, i) => (
          <span className="time-chip" key={i}>
            <label className="sr-only" htmlFor={`${id}-${i}`}>Reminder {i + 1}</label>
            <input id={`${id}-${i}`} type="time" value={t}
              onChange={(e) => onChange(times.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" aria-label={`Remove reminder ${i + 1}`} onClick={() => onChange(times.filter((_, j) => j !== i))}>
              <IconX size={18} />
            </button>
          </span>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => onChange([...times, nextFree()])}>
          <IconPlus size={18} /> Add time
        </button>
      </div>
      <div className="presets" aria-label="Quick schedules">
        {PRESETS.map((p) => (
          <button type="button" key={p.label} className="btn btn-sm btn-ghost"
            aria-pressed={p.times.join() === [...times].sort().join()}
            style={p.times.join() === [...times].sort().join() ? { background: "var(--primary-soft)", color: "var(--primary-soft-text)" } : undefined}
            onClick={() => onChange(p.times)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
