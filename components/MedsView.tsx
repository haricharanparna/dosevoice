"use client";

import { useState, type CSSProperties } from "react";
import type { InteractionReport, Med } from "@/lib/types";
import { hueFor, speak, to12h } from "@/lib/client";
import TimesEditor from "./TimesEditor";
import {
  IconAlert, IconCamera, IconCheck, IconChevron, IconClock, IconEdit, IconPill, IconPlus, IconShield, IconSparkles, IconTrash, IconVolume,
} from "./Icons";

type Props = {
  meds: Med[];
  onDelete: (m: Med) => void;
  onUpdateTimes: (m: Med, times: string[]) => Promise<void>;
  goScan: () => void;
};

function MedCard({ med, onDelete, onUpdateTimes }: { med: Med } & Pick<Props, "onDelete" | "onUpdateTimes">) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [times, setTimes] = useState(med.times);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelId = `med-${med._id}`;

  return (
    <li className="card med-card">
      <button className="med-row" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        <div className="avatar" style={{ "--h": hueFor(med.drugName) } as CSSProperties}><IconPill /></div>
        <div style={{ minWidth: 0 }}>
          <p className="name">{med.drugName}</p>
          <p className="meta">{med.strength}</p>
          <div className="pills">
            {med.times.length ? (
              med.times.map((t) => <span key={t} className="badge badge-neutral"><IconClock size={12} /> {to12h(t)}</span>)
            ) : (
              <span className="badge badge-neutral">No reminders</span>
            )}
            {med.warnings.length > 0 && (
              <span className="badge badge-warn"><IconAlert size={12} /> {med.warnings.length} warning{med.warnings.length > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <IconChevron className="chev" />
      </button>

      {open && (
        <div className="med-detail fade-in" id={panelId}>
          <div>
            <h4>Directions</h4>
            <p className="instructions">{med.instructions || "No directions saved."}</p>
          </div>

          {med.warnings.length > 0 && (
            <div>
              <h4>Warnings</h4>
              <ul className="warn-list" style={{ marginTop: 0 }}>
                {med.warnings.map((w, i) => <li key={i} className="callout callout-danger"><IconAlert size={18} /><p>{w}</p></li>)}
              </ul>
            </div>
          )}

          <div>
            <h4>Reminders</h4>
            {editing ? (
              <>
                <TimesEditor times={times} onChange={setTimes} />
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={async () => { await onUpdateTimes(med, times); setEditing(false); }}>
                    <IconCheck size={18} /> Save times
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setTimes(med.times); setEditing(false); }}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="row" style={{ flexWrap: "wrap" }}>
                <p style={{ fontWeight: 650 }}>{med.times.length ? med.times.map(to12h).join(" · ") : "None set"}</p>
                <button className="btn btn-sm" onClick={() => { setTimes(med.times); setEditing(true); }}>
                  <IconEdit size={16} /> Edit
                </button>
              </div>
            )}
          </div>

          <div className="btn-row">
            <button className="btn" onClick={() => speak(`${med.summary || `${med.drugName}, ${med.strength}. ${med.instructions}`} ${med.warnings.length ? `Warnings: ${med.warnings.map((w) => w.trim().replace(/[.!?]+$/, "")).join(". ")}.` : ""}`)}>
              <IconVolume size={20} /> Hear it
            </button>
            <span className="spacer" />
            {confirmDelete ? (
              <>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
                <button className="btn btn-danger" onClick={() => onDelete(med)}><IconTrash size={18} /> Yes, remove</button>
              </>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}><IconTrash size={18} /> Remove</button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function MedsView({ meds, onDelete, onUpdateTimes, goScan }: Props) {
  const [ix, setIx] = useState<InteractionReport | null>(null);
  const [ixBusy, setIxBusy] = useState(false);
  const [ixErr, setIxErr] = useState("");
  const [ixFor, setIxFor] = useState("");
  const key = meds.map((m) => m._id).sort().join();

  async function checkInteractions() {
    setIxBusy(true); setIxErr("");
    try {
      const r = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meds: meds.map(({ drugName, strength }) => ({ drugName, strength })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Check failed");
      setIx(j); setIxFor(key);
      const rep = j as InteractionReport;
      speak(rep.interactions.length
        ? `${rep.summary} I found ${rep.interactions.length} thing${rep.interactions.length > 1 ? "s" : ""} to ask your pharmacist about.`
        : rep.summary);
    } catch (e) {
      setIxErr(e instanceof Error ? e.message : "Check failed");
    } finally {
      setIxBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <header className="page-head row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">Medications</p>
          <h1 className="title">My medications</h1>
          <p className="subtitle">{meds.length ? `${meds.length} saved` : "Everything you take, in one place."}</p>
        </div>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={goScan}><IconPlus size={20} /> Add medication</button>
      </header>

      {meds.length === 0 ? (
        <div className="card empty">
          <div className="circle"><IconPill size={32} /></div>
          <h3>Your list is empty</h3>
          <p>Scan a label to add your first medication. It takes about five seconds.</p>
          <button className="btn btn-primary btn-lg" onClick={goScan} style={{ marginTop: 8 }}><IconCamera /> Scan a label</button>
        </div>
      ) : (
        <ul className="med-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {meds.map((m) => <MedCard key={m._id + m.times.join()} med={m} onDelete={onDelete} onUpdateTimes={onUpdateTimes} />)}
        </ul>
      )}

      {meds.length >= 1 && (
        <>
          <h2 className="section-title"><IconShield size={20} /> Safety check</h2>
          <section className="card card-pad">
            <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px" }}>
                <p style={{ fontWeight: 750, fontSize: "1.05rem" }}>Check for interactions</p>
                <p style={{ color: "var(--text-2)", marginTop: 4 }}>
                  Gemini looks for known interactions between your medications and gives you questions to ask your pharmacist.
                </p>
              </div>
              <button className="btn" onClick={checkInteractions} disabled={ixBusy || meds.length < 2}>
                <IconSparkles size={20} /> {ixBusy ? "Checking…" : ix && ixFor === key ? "Check again" : "Run check"}
              </button>
            </div>
            {meds.length < 2 && <p className="fineprint" style={{ marginTop: 12 }}>Add at least two medications to run a check.</p>}
            {ixErr && <div className="callout callout-danger" role="alert" style={{ marginTop: 16 }}><IconAlert size={20} /><p>{ixErr}</p></div>}

            {ix && ixFor === key && (
              <div className="stack fade-in" style={{ marginTop: 18 }} aria-live="polite">
                <div className={`callout ${ix.interactions.length ? "callout-warn" : "callout-info"}`}>
                  {ix.interactions.length ? <IconAlert size={20} /> : <IconCheck size={20} />}
                  <p>{ix.summary}</p>
                </div>
                {ix.interactions.map((it, i) => (
                  <div key={i} className={`card card-pad ix-card ${it.severity}`} style={{ boxShadow: "none" }}>
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <p style={{ fontWeight: 750 }}>{it.drugs.join(" + ")}</p>
                      <span className={`badge ${it.severity === "major" ? "badge-danger" : it.severity === "moderate" ? "badge-warn" : "badge-info"}`}>
                        {it.severity[0].toUpperCase() + it.severity.slice(1)}
                      </span>
                    </div>
                    <p style={{ marginTop: 6, color: "var(--text-2)" }}>{it.explanation}</p>
                    <p className="ix-q"><strong>Ask your pharmacist:</strong> {it.questionForPharmacist}</p>
                  </div>
                ))}
                <p className="fineprint" style={{ marginTop: 0 }}>
                  <IconShield size={16} /> This is an AI-generated summary, not medical advice. Don&apos;t stop or change any medication without talking to your doctor or pharmacist.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
