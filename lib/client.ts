"use client";

let speechRate = 0.95;
export function setSpeechRate(r: number) {
  speechRate = r;
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = speechRate;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const hhmm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

export function partOfDay(t: string): "Morning" | "Afternoon" | "Evening" | "Night" {
  const h = Number(t.split(":")[0]);
  if (h < 5) return "Night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Night";
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function humanizeMinutes(mins: number) {
  if (mins < 1) return "now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h} hr ${m} min` : `in ${h} hr`;
}

/** Stable hue per medication name, so each med keeps its color everywhere. */
export function hueFor(name: string) {
  const hues = [172, 210, 262, 330, 24, 45, 145, 190];
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return hues[h % hues.length];
}

export function readPref(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

// Downscale the photo before upload: faster, cheaper, and plenty for reading text.
export async function fileToDataUrl(file: File, max = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** Draws a realistic fictional pharmacy label, so judges can try the app without a pill bottle. */
export function sampleLabelDataUrl(): string {
  const W = 1200, H = 720;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "#e9e4d8"; x.fillRect(0, 0, W, H);
  // label
  x.save();
  x.translate(W / 2, H / 2); x.rotate(-0.025); x.translate(-W / 2, -H / 2);
  x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 30; x.shadowOffsetY = 10;
  x.fillStyle = "#fff"; x.fillRect(80, 70, 1040, 580);
  x.shadowColor = "transparent";
  x.fillStyle = "#1f4e79"; x.fillRect(80, 70, 1040, 70);
  x.fillStyle = "#fff"; x.font = "bold 34px Arial"; x.fillText("SAMPLE COMMUNITY PHARMACY", 110, 117);
  x.font = "20px Arial"; x.fillText("(555) 010-0199", 940, 115);
  x.fillStyle = "#111";
  x.font = "22px Arial";
  x.fillText("Rx# 0482913        Date: 11/12/2026        Dr. J. Rivera", 110, 180);
  x.font = "bold 28px Arial"; x.fillText("ALEX SAMPLE", 110, 222);
  x.font = "bold 46px Arial"; x.fillText("AMOXICILLIN 500 MG CAPSULE", 110, 290);
  x.font = "bold 30px Arial";
  x.fillText("TAKE 1 CAPSULE BY MOUTH THREE TIMES", 110, 350);
  x.fillText("DAILY WITH FOOD UNTIL ALL TAKEN", 110, 390);
  x.font = "22px Arial";
  x.fillText("QTY: 30        REFILLS: 0        Discard after: 11/2027", 110, 450);
  x.fillText("MFG: GENERIC LABS        NDC 00000-0000-00", 110, 485);
  // aux stickers
  x.fillStyle = "#ffb347"; x.fillRect(110, 520, 470, 105);
  x.fillStyle = "#111"; x.font = "bold 24px Arial";
  x.fillText("FINISH ALL THIS MEDICATION", 130, 562);
  x.fillText("UNLESS OTHERWISE DIRECTED", 130, 598);
  x.fillStyle = "#ffe14d"; x.fillRect(610, 520, 480, 105);
  x.fillStyle = "#111";
  x.fillText("MAY CAUSE DIARRHEA. CALL", 630, 562);
  x.fillText("DOCTOR IF SEVERE OR BLOODY", 630, 598);
  x.restore();
  return c.toDataURL("image/jpeg", 0.9);
}
