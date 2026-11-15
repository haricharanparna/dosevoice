import { NextResponse } from "next/server";
import { geminiJSON, GeminiError } from "@/lib/gemini";
import type { Scan } from "@/lib/types";

export const runtime = "nodejs";

const MAX_IMAGES = 4;

const PROMPT = `You are helping a person with low vision read a medication label.
The photo(s) may show DIFFERENT SIDES of the SAME bottle or box (for example the name side and the directions side).
Combine everything you can read across all photos into one result. Extract information exactly as printed. Do not guess.
- If no photo shows a medication label, or all are unreadable, set isMedicationLabel=false and explain in plainSummary what to retake (e.g. "The photo is too blurry. Move a little closer and hold steady.").
- drugName: the medication name in Title Case (e.g. "Amoxicillin"). strength: e.g. "500 mg capsule". Use "" if not visible.
- instructions: the dosing directions (how much, how often) rewritten in clear sentence case (not ALL CAPS), meaning unchanged. Use "" if no directions are visible.
- plainSummary: 1-3 short spoken-style sentences, e.g. "This is Amoxicillin, 500 milligrams. Take one capsule by mouth three times a day with food."
  Spell out units (milligrams, not mg). Never add advice that is not on the label. Never invent directions.
- suggestedTimes: reminder times in 24h "HH:MM" derived ONLY from the label frequency
  (once daily -> ["09:00"], twice -> ["09:00","21:00"], three times -> ["08:00","14:00","20:00"], four -> ["08:00","12:00","16:00","20:00"], at bedtime -> ["22:00"]).
  Empty array if "as needed", unclear, or no directions are visible.
- warnings: short warnings printed on the label or its auxiliary stickers, in sentence case.
- missing: which key fields are NOT readable in any photo: any of "name", "strength", "directions". Empty array if all are present.
  "directions" is missing when there is no readable dose AND frequency (e.g. only the brand name or the front of a box is shown).
- retakeHint: if missing is not empty, one short friendly spoken sentence telling the person exactly what to photograph next,
  e.g. "I can see the medication name, but not the directions. Turn the bottle and take a photo of the side with the directions."
  Otherwise "".
- confidence: "low" if any key field was hard to read.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isMedicationLabel: { type: "BOOLEAN" },
    drugName: { type: "STRING" },
    strength: { type: "STRING" },
    instructions: { type: "STRING" },
    suggestedTimes: { type: "ARRAY", items: { type: "STRING" } },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
    plainSummary: { type: "STRING" },
    missing: { type: "ARRAY", items: { type: "STRING", enum: ["name", "strength", "directions"] } },
    retakeHint: { type: "STRING" },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
  },
  required: [
    "isMedicationLabel", "drugName", "strength", "instructions",
    "suggestedTimes", "warnings", "plainSummary", "missing", "retakeHint", "confidence",
  ],
};

export async function POST(req: Request) {
  const body = (await req.json()) as { image?: string; images?: string[] };
  const list = (Array.isArray(body.images) ? body.images : body.image ? [body.image] : []).slice(-MAX_IMAGES);
  const parts: unknown[] = [];
  for (const img of list) {
    const match = typeof img === "string" ? img.match(/^data:(image\/[\w+.-]+);base64,(.+)$/) : null;
    if (!match) return NextResponse.json({ error: "Send images as base64 data URLs." }, { status: 400 });
    parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }
  if (!parts.length) return NextResponse.json({ error: "Send at least one image." }, { status: 400 });

  try {
    const scan = await geminiJSON<Scan>([...parts, { text: PROMPT }], SCHEMA);
    scan.suggestedTimes = (scan.suggestedTimes ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t));
    scan.warnings ??= [];
    scan.missing = (scan.missing ?? []).filter((m) => m === "name" || m === "strength" || m === "directions");
    // Belt and braces: if Gemini left directions blank but didn't flag it, flag it ourselves.
    if (scan.isMedicationLabel && !scan.instructions?.trim() && !scan.missing.includes("directions")) scan.missing.push("directions");
    if (scan.missing.length && !scan.retakeHint?.trim()) {
      scan.retakeHint = scan.missing.includes("directions")
        ? "I can't see the directions yet. Turn the bottle and take a photo of the side that says how much to take and how often."
        : "Some details are missing. Take a photo of another side of the label.";
    }
    return NextResponse.json(scan);
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError("Could not read the label.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
