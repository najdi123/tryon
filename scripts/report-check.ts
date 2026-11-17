// Reads the reports from the database and checks that the cards and the tables agree with each
// other under several filter combinations. Read-only. Run it on the server, beside the database.
//   npx tsx scripts/report-check.ts [sample]
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { parseFilters } = await import("../lib/reports/filters");
  const q = await import("../lib/reports/queries");
  const { reportTable } = await import("../lib/reports/export");
  const now = new Date();
  const sample = process.argv[2] === "sample" ? { sample: "1" } : {};
  const base = parseFilters({ ...sample }, now);
  const options = await q.filterOptions(base);
  const combos: Array<Record<string, string>> = [
    {}, { range: "today" }, { range: "7" }, { range: "90" },
    ...options.provinces.slice(0, 2).map((province) => ({ province })),
    ...options.lines.map((l) => ({ line: l.key })),
    ...(options.provinces[0] && options.lines[0] ? [{ province: options.provinces[0], line: options.lines[0].key, range: "7" }] : []),
    ...(options.galleries[0] ? [{ gallery: options.galleries[0].id }] : []),
  ];
  let failed = 0;
  for (const c of combos) {
    const f = parseFilters({ ...sample, ...c }, now);
    const [s, provinces, galleries, shades, days, lines] = await Promise.all([
      q.summary(f, now), q.byProvince(f, now), q.byGallery(f, now), q.byShade(f, now), q.byDay(f, now), q.byLine(f, now),
    ]);
    const sum = <T,>(rows: T[], k: (r: T) => number) => rows.reduce((a, r) => a + k(r), 0);
    const checks: Array<[string, number, number]> = [
      ["sessions = provinces", s.sessions, sum(provinces, (r) => r.sessions)],
      ["sessions = galleries", s.sessions, sum(galleries, (r) => r.sessions)],
      ["sessions = days", s.sessions, sum(days, (r) => r.sessions)],
      ["QR entries = provinces", s.qrEntries, sum(provinces, (r) => r.qrEntries)],
      ["QR entries = galleries", s.qrEntries, sum(galleries, (r) => r.qrEntries)],
      ["successes = provinces", s.successes, sum(provinces, (r) => r.successes)],
      ["successes = galleries", s.successes, sum(galleries, (r) => r.successes)],
      ["successes = shades", s.successes, sum(shades, (r) => r.successes)],
      ["successes = lines", s.successes, sum(lines, (r) => r.successes)],
      ["successes = days", s.successes, sum(days, (r) => r.successes)],
      ["selections = shades", s.selections, sum(shades, (r) => r.selections)],
      ["active galleries = galleries with a session", s.activeGalleries, galleries.filter((g) => g.publicId !== "" && g.sessions > 0).length],
    ];
    // The Excel table is built from the same rows: its total line must equal the cards.
    const xg = await reportTable("galleries", f, now);
    const xs = await reportTable("shades", f, now);
    if (xg.rows.length) checks.push(["Excel galleries total = successes", s.successes, Number(xg.total?.[8] ?? 0)]);
    if (xs.rows.length) checks.push(["Excel shades total = successes", s.successes, Number(xs.total?.[5] ?? 0)]);
    const bad = checks.filter(([, a, b]) => a !== b);
    failed += bad.length;
    process.stdout.write(`${bad.length ? "FAIL" : "ok  "} ${JSON.stringify(c)} sessions ${s.sessions}, QR ${s.qrEntries}, successes ${s.successes}, shades ${shades.length}\n`);
    for (const [name, a, b] of bad) process.stdout.write(`       ${name}: ${a} vs ${b}\n`);
  }
  process.stdout.write(failed ? `${failed} checks FAILED\n` : `all checks passed over ${combos.length} filter combinations\n`);
  const { db } = await import("../lib/db");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
