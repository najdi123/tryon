// The report's numbers. One rule decides what every card and every table counts:
//
//   A report is a set of valid sessions: sessions that STARTED inside the range (Tehran days),
//   were not staff tests and not robots, and match the filters. Everything shown is counted from
//   those sessions and their events, and from nothing else.
//
// So the cards, the tables and the export always agree with each other, and a session that
// starts at 23:59 belongs, whole, to that day. With a brand filter, a session counts when it has
// at least one event for that line, and shade and try-on events are counted for that line only.
// Real galleries and sample galleries are never mixed: the report shows one or the other.
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { UNKNOWN, rangeUtc, type Filters } from "./filters";

const n = (v: unknown) => Number(v ?? 0);

function scope(f: Filters, now: Date): Prisma.Sql {
  const { start, end } = rangeUtc(f, now);
  const conds: Prisma.Sql[] = [
    Prisma.sql`s."isTest" = false`,
    Prisma.sql`s."isBot" = false`,
    Prisma.sql`s."startedAt" >= ${start}`,
    Prisma.sql`s."startedAt" < ${end}`,
    f.sample ? Prisma.sql`g."isSample" = true` : Prisma.sql`(g.id IS NULL OR g."isSample" = false)`,
  ];
  if (f.province === UNKNOWN) conds.push(Prisma.sql`g.id IS NULL`);
  else if (f.province) conds.push(Prisma.sql`g.province = ${f.province}`);
  if (f.galleryId === UNKNOWN) conds.push(Prisma.sql`s."galleryId" IS NULL`);
  else if (f.galleryId) conds.push(Prisma.sql`s."galleryId" = ${f.galleryId}`);
  if (f.lineKey) {
    conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "AnalyticsEvent" x JOIN "ProductLine" xl ON xl.id = x."lineId"
      WHERE x."sessionId" = s.id AND xl.key = ${f.lineKey})`);
  }
  const lineOnly = f.lineKey
    ? Prisma.sql`AND (e."lineId" IS NULL OR e."lineId" = (SELECT id FROM "ProductLine" WHERE key = ${f.lineKey}))`
    : Prisma.empty;
  return Prisma.sql`WITH vs AS (
      SELECT s.id, s."visitorId", s."galleryId", s."startedAt"
      FROM "Session" s LEFT JOIN "Gallery" g ON g.id = s."galleryId"
      WHERE ${Prisma.join(conds, " AND ")}
    ), ev AS (
      SELECT e.type, e."sessionId", e."shadeId", e."lineId", v."galleryId"
      FROM "AnalyticsEvent" e JOIN vs v ON v.id = e."sessionId"
      WHERE true ${lineOnly}
    )`;
}

export type Summary = {
  sessions: number;
  visitors: number; // browsers, an estimate of people
  activeGalleries: number;
  qrEntries: number;
  successes: number;
  selections: number;
  completedSessions: number; // sessions with at least one successful try-on
};

export async function summary(f: Filters, now: Date): Promise<Summary> {
  const [r] = await db.$queryRaw<Array<Record<string, bigint>>>(Prisma.sql`${scope(f, now)}
    SELECT (SELECT count(*) FROM vs) AS sessions,
      (SELECT count(DISTINCT "visitorId") FROM vs) AS visitors,
      (SELECT count(DISTINCT "galleryId") FROM vs WHERE "galleryId" IS NOT NULL) AS galleries,
      (SELECT count(*) FROM ev WHERE type = 'QR_LANDING') AS entries,
      (SELECT count(*) FROM ev WHERE type = 'TRYON_SUCCEEDED') AS successes,
      (SELECT count(*) FROM ev WHERE type = 'SHADE_SELECTED') AS selections,
      (SELECT count(DISTINCT "sessionId") FROM ev WHERE type = 'TRYON_SUCCEEDED') AS completed`);
  return {
    sessions: n(r.sessions), visitors: n(r.visitors), activeGalleries: n(r.galleries), qrEntries: n(r.entries),
    successes: n(r.successes), selections: n(r.selections), completedSessions: n(r.completed),
  };
}

export type ProvinceRow = { province: string; activeGalleries: number; sessions: number; qrEntries: number; successes: number };

// One row per province of the galleries; visits without a valid QR are their own row (UNKNOWN).
export async function byProvince(f: Filters, now: Date): Promise<ProvinceRow[]> {
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${scope(f, now)}
    SELECT coalesce(g.province, ${UNKNOWN}) AS province,
      count(DISTINCT v."galleryId") AS galleries, count(DISTINCT v.id) AS sessions,
      count(*) FILTER (WHERE e.type = 'QR_LANDING') AS entries,
      count(*) FILTER (WHERE e.type = 'TRYON_SUCCEEDED') AS successes
    FROM vs v LEFT JOIN "Gallery" g ON g.id = v."galleryId" LEFT JOIN ev e ON e."sessionId" = v.id
    GROUP BY 1`);
  return rows.map((r) => ({
    province: String(r.province), activeGalleries: n(r.galleries), sessions: n(r.sessions), qrEntries: n(r.entries), successes: n(r.successes),
  }));
}

export type GalleryRow = {
  id: string; // a gallery id, or UNKNOWN
  publicId: string;
  name: string;
  province: string;
  city: string;
  status: "ACTIVE" | "INACTIVE";
  sessions: number;
  qrEntries: number;
  successes: number;
  popular: { label: string; successes: number; tiedWith: number } | null; // tiedWith: other shades with the same count
};

// Every registered gallery the filters allow, with its numbers (zeros included), then the
// unknown-origin row when it has any session.
export async function byGallery(f: Filters, now: Date): Promise<GalleryRow[]> {
  const galleries = await db.gallery.findMany({
    where: {
      isSample: f.sample,
      ...(f.province && f.province !== UNKNOWN ? { province: f.province } : {}),
      ...(f.galleryId && f.galleryId !== UNKNOWN ? { id: f.galleryId } : {}),
    },
    orderBy: { name: "asc" },
  });
  const agg = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${scope(f, now)}
    SELECT v."galleryId" AS gid, count(DISTINCT v.id) AS sessions,
      count(*) FILTER (WHERE e.type = 'QR_LANDING') AS entries,
      count(*) FILTER (WHERE e.type = 'TRYON_SUCCEEDED') AS successes
    FROM vs v LEFT JOIN ev e ON e."sessionId" = v.id GROUP BY 1`);
  const top = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${scope(f, now)}
    SELECT e."galleryId" AS gid, pl."nameEn" AS line, sh.code, count(*) AS successes
    FROM ev e JOIN "Shade" sh ON sh.id = e."shadeId" JOIN "ProductLine" pl ON pl.id = sh."lineId"
    WHERE e.type = 'TRYON_SUCCEEDED' GROUP BY 1, 2, 3`);
  const numbers = new Map(agg.map((r) => [r.gid === null ? UNKNOWN : String(r.gid), r]));
  const popular = new Map<string, GalleryRow["popular"]>();
  for (const r of top) {
    const key = r.gid === null ? UNKNOWN : String(r.gid);
    const cur = popular.get(key);
    const c = n(r.successes);
    if (!cur || c > cur.successes) popular.set(key, { label: `${String(r.line)} ${String(r.code)}`, successes: c, tiedWith: 0 });
    else if (c === cur.successes) cur.tiedWith += 1;
  }
  const row = (id: string, g: { publicId: string; name: string; province: string; city: string; status: "ACTIVE" | "INACTIVE" }): GalleryRow => {
    const a = numbers.get(id);
    return { id, ...g, sessions: n(a?.sessions), qrEntries: n(a?.entries), successes: n(a?.successes), popular: popular.get(id) ?? null };
  };
  const out = galleries.map((g) => row(g.id, { publicId: g.publicId, name: g.name, province: g.province, city: g.city, status: g.status }));
  const unknownAllowed = !f.sample && (!f.province || f.province === UNKNOWN) && (!f.galleryId || f.galleryId === UNKNOWN);
  if (unknownAllowed && numbers.has(UNKNOWN)) out.push(row(UNKNOWN, { publicId: "", name: "", province: UNKNOWN, city: "", status: "ACTIVE" }));
  return out;
}

export type ShadeRow = {
  shadeId: string;
  lineKey: string;
  lineFa: string;
  lineEn: string;
  code: string;
  nameFa: string;
  selections: number;
  successes: number;
};

// The same code in two lines is two rows: a shade is its line and its code together.
export async function byShade(f: Filters, now: Date): Promise<ShadeRow[]> {
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${scope(f, now)}
    SELECT sh.id, pl.key AS line_key, pl."nameFa" AS line_fa, pl."nameEn" AS line_en, sh.code, sh."nameFa" AS name_fa,
      count(*) FILTER (WHERE e.type = 'SHADE_SELECTED') AS selections,
      count(*) FILTER (WHERE e.type = 'TRYON_SUCCEEDED') AS successes
    FROM ev e JOIN "Shade" sh ON sh.id = e."shadeId" JOIN "ProductLine" pl ON pl.id = sh."lineId"
    WHERE e.type IN ('SHADE_SELECTED', 'TRYON_SUCCEEDED')
    GROUP BY sh.id, pl.key, pl."nameFa", pl."nameEn", sh.code, sh."nameFa"`);
  return rows.map((r) => ({
    shadeId: String(r.id), lineKey: String(r.line_key), lineFa: String(r.line_fa), lineEn: String(r.line_en),
    code: String(r.code), nameFa: String(r.name_fa), selections: n(r.selections), successes: n(r.successes),
  }));
}

export type DayRow = { day: string; sessions: number; qrEntries: number; successes: number };

// Per Tehran day of the session's start. Days with nothing are absent; the page fills them in.
export async function byDay(f: Filters, now: Date): Promise<DayRow[]> {
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${scope(f, now)}
    SELECT to_char((v."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran', 'YYYY-MM-DD') AS day,
      count(DISTINCT v.id) AS sessions,
      count(*) FILTER (WHERE e.type = 'QR_LANDING') AS entries,
      count(*) FILTER (WHERE e.type = 'TRYON_SUCCEEDED') AS successes
    FROM vs v LEFT JOIN ev e ON e."sessionId" = v.id GROUP BY 1 ORDER BY 1`);
  return rows.map((r) => ({ day: String(r.day), sessions: n(r.sessions), qrEntries: n(r.entries), successes: n(r.successes) }));
}

export type LineRow = { lineKey: string; lineFa: string; lineEn: string; successes: number };

export async function byLine(f: Filters, now: Date): Promise<LineRow[]> {
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${scope(f, now)}
    SELECT pl.key, pl."nameFa" AS fa, pl."nameEn" AS en, count(*) AS successes
    FROM ev e JOIN "ProductLine" pl ON pl.id = e."lineId"
    WHERE e.type = 'TRYON_SUCCEEDED' GROUP BY 1, 2, 3 ORDER BY 4 DESC`);
  return rows.map((r) => ({ lineKey: String(r.key), lineFa: String(r.fa), lineEn: String(r.en), successes: n(r.successes) }));
}

// What the filter bar offers. A chosen province narrows the gallery list.
export async function filterOptions(f: Filters) {
  const [galleries, lines] = await Promise.all([
    db.gallery.findMany({ where: { isSample: f.sample }, select: { id: true, name: true, province: true }, orderBy: { name: "asc" } }),
    db.productLine.findMany({ select: { key: true, nameFa: true }, orderBy: { sort: "asc" } }),
  ]);
  const provinces = [...new Set(galleries.map((g) => g.province))].sort((a, b) => a.localeCompare(b, "fa"));
  const inProvince = f.province && f.province !== UNKNOWN ? galleries.filter((g) => g.province === f.province) : galleries;
  return { provinces, galleries: inProvince.map((g) => ({ id: g.id, name: g.name })), lines };
}
