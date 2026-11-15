import { NextResponse } from "next/server";
import { geminiJSON, GeminiError } from "@/lib/gemini";
import type { InteractionReport } from "@/lib/types";

export const runtime = "nodejs";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    interactions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          drugs: { type: "ARRAY", items: { type: "STRING" } },
          severity: { type: "STRING", enum: ["major", "moderate", "minor"] },
          explanation: { type: "STRING" },
          questionForPharmacist: { type: "STRING" },
        },
        required: ["drugs", "severity", "explanation", "questionForPharmacist"],
      },
    },
  },
  required: ["summary", "interactions"],
};

export async function POST(req: Request) {
  const { meds } = (await req.json()) as { meds?: { drugName: string; strength?: string }[] };
  if (!Array.isArray(meds) || meds.length < 2) {
    return NextResponse.json({ error: "Add at least two medications to check interactions." }, { status: 400 });
  }
  const list = meds
    .slice(0, 20)
    .map((m) => `- ${String(m.drugName).slice(0, 100)} ${String(m.strength ?? "").slice(0, 60)}`)
    .join("\n");
  const prompt = `A patient takes these medications:
${list}

Identify well-documented drug-drug interactions or therapeutic duplications among ONLY these medications.
- Only include interactions supported by standard drug references. If none are known, return an empty list.
- explanation: one or two plain-language sentences a non-expert can understand. No jargon.
- questionForPharmacist: a short question the patient can ask their pharmacist.
- summary: one calm sentence describing the overall result. Never tell the patient to stop or change any medication.`;
  try {
    return NextResponse.json(await geminiJSON<InteractionReport>([{ text: prompt }], SCHEMA));
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError("Interaction check failed.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
