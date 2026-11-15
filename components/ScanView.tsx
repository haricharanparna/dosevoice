"use client";

import { useRef, useState } from "react";
import type { Med, Scan } from "@/lib/types";
import { fileToDataUrl, sampleLabelDataUrl, speak, stopSpeaking, to12h } from "@/lib/client";
import TimesEditor from "./TimesEditor";
import {
  IconAlert, IconArrowRight, IconCamera, IconCheck, IconImage, IconShield, IconSparkles, IconSun, IconUpload, IconVolume,
} from "./Icons";

type Phase = "idle" | "scanning" | "result" | "error";

type Props = {
  autoRead: boolean;
  onSaved: (med: Med, message: string) => void;
};

function spokenFor(s: Scan) {
  let t = s.plainSummary;
  if (s.isMedicationLabel) {
    if (s.warnings.length) t += ` Warnings: ${s.warnings.map((w) => w.trim().replace(/[.!?]+$/, "")).join(". ")}.`;
    if (s.confidence === "low") t += " Parts of this label were hard to read. Please confirm with your pharmacist.";
  }
  return t;
}

export default function ScanView({ autoRead, onSaved }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [draft, setDraft] = useState({ drugName: "", strength: "", instructions: "" });
  const [times, setTimes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState("");

  async function run(image: string) {
    setPreview(image);
    setPhase("scanning");
    setError("");
    setAnnounce("Reading the label. One moment.");
    if (autoRead) speak("Reading the label. One moment.");
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Scan failed");
      const s = j as Scan;
      setScan(s);
      setDraft({ drugName: s.drugName, strength: s.strength, instructions: s.instructions });
      setTimes(s.suggestedTimes);
      setPhase(s.isMedicationLabel ? "result" : "error");
      if (!s.isMedicationLabel) setError(s.plainSummary || "That doesn't look like a medication label.");
      const said = spokenFor(s);
      setAnnounce(said);
      if (autoRead) speak(said);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setPhase("error");
      setAnnounce(msg);
      if (autoRead) speak(msg);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) run(await fileToDataUrl(file));
  }

  function reset() {
    stopSpeaking();
    setPhase("idle");
    setPreview(null);
    setScan(null);
    setError("");
  }

  async function save() {
    if (!scan || !draft.drugName.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/meds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, summary: scan.plainSummary, warnings: scan.warnings, times }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not save");
      const sorted = [...new Set(times)].sort();
      const msg = sorted.length
        ? `${draft.drugName} saved. Reminders at ${sorted.map(to12h).join(", ")}.`
        : `${draft.drugName} saved.`;
      reset();
      onSaved(j.med as Med, msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
      <input ref={uploadRef} type="file" accept="image/*" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
      <p className="sr-only" aria-live="polite">{announce}</p>
    </>
  );

  if (phase === "result" && scan) {
    const conf = scan.confidence;
    return (
      <div className="fade-in">
        {inputs}
        <header className="page-head">
          <p className="eyebrow">Label read</p>
          <h1 className="title">Here&apos;s what it says</h1>
          <p className="subtitle">Check the details, set your reminders, and save.</p>
        </header>

        <div className="result-grid">
          <div className="viewfinder">
            {preview && <img src={preview} alt="The label you scanned" />}
          </div>

          <section className="card card-pad" aria-labelledby="drug-h">
            <div className="result-head">
              <div>
                <h2 id="drug-h" className="drug-name">{draft.drugName || "Unnamed medication"}</h2>
                <p className="drug-strength">{draft.strength}</p>
              </div>
              <span className={`badge ${conf === "high" ? "badge-ok" : conf === "medium" ? "badge-info" : "badge-warn"}`}>
                {conf === "low" ? <IconAlert size={14} /> : <IconCheck size={14} />}
                {conf === "high" ? "Clear read" : conf === "medium" ? "Mostly clear" : "Hard to read"}
              </span>
            </div>

            {conf === "low" && (
              <div className="callout callout-warn" style={{ marginTop: 16 }} role="note">
                <IconAlert size={20} />
                <p>Parts of this label were hard to read. Double-check the details below, or confirm with your pharmacist.</p>
              </div>
            )}

            <div className="summary-box">
              <button className="listen-btn" onClick={() => speak(spokenFor(scan))} aria-label="Listen to the summary">
                <IconVolume size={22} />
              </button>
              <p>{scan.plainSummary}</p>
            </div>

            {scan.warnings.length > 0 && (
              <>
                <h3 className="section-title" style={{ marginTop: 0 }}>Warnings</h3>
                <ul className="warn-list">
                  {scan.warnings.map((w, i) => (
                    <li key={i} className="callout callout-danger"><IconAlert size={20} /><p>{w}</p></li>
                  ))}
                </ul>
              </>
            )}

            <h3 className="section-title">Details</h3>
            <div className="stack">
              <div className="field">
                <label htmlFor="f-name">Medication name</label>
                <input id="f-name" className="input" value={draft.drugName} onChange={(e) => setDraft({ ...draft, drugName: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="f-str">Strength</label>
                <input id="f-str" className="input" value={draft.strength} onChange={(e) => setDraft({ ...draft, strength: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="f-ins">Directions</label>
                <textarea id="f-ins" className="input" value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
              </div>
            </div>

            <h3 className="section-title">Reminders</h3>
            <TimesEditor times={times} onChange={setTimes} />

            {error && <div className="callout callout-danger" role="alert" style={{ marginTop: 16 }}><IconAlert size={20} /><p>{error}</p></div>}

            <div className="btn-row" style={{ marginTop: 24 }}>
              <button className="btn btn-primary btn-lg" onClick={save} disabled={saving || !draft.drugName.trim()}>
                <IconCheck /> {saving ? "Saving…" : "Save to my medications"}
              </button>
              <button className="btn btn-lg" onClick={() => cameraRef.current?.click()}>
                <IconCamera /> Retake
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {inputs}
      <header className="page-head">
        <p className="eyebrow">Scan</p>
        <h1 className="title">Scan a prescription label</h1>
        <p className="subtitle">DoseVoice reads the small print out loud and builds your reminders.</p>
      </header>

      <div className="scan-hero">
        <div className="viewfinder" aria-hidden={phase !== "scanning"}>
          <span className="vf-corner tl" /><span className="vf-corner tr" />
          <span className="vf-corner bl" /><span className="vf-corner br" />
          {preview && <img src={preview} alt="" />}
          {phase === "scanning" ? (
            <>
              <span className="scanline" />
              <span className="vf-status"><span className="spinner" /> Reading label with Gemini…</span>
            </>
          ) : (
            !preview && (
              <div className="vf-empty">
                <div className="circle"><IconCamera size={34} /></div>
                <p style={{ fontWeight: 650 }}>Frame the label here</p>
              </div>
            )
          )}
        </div>

        <div className="stack">
          {phase === "error" && (
            <div className="callout callout-warn" role="alert">
              <IconAlert size={20} />
              <div>
                <p style={{ fontWeight: 700 }}>We couldn&apos;t read that one</p>
                <p style={{ marginTop: 2 }}>{error}</p>
              </div>
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" onClick={() => cameraRef.current?.click()} disabled={phase === "scanning"}
            style={{ minHeight: 68, fontSize: "1.15rem" }}>
            <IconCamera size={24} /> {phase === "error" ? "Try again" : "Take a photo"}
          </button>
          <button className="btn btn-lg btn-block" onClick={() => uploadRef.current?.click()} disabled={phase === "scanning"}>
            <IconUpload /> Upload an image
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => run(sampleLabelDataUrl())} disabled={phase === "scanning"}>
            <IconSparkles size={20} /> No bottle handy? Try a sample label <IconArrowRight size={18} />
          </button>
          {phase === "error" && <button className="btn btn-ghost btn-block" onClick={reset}>Start over</button>}

          <div className="tips" aria-label="Tips for a good scan">
            <p className="tip"><span className="tip-icon"><IconSun size={18} /></span> Use good, even light and avoid glare</p>
            <p className="tip"><span className="tip-icon"><IconImage size={18} /></span> Fill the frame with the label text</p>
            <p className="tip"><span className="tip-icon"><IconShield size={18} /></span> DoseVoice doesn&apos;t save your photos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
