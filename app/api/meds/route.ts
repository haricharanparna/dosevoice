import { NextResponse } from "next/server";
import { addMed, listMeds, usingMongo } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ meds: await listMeds(), storage: usingMongo() ? "mongodb" : "memory" });
  } catch (e) {
    const err = e as Error;
    console.error("Database error", err);
    // Report the kind of failure only, never the connection string.
    return NextResponse.json({ error: "Database unreachable", reason: err.name, code: (err as { code?: unknown }).code ?? null }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b?.drugName || typeof b.drugName !== "string") {
    return NextResponse.json({ error: "drugName is required" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 1000) : "");
  const times: string[] = Array.isArray(b.times)
    ? b.times.filter((t: unknown): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))
    : [];
  const med = await addMed({
    drugName: str(b.drugName),
    strength: str(b.strength),
    instructions: str(b.instructions),
    summary: str(b.summary),
    warnings: Array.isArray(b.warnings) ? b.warnings.map(str).filter(Boolean).slice(0, 20) : [],
    times: [...new Set(times)].sort(),
  });
  return NextResponse.json({ med }, { status: 201 });
}
