import { NextResponse } from "next/server";
import { clearDose, listDoses, setDose } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!DATE.test(date)) return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  return NextResponse.json({ doses: await listDoses(date) });
}

export async function POST(req: Request) {
  const { medId, date, time, status } = await req.json();
  if (typeof medId !== "string" || !DATE.test(date) || !TIME.test(time)) {
    return NextResponse.json({ error: "medId, date and time are required" }, { status: 400 });
  }
  if (status === null) await clearDose({ medId, date, time });
  else if (status === "taken" || status === "skipped") await setDose({ medId, date, time, status });
  else return NextResponse.json({ error: "status must be taken, skipped or null" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
