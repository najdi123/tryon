// The report's filters and its time range, as pure functions. Days are Tehran days.
// Tehran has been UTC+03:30 all year since 2022 (no daylight saving).

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RANGE_DAYS = 366;
export const UNKNOWN = "__unknown__"; // the "unknown origin" group: visits that came without a valid QR

export type RangePreset = "today" | "7" | "30" | "90" | "custom";

export type Filters = {
  preset: RangePreset;
  from: string; // first Tehran day, YYYY-MM-DD
  to: string; // last Tehran day, inclusive
  province: string | null; // a province name, or UNKNOWN
  galleryId: string | null; // a gallery id, or UNKNOWN
  lineKey: string | null;
  sample: boolean; // true: only sample galleries, shown as sample mode
};

export function tehranDay(at: Date): string {
  return new Date(at.getTime() + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

// The instant a Tehran day starts, in UTC.
export function tehranDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - TEHRAN_OFFSET_MS);
}

const isDay = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, k: string) => (typeof p[k] === "string" && p[k] !== "" ? (p[k] as string) : null);

// The default view is the last 30 days: today and the 29 days before it, Tehran time.
export function parseFilters(p: Params, now: Date): Filters {
  const today = tehranDay(now);
  const asked = (["today", "7", "30", "90", "custom"] as const).find((x) => x === one(p, "range")) ?? "30";
  const custom = asked === "custom" && isDay(p.from) && isDay(p.to);
  const preset: RangePreset = asked === "custom" && !custom ? "30" : asked;
  let from = today;
  let to = today;
  if (custom) {
    const a = p.from as string;
    const b = p.to as string;
    from = a <= b ? a : b;
    to = a <= b ? b : a;
    if (to > today) to = today;
    if (from > to) from = to;
    if (Date.parse(to) - Date.parse(from) > (MAX_RANGE_DAYS - 1) * DAY_MS) from = addDays(to, -(MAX_RANGE_DAYS - 1));
  } else {
    const days = preset === "today" ? 1 : Number(preset);
    from = addDays(today, -(days - 1));
  }
  return {
    preset,
    from,
    to,
    province: one(p, "province"),
    galleryId: one(p, "gallery"),
    lineKey: one(p, "line"),
    sample: one(p, "sample") === "1",
  };
}

// The half-open UTC interval the report reads. Today is counted up to the moment of the report.
export function rangeUtc(f: Filters, now: Date): { start: Date; end: Date } {
  const start = tehranDayStart(f.from);
  const dayAfter = tehranDayStart(addDays(f.to, 1));
  return { start, end: dayAfter.getTime() > now.getTime() ? now : dayAfter };
}

// The filters as a query string, for links and for the export: the file is asked for exactly
// what the screen shows.
export function filtersQuery(f: Filters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  q.set("range", f.preset);
  if (f.preset === "custom") {
    q.set("from", f.from);
    q.set("to", f.to);
  }
  if (f.province) q.set("province", f.province);
  if (f.galleryId) q.set("gallery", f.galleryId);
  if (f.lineKey) q.set("line", f.lineKey);
  if (f.sample) q.set("sample", "1");
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}

const noon = (day: string) => new Date(tehranDayStart(day).getTime() + 12 * 60 * 60 * 1000);
const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric" });
const faDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
});
const faShort = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", month: "numeric", day: "numeric" });

export const faDay = (day: string) => faDate.format(noon(day));
export const faDayShort = (day: string) => faShort.format(noon(day));
export const faMoment = (at: Date) => faDateTime.format(at);
