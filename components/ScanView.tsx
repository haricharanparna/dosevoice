"use client";

import { useEffect, useRef, useState } from "react";
import type { Med, Scan } from "@/lib/types";
import { fileToDataUrl, sampleLabelDataUrl, speak, stopSpeaking, to12h } from "@/lib/client";
import TimesEditor from "./TimesEditor";
import {
  IconAlert, IconArrowRight, IconCamera, IconCheck, IconImage, IconShield, IconSparkles, IconSun, IconUndo, IconUpload, IconVolume, IconX,
} from "./Icons";

type Phase = "idle" | "camera" | "scanning" | "result" | "error";

type Props = {
  autoRead: boolean;
  onSaved: (med: Med, message: string) => void;
};

function spokenFor(s: Scan) {
  let t = s.plainSummary;
  if (s.isMedicationLabel) {
    if (s.warnings.length) t += ` Warnings: ${s.warnings.map((w) => w.trim().replace(/[.!?]+$/, "")).join(". ")}.`;
    if (s.missing?.length && s.retakeHint) t += ` ${s.retakeHint}`;
    else if (s.confidence === "low") t += " Parts of this label were hard to read. Please confirm with your pharmacist.";
  }
  return t;
}

const MISSING_LABEL: Record<string, string> = { name: "medication name", strength: "strength", directions: "directions" };

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [camCount, setCamCount] = useState(0);
  const [camReady, setCamReady] = useState(false);
  // Photos of different sides of the same bottle, read together.
  const [shots, setShots] = useState<string[]>([]);
  const appendRef = useRef(false);
  const adding = appendRef.current && !!scan;

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }
  useEffect(() => stopCamera, []);

  // Live in-page camera. Falls back to the device's photo picker if the browser can't open one.
  async function openCamera(mode: "environment" | "user" = facing, append = appendRef.current) {
    appendRef.current = append;
    stopSpeaking();
    if (!navigator.mediaDevices?.getUserMedia) { cameraRef.current?.click(); return; }
    stopCamera();
    setPreview(null);
    setError("");
    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      setFacing(mode);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCamCount(devices.filter((d) => d.kind === "videoinput").length);
      const hint = append
        ? "Camera is on. Turn the bottle so the directions face the camera, then press Capture."
        : "Camera is on. Hold the label inside the frame, then press Capture.";
      setAnnounce(hint);
      if (autoRead) speak(hint);
    } catch (e) {
      stopCamera();
      const name = (e as DOMException)?.name;
      const msg = name === "NotAllowedError"
        ? "Camera access was blocked. Allow the camera from the icon in your address bar, or upload a photo instead."
        : name === "NotFoundError" || name === "OverconstrainedError"
          ? "No camera was found on this device. You can upload a photo instead."
          : "The camera couldn't start. Close other apps using it, or upload a photo instead.";
      setError(msg);
      setPhase("error");
      setAnnounce(msg);
      if (autoRead) speak(msg);
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const shot = c.toDataURL("image/jpeg", 0.9);
    stopCamera();
    run(shot, appendRef.current);
  }

  function cancelCamera() {
    stopCamera();
    if (appendRef.current && scan) {
      appendRef.current = false;
      setPreview(shots[shots.length - 1] ?? null);
      setPhase("result");
    } else {
      setPhase("idle");
    }
    setAnnounce("Camera closed.");
  }

  function addSide(how: "camera" | "upload") {
    appendRef.current = true;
    if (how === "camera") openCamera(facing, true);
    else uploadRef.current?.click();
  }

  async function run(image: string, append = false) {
    const prevScan = scan;
    const prevShots = shots;
    const combining = append && !!prevScan;
    const next = combining ? [...prevShots, image].slice(-4) : [image];
    appendRef.current = false;
    setShots(next);
    setPreview(image);
    setPhase("scanning");
    setError("");
    const wait = combining ? "Reading both sides together. One moment." : "Reading the label. One moment.";
    setAnnounce(wait);
    if (autoRead) speak(wait);
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: next }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Scan failed");
      const s = j as Scan;
      s.missing ??= [];
      if (!s.isMedicationLabel && combining) {
        // The extra photo didn't help; keep what we already had.
        throw new Error(s.plainSummary || "That photo didn't show the label. Try again.");
      }
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
      setAnnounce(msg);
      if (autoRead) speak(msg);
      if (combining) {
        // Go back to the earlier result rather than losing it.
        setShots(prevShots);
        setPreview(prevShots[prevShots.length - 1] ?? null);
        setError(msg);
        setPhase("result");
        return;
      }
      setError(msg);
      setPhase("error");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) run(await fileToDataUrl(file), appendRef.current);
    else appendRef.current = false;
  }

  function reset() {
    stopSpeaking();
    stopCamera();
    setPhase("idle");
    setPreview(null);
    setScan(null);
    setShots([]);
    appendRef.current = false;
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
              {scan.missing.length > 0 ? (
                <span className="badge badge-warn"><IconAlert size={14} /> Needs another side</span>
              ) : (
                <span className={`badge ${conf === "high" ? "badge-ok" : conf === "medium" ? "badge-info" : "badge-warn"}`}>
                  {conf === "low" ? <IconAlert size={14} /> : <IconCheck size={14} />}
                  {conf === "high" ? "Clear read" : conf === "medium" ? "Mostly clear" : "Hard to read"}
                </span>
              )}
            </div>

            {scan.missing.length > 0 && (
              <div className="callout callout-warn missing-box" style={{ marginTop: 16 }} role="alert">
                <IconCamera size={22} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 750 }}>
                    Missing the {scan.missing.map((m) => MISSING_LABEL[m] ?? m).join(" and ")}
                  </p>
                  <p style={{ marginTop: 4 }}>{scan.retakeHint}</p>
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={() => addSide("camera")}>
                      <IconCamera size={20} /> Photograph the {scan.missing.includes("directions") ? "directions side" : "other side"}
                    </button>
                    <button className="btn" onClick={() => addSide("upload")}>
                      <IconUpload size={20} /> Upload it
                    </button>
                  </div>
                </div>
              </div>
            )}

            {shots.length > 1 && (
              <div className="sides-row" aria-label={`${shots.length} photos read together`}>
                {shots.map((s, i) => <img key={i} src={s} alt="" />)}
                <span><IconCheck size={16} /> {shots.length} sides read together</span>
              </div>
            )}

            {conf === "low" && scan.missing.length === 0 && (
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
              <button className="btn btn-lg" onClick={() => { reset(); openCamera(); }}>
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
        {adding ? (
          <>
            <p className="eyebrow">Add another side</p>
            <h1 className="title">Show me the directions</h1>
            <p className="subtitle">Turn the bottle so the side that says how much to take and how often faces the camera.</p>
          </>
        ) : (
          <>
            <p className="eyebrow">Scan</p>
            <h1 className="title">Scan a prescription label</h1>
            <p className="subtitle">DoseVoice reads the small print out loud and builds your reminders.</p>
          </>
        )}
      </header>

      <div className="scan-hero">
        <div className={`viewfinder${phase === "camera" ? " is-live" : ""}`} aria-hidden={phase !== "scanning" && phase !== "camera"}>
          {phase === "camera" && (
            <video ref={(el) => {
                videoRef.current = el;
                if (el && streamRef.current && el.srcObject !== streamRef.current) {
                  el.srcObject = streamRef.current;
                  el.play().catch(() => {});
                }
              }} className="vf-video" playsInline muted autoPlay aria-label="Live camera view"
              onLoadedData={() => setCamReady(true)} style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} />
          )}
          <span className="vf-corner tl" /><span className="vf-corner tr" />
          <span className="vf-corner bl" /><span className="vf-corner br" />
          {phase === "camera" && !camReady && (
            <span className="vf-status"><span className="spinner" /> Starting camera…</span>
          )}
          {preview && <img src={preview} alt="" />}
          {phase === "camera" ? null : phase === "scanning" ? (
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
          {phase === "camera" ? (
            <>
              <button className="btn btn-primary btn-lg btn-block" onClick={capture} disabled={!camReady} autoFocus
                style={{ minHeight: 76, fontSize: "1.2rem" }}>
                <span className="shutter-dot" aria-hidden="true" /> Capture
              </button>
              <div className="btn-row">
                {camCount > 1 && (
                  <button className="btn btn-lg" style={{ flex: 1 }} onClick={() => openCamera(facing === "environment" ? "user" : "environment")}>
                    <IconUndo size={20} /> Switch camera
                  </button>
                )}
                <button className="btn btn-lg" style={{ flex: 1 }} onClick={cancelCamera}>
                  <IconX size={20} /> Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => openCamera()} disabled={phase === "scanning"}
                style={{ minHeight: 68, fontSize: "1.15rem" }}>
                <IconCamera size={24} /> {phase === "error" ? "Try again" : "Take a photo"}
              </button>
              <button className="btn btn-lg btn-block" onClick={() => uploadRef.current?.click()} disabled={phase === "scanning"}>
                <IconUpload /> Upload an image
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => run(sampleLabelDataUrl())} disabled={phase === "scanning"}>
                <IconSparkles size={20} /> No bottle handy? Try a sample label <IconArrowRight size={18} />
              </button>
            </>
          )}
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
