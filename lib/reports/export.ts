// The Excel file for one report. It is built from the same functions and the same filters as the
// screen, so its rows and totals are the screen's. Its head states the filters, the range and
// when it was made.
import ExcelJS from "exceljs";
import { A } from "@/components/admin/copy";
import { db } from "@/lib/db";
import { UNKNOWN, faDay, faMoment, type Filters } from "./filters";
import { byGallery, byProvince, byShade, summary } from "./queries";
import { foldSearch, rankWithTies, share } from "./rank";

export type ReportName = "provinces" | "galleries" | "shades";
export const REPORTS: readonly ReportName[] = ["provinces", "galleries", "shades"];

type Cell = string | number | null;
type Table = { title: string; head: string[]; rows: Cell[][]; total?: Cell[] };

const provinceLabel = (p: string) => (p === UNKNOWN ? A.f.unknownProvince : p);
const pct = (v: number | null): Cell => (v === null ? "—" : v / 100);

export async function reportTable(name: ReportName, f: Filters, now: Date, extra: { q?: string; status?: string } = {}): Promise<Table> {
  if (name === "provinces") {
    const rows = rankWithTies(await byProvince(f, now), (p) => p.successes);
    return {
      title: A.x.provinces,
      head: [A.rank, A.f.province, A.m.activeGalleries, A.m.sessions, A.m.qrEntries, A.m.successes],
      rows: rows.map((p) => [p.rank, provinceLabel(p.province), p.activeGalleries, p.sessions, p.qrEntries, p.successes]),
      total: [null, A.x.total, rows.reduce((a, p) => a + p.activeGalleries, 0), rows.reduce((a, p) => a + p.sessions, 0),
        rows.reduce((a, p) => a + p.qrEntries, 0), rows.reduce((a, p) => a + p.successes, 0)],
    };
  }
  if (name === "galleries") {
    const needle = foldSearch(extra.q ?? "");
    const all = (await byGallery(f, now)).filter((g) =>
      (!needle || foldSearch(g.name).includes(needle) || foldSearch(g.publicId).includes(needle)) &&
      (!extra.status || (g.id !== UNKNOWN && g.status === extra.status)));
    const rows = rankWithTies(all, (g) => g.successes);
    return {
      title: A.x.galleries,
      head: [A.rank, A.gallery, A.galleryId, A.f.province, A.city, A.status, A.m.qrEntries, A.m.sessions, A.m.successes, A.popular],
      rows: rows.map((g) => [
        g.rank, g.id === UNKNOWN ? A.f.unknownGallery : g.name, g.publicId || "—", provinceLabel(g.province), g.city || "—",
        g.id === UNKNOWN ? "—" : g.status === "ACTIVE" ? A.active : A.inactive, g.qrEntries, g.sessions, g.successes,
        g.popular ? `${g.popular.label}${g.popular.tiedWith ? " *" : ""}` : "—",
      ]),
      total: [null, A.x.total, null, null, null, null, rows.reduce((a, g) => a + g.qrEntries, 0),
        rows.reduce((a, g) => a + g.sessions, 0), rows.reduce((a, g) => a + g.successes, 0), null],
    };
  }
  const [shades, s] = await Promise.all([byShade(f, now), summary(f, now)]);
  const rows = rankWithTies(shades, (x) => x.successes);
  return {
    title: A.x.shades,
    head: [A.rank, A.line, A.code, A.shadeName, A.m.selections, A.m.successes, A.share],
    rows: rows.map((x) => [x.rank, x.lineFa, x.code, x.nameFa, x.selections, x.successes, pct(share(x.successes, s.successes))]),
    total: [null, A.x.total, null, null, rows.reduce((a, x) => a + x.selections, 0), rows.reduce((a, x) => a + x.successes, 0), null],
  };
}

async function filterLines(f: Filters, extra: { q?: string; status?: string }): Promise<string[]> {
  const [gallery, line] = await Promise.all([
    f.galleryId && f.galleryId !== UNKNOWN ? db.gallery.findUnique({ where: { id: f.galleryId }, select: { name: true } }) : null,
    f.lineKey ? db.productLine.findUnique({ where: { key: f.lineKey }, select: { nameFa: true } }) : null,
  ]);
  return [
    `${A.f.province}: ${f.province ? provinceLabel(f.province) : A.f.allProvinces}`,
    `${A.f.gallery}: ${f.galleryId === UNKNOWN ? A.f.unknownGallery : (gallery?.name ?? A.f.allGalleries)}`,
    `${A.f.line}: ${line?.nameFa ?? A.f.allLines}`,
    // Anything that changes the rows is stated in the file.
    ...(extra.q ? [`${A.x.search}: ${extra.q}`] : []),
    ...(extra.status ? [`${A.status}: ${extra.status === "ACTIVE" ? A.active : A.inactive}`] : []),
  ];
}

export async function reportWorkbook(name: ReportName, f: Filters, now: Date, extra: { q?: string; status?: string } = {}): Promise<Buffer> {
  const table = await reportTable(name, f, now, extra);
  const wb = new ExcelJS.Workbook();
  wb.created = now;
  const ws = wb.addWorksheet(table.title.slice(0, 31), { views: [{ rightToLeft: true }] });
  const head: string[] = [
    `${A.x.report}: ${table.title}${f.sample ? ` (${A.f.sample})` : ""}`,
    `${A.x.range}: ${A.rangeLine(faDay(f.from), faDay(f.to))}`,
    `${A.x.filters}: ${(await filterLines(f, name === "galleries" ? extra : {})).join(" | ")}`,
    `${A.x.generated}: ${faMoment(now)} ${A.tehranTime}`,
    A.x.note,
  ];
  for (const line of head) ws.addRow([line]);
  ws.addRow([]);
  const headRow = ws.addRow(table.head);
  headRow.font = { bold: true };
  headRow.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECDFC6" } }; });
  for (const r of table.rows) ws.addRow(r);
  if (table.total && table.rows.length > 0) ws.addRow(table.total).font = { bold: true };
  ws.getRow(1).font = { bold: true, size: 13 };
  ws.columns.forEach((col, i) => { col.width = i === 0 ? 8 : 22; });
  if (name === "shades") ws.getColumn(7).numFmt = "0.0%";
  return Buffer.from(await wb.xlsx.writeBuffer());
}
