import { NextResponse } from "next/server";
import { geminiJSON, GeminiError } from "@/lib/gemini";
import type { Scan } from "@/lib/types";

export const runtime = "nodejs";

const PROMPT = `You are helping a person with low vision read a medication label.
Read the label in the photo and extract the information exactly as printed. Do not guess.
- If the image is not a medication label or is unreadable, set isMedicationLabel=false and explain in plainSummary what to retake (e.g. "The photo is too blurry. Move a little closer and hold steady.").
- drugName: the medication name in Title Case (e.g. "Amoxicillin"). strength: e.g. "500 mg capsule".
- instructions: the directions rewritten in clear sentence case (not ALL CAPS), meaning unchanged.
- plainSummary: 1-3 short spoken-style sentences, e.g. "This is Amoxicillin, 500 milligrams. Take one capsule by mouth three times a day with food."
  Spell out units (milligrams, not mg). Never add advice that is not on the label.
- suggestedTimes: reminder times in 24h "HH:MM" derived ONLY from the label frequency
  (once daily -> ["09:00"], twice -> ["09:00","21:00"], three times -> ["08:00","14:00","20:00"], four -> ["08:00","12:00","16:00","20:00"], at bedtime -> ["22:00"]).
  Empty array if "as needed" or unclear.
- warnings: short warnings printed on the label or its auxiliary stickers, in sentence case.
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
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
  },
  required: [
    "isMedicationLabel", "drugName", "strength", "instructions",
    "suggestedTimes", "warnings", "plainSummary", "confidence",
  ],
};

export async function POST(req: Request) {
  const { image } = (await req.json()) as { image?: string };
  const match = image?.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Send an image as a base64 data URL." }, { status: 400 });
  const [, mimeType, data] = match;
  try {
    const scan = await geminiJSON<Scan>([{ inline_data: { mime_type: mimeType, data } }, { text: PROMPT }], SCHEMA);
    scan.suggestedTimes = (scan.suggestedTimes ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t));
    scan.warnings ??= [];
    return NextResponse.json(scan);
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError("Could not read the label.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
