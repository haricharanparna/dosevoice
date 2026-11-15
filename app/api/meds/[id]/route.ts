import { NextResponse } from "next/server";
import { deleteMed, updateMedTimes } from "@/lib/mongo";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { times } = await req.json();
  if (!Array.isArray(times)) return NextResponse.json({ error: "times must be an array" }, { status: 400 });
  const clean = [
    ...new Set(times.filter((t: unknown): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))),
  ].sort();
  await updateMedTimes(id, clean);
  return NextResponse.json({ ok: true, times: clean });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteMed(id);
  return NextResponse.json({ ok: true });
}
