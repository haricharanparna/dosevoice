import { MongoClient, ObjectId, type Collection, type Db } from "mongodb";
import type { Dose, Med } from "./types";

type MedDoc = Omit<Med, "_id" | "createdAt"> & { _id?: ObjectId; createdAt: Date };
type DoseDoc = Omit<Dose, "at"> & { at: Date };

let clientPromise: Promise<MongoClient> | null = null;

// In-memory fallback so the demo works before Atlas is configured.
const g = globalThis as unknown as { __mem?: { meds: Med[]; doses: Dose[] } };
g.__mem ??= { meds: [], doses: [] };
const mem = () => g.__mem!;

export function usingMongo() {
  return Boolean(process.env.MONGODB_URI);
}

async function db(): Promise<Db> {
  if (!clientPromise) {
    clientPromise = new MongoClient((process.env.MONGODB_URI as string).trim(), { serverSelectionTimeoutMS: 8000 })
      .connect()
      .catch((e) => { clientPromise = null; throw e; }); // retry on the next request instead of caching the failure
  }
  return (await clientPromise).db(process.env.MONGODB_DB?.trim() || "dosevoice");
}
const meds = async (): Promise<Collection<MedDoc>> => (await db()).collection<MedDoc>("meds");
const doses = async (): Promise<Collection<DoseDoc>> => (await db()).collection<DoseDoc>("doses");

const out = (m: MedDoc): Med => ({ ...m, _id: String(m._id), createdAt: m.createdAt.toISOString() });

export async function listMeds(): Promise<Med[]> {
  if (!usingMongo()) return [...mem().meds].reverse();
  return (await (await meds()).find().sort({ createdAt: -1 }).toArray()).map(out);
}

export async function addMed(med: Omit<Med, "_id" | "createdAt">): Promise<Med> {
  if (!usingMongo()) {
    const saved: Med = { ...med, _id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    mem().meds.push(saved);
    return saved;
  }
  const doc: MedDoc = { ...med, createdAt: new Date() };
  const res = await (await meds()).insertOne(doc);
  return out({ ...doc, _id: res.insertedId });
}

export async function updateMedTimes(id: string, times: string[]): Promise<void> {
  if (!usingMongo()) {
    const m = mem().meds.find((x) => x._id === id);
    if (m) m.times = times;
    return;
  }
  if (!ObjectId.isValid(id)) return;
  await (await meds()).updateOne({ _id: new ObjectId(id) }, { $set: { times } });
}

export async function deleteMed(id: string): Promise<void> {
  if (!usingMongo()) {
    mem().meds = mem().meds.filter((m) => m._id !== id);
    mem().doses = mem().doses.filter((d) => d.medId !== id);
    return;
  }
  if (!ObjectId.isValid(id)) return;
  await (await meds()).deleteOne({ _id: new ObjectId(id) });
  await (await doses()).deleteMany({ medId: id });
}

export async function listDoses(date: string): Promise<Dose[]> {
  if (!usingMongo()) return mem().doses.filter((d) => d.date === date);
  const rows = await (await doses()).find({ date }).toArray();
  return rows.map(({ medId, date, time, status, at }) => ({ medId, date, time, status, at: at.toISOString() }));
}

export async function setDose(d: Omit<Dose, "at">): Promise<void> {
  if (!usingMongo()) {
    mem().doses = mem().doses.filter((x) => !(x.medId === d.medId && x.date === d.date && x.time === d.time));
    mem().doses.push({ ...d, at: new Date().toISOString() });
    return;
  }
  await (await doses()).updateOne(
    { medId: d.medId, date: d.date, time: d.time },
    { $set: { status: d.status, at: new Date() } },
    { upsert: true },
  );
}

export async function clearDose(d: Pick<Dose, "medId" | "date" | "time">): Promise<void> {
  if (!usingMongo()) {
    mem().doses = mem().doses.filter((x) => !(x.medId === d.medId && x.date === d.date && x.time === d.time));
    return;
  }
  await (await doses()).deleteOne(d);
}
