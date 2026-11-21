// Development only: keeps the before and after pictures of try-ons on the server's disk so the
// team can review them and improve the previews. Off unless RECORD_TRYONS=1.
//
// While this is on, the app's promise to the customer ("the photo is not stored") is NOT true.
// It must be off, or the customer's text changed and consent asked, before real customers use it.
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const recordingOn = (): boolean => process.env.RECORD_TRYONS === "1";
const root = (): string => process.env.RECORD_DIR ?? path.join(process.cwd(), "..", "ayeneh-records");

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PHOTO = /^[0-9]{10,16}-[0-9]{1,8}$/; // the id the app gives a photo
const FILE = /^(before|\d{6}_[a-z0-9-]{1,40}_[A-Za-z0-9-]{1,14}_(local|ai)_[a-z]{1,12})\.jpg$/;
const MAX_PHOTOS_PER_DAY = 400;
const MAX_FILES_PER_PHOTO = 30;
// The whole folder may not pass this: the server's disk is shared with other work.
const MAX_TOTAL_BYTES = Number(process.env.RECORD_MAX_MB ?? 1000) * 1024 * 1024;

// Counted from the disk once, then kept up as pictures are written.
let total: Promise<number> | null = null;
async function sizeOf(dir: string): Promise<number> {
  let sum = 0;
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name);
    sum += e.isDirectory() ? await sizeOf(full) : ((await stat(full).catch(() => null))?.size ?? 0);
  }
  return sum;
}

export type RecordMeta = { photoId: string; lineKey: string; shadeCode: string; engine: "local" | "ai"; outcome: string };

export function validMeta(m: RecordMeta): boolean {
  return PHOTO.test(m.photoId) && /^[a-z0-9-]{1,40}$/.test(m.lineKey) && /^[A-Za-z0-9./-]{1,14}$/.test(m.shadeCode)
    && (m.engine === "local" || m.engine === "ai") && /^[a-z]{1,12}$/.test(m.outcome);
}

const pad = (n: number) => String(n).padStart(2, "0");

// Stores one after picture, and the before picture the first time a photo is seen.
// Answers whether the before picture is now on disk, so the phone sends it once.
export async function saveRecord(meta: RecordMeta, after: Buffer, before: Buffer | null, now: Date): Promise<"saved" | "need_before" | "full"> {
  total ??= sizeOf(root());
  const used = await total;
  const adding = after.length + (before?.length ?? 0);
  if (used + adding > MAX_TOTAL_BYTES) return "full";
  const day = now.toISOString().slice(0, 10);
  const dayDir = path.join(root(), day);
  const dir = path.join(dayDir, meta.photoId);
  const existing = await readdir(dir).catch(() => null);
  if (existing === null) {
    if (!before) return "need_before";
    const photos = await readdir(dayDir).catch(() => [] as string[]);
    if (photos.length >= MAX_PHOTOS_PER_DAY) return "full";
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "before.jpg"), before);
  } else if (existing.length >= MAX_FILES_PER_PHOTO) {
    return "full";
  }
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const code = meta.shadeCode.replace(/[^A-Za-z0-9]/g, "-");
  await writeFile(path.join(dir, `${time}_${meta.lineKey}_${code}_${meta.engine}_${meta.outcome}.jpg`), after);
  total = Promise.resolve(used + adding);
  return "saved";
}

export async function recordDays(): Promise<string[]> {
  const all = await readdir(root()).catch(() => [] as string[]);
  return all.filter((d) => DAY.test(d)).sort().reverse();
}

export type RecordedAfter = { name: string; time: string; lineKey: string; code: string; engine: string; outcome: string };
export type RecordedPhoto = { photoId: string; at: number; afters: RecordedAfter[] };

// The photos of one day, newest first, each with its after pictures in the order they were made.
export async function recordsOfDay(day: string): Promise<RecordedPhoto[]> {
  if (!DAY.test(day)) return [];
  const dayDir = path.join(root(), day);
  const photos = (await readdir(dayDir).catch(() => [] as string[])).filter((p) => PHOTO.test(p));
  const out: RecordedPhoto[] = [];
  for (const photoId of photos) {
    const dir = path.join(dayDir, photoId);
    const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => FILE.test(n) && n !== "before.jpg").sort();
    const at = (await stat(dir).catch(() => null))?.birthtimeMs ?? 0;
    out.push({
      photoId,
      at,
      afters: names.map((name) => {
        const [time, lineKey, code, engine, outcome] = name.replace(/\.jpg$/, "").split("_");
        return { name, time: `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`, lineKey, code, engine, outcome };
      }),
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

// One stored picture. Every part of the path is checked against its pattern: nothing else is read.
export async function recordFile(day: string, photoId: string, name: string): Promise<Buffer | null> {
  if (!DAY.test(day) || !PHOTO.test(photoId) || !FILE.test(name)) return null;
  return readFile(path.join(root(), day, photoId, name)).catch(() => null);
}
