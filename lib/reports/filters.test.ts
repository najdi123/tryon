import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, filtersQuery, parseFilters, rangeUtc, tehranDay, tehranDayStart } from "./filters";
import { rankWithTies, share } from "./rank";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-17T10:00:00Z");

test("a Tehran day starts at 20:30 UTC of the day before", () => {
  assert.equal(tehranDayStart("2026-11-17").toISOString(), "2026-11-16T20:30:00.000Z");
  assert.equal(tehranDay(at("2026-11-16T20:29:59Z")), "2026-11-16"); // 23:59 in Tehran
  assert.equal(tehranDay(at("2026-11-16T20:30:00Z")), "2026-11-17"); // midnight in Tehran
});
test("the default view is today and the 29 days before it", () => {
  const f = parseFilters({}, NOW);
  assert.equal(f.preset, "30");
  assert.equal(f.to, "2026-11-17");
  assert.equal(f.from, "2026-10-19");
  assert.equal(addDays(f.from, 29), f.to);
});
test("today is counted up to the moment of the report", () => {
  const r = rangeUtc(parseFilters({ range: "today" }, NOW), NOW);
  assert.equal(r.start.toISOString(), "2026-11-16T20:30:00.000Z");
  assert.equal(r.end.toISOString(), NOW.toISOString());
});
test("a past range ends at the end of its last Tehran day", () => {
  const r = rangeUtc(parseFilters({ range: "custom", from: "2026-11-01", to: "2026-11-03" }, NOW), NOW);
  assert.equal(r.start.toISOString(), "2026-10-31T20:30:00.000Z");
  assert.equal(r.end.toISOString(), "2026-11-03T20:30:00.000Z");
});
test("a custom range is put in order, cannot reach the future and cannot exceed a year", () => {
  const swapped = parseFilters({ range: "custom", from: "2026-11-10", to: "2026-11-02" }, NOW);
  assert.deepEqual([swapped.from, swapped.to], ["2026-11-02", "2026-11-10"]);
  assert.equal(parseFilters({ range: "custom", from: "2026-11-10", to: "2027-01-01" }, NOW).to, "2026-11-17");
  const long = parseFilters({ range: "custom", from: "2020-01-01", to: "2026-11-17" }, NOW);
  assert.equal(long.from, addDays("2026-11-17", -365));
  assert.equal(parseFilters({ range: "custom", from: "nonsense", to: "2026-11-17" }, NOW).preset, "30");
});
test("the export is asked for exactly the screen's filters", () => {
  const f = parseFilters({ range: "7", province: "تهران", line: "bianca", sample: "1" }, NOW);
  assert.deepEqual(parseFilters(Object.fromEntries(new URLSearchParams(filtersQuery(f))), NOW), f);
  const c = parseFilters({ range: "custom", from: "2026-11-01", to: "2026-11-03", gallery: "g1" }, NOW);
  assert.deepEqual(parseFilters(Object.fromEntries(new URLSearchParams(filtersQuery(c))), NOW), c);
});
test("equal values share a rank and the next rank skips", () => {
  const r = rankWithTies([{ n: 5 }, { n: 9 }, { n: 9 }, { n: 2 }], (x) => x.n);
  assert.deepEqual(r.map((x) => x.rank), [1, 1, 3, 4]);
});
test("a share of nothing is a dash, not zero", () => {
  assert.equal(share(3, 0), null);
  assert.equal(share(1, 3), 33.3);
});
