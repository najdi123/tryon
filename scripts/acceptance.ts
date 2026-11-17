// The delivery tests the brief asks for, against FIXED test data and a running copy of the app.
// It wipes sessions and galleries first, so it refuses any database whose name does not end in
// "_test". The app under test must be started on the same test database.
//   DATABASE_URL=<...ayeneh_test> npx tsx scripts/acceptance.ts http://127.0.0.1:3019
import { createHash, randomBytes, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const BASE = (process.argv[2] ?? "").replace(/\/+$/, "");
const PHONE_UA = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const NAV = { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" };

type Result = { group: string; name: string; ok: boolean; detail: string };
const results: Result[] = [];
let group = "";
function check(name: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  results.push({ group, name, ok: a === b, detail: a === b ? "" : `got ${a}, expected ${b}` });
}

// A browser, as far as the server can tell: a user agent and a cookie jar.
class Browser {
  jar = new Map<string, string>();
  constructor(public ua: string = PHONE_UA) {}
  async go(path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {}) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, {
      method: init.method ?? "GET",
      redirect: "manual",
      body: init.body,
      headers: { "user-agent": this.ua, ...(cookie ? { cookie } : {}), ...init.headers },
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      const value = pair.slice(i + 1);
      if (value === "" || /max-age=0/i.test(line)) this.jar.delete(pair.slice(0, i));
      else this.jar.set(pair.slice(0, i), value);
    }
    return res;
  }
  event(body: Record<string, unknown>) {
    return this.go("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }
}

const FA = "۰۱۲۳۴۵۶۷۸۹";
const latin = (s: string) => s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/٬/g, "");
// The rows of the first table body of a server-rendered page, as plain text cells.
function screenRows(html: string): string[][] {
  const body = /<tbody[^>]*>([\s\S]*?)<\/tbody>/.exec(html)?.[1] ?? "";
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
      latin(c[1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim())));
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const dbName = url.split("?")[0].split("/").pop() ?? "";
  if (!dbName.endsWith("_test")) throw new Error("refusing to run: the database name must end in _test (this script wipes sessions and galleries)");
  if (!/^https?:\/\//.test(BASE)) throw new Error("usage: acceptance.ts <address of the app started on the test database>");

  const { makeClient } = await import("../lib/db");
  const { parseFilters, tehranDay, tehranDayStart, addDays, UNKNOWN } = await import("../lib/reports/filters");
  const q = await import("../lib/reports/queries");
  const { reportTable } = await import("../lib/reports/export");
  const db = makeClient();
  const now = new Date();

  // ─── The fixed data ───────────────────────────────────────────────────────
  await db.session.deleteMany({});
  await db.qrToken.deleteMany({});
  await db.changeLog.deleteMany({});
  await db.gallery.deleteMany({});
  await db.adminUser.deleteMany({ where: { username: { startsWith: "at-" } } });

  // Two product lines that share a shade code, and a second shade in the first line.
  const shades = await db.shade.findMany({ where: { tryOn: true, active: true, hex: { not: null }, line: { active: true } }, include: { line: true }, orderBy: [{ line: { sort: "asc" } }, { sort: "asc" }] });
  const pair = shades.flatMap((a) => shades.filter((b) => b.code === a.code && b.line.sort > a.line.sort).map((b) => [a, b] as const))[0];
  if (!pair) throw new Error("the catalogue has no code shared by two lines: seed the catalogue first");
  const [AX, BX] = pair; // the same code X in line A and in line B
  const AY = shades.find((s) => s.lineId === AX.lineId && s.code !== AX.code)!;
  const noTryOn = await db.shade.findFirst({ where: { tryOn: false }, include: { line: true } });
  const LA = AX.line.key;
  const LB = BX.line.key;

  const mk = (publicId: string, name: string, province: string, city: string, extra: { status?: "INACTIVE"; isSample?: boolean } = {}) =>
    db.gallery.create({ data: { publicId, name, province, city, ...extra, tokens: { create: { token: randomBytes(18).toString("base64url") } } }, include: { tokens: true } });
  const G1 = await mk("AT-1", "گالری آزمون یک", "تهران", "تهران");
  const G2 = await mk("AT-2", "گالری آزمون دو", "فارس", "شیراز");
  const G3 = await mk("AT-3", "گالری آزمون سه", "تهران", "ری", { status: "INACTIVE" });
  const G4 = await mk("AT-4", "گالری آزمون چهار", "گیلان", "رشت");
  const GS = await mk("AT-S", "گالری نمونه آزمون", "تهران", "تهران", { isSample: true });
  const revoked = await db.qrToken.create({ data: { token: randomBytes(18).toString("base64url"), galleryId: G1.id, active: false, revokedAt: now } });

  const D = addDays(tehranDay(now), -10); // a Tehran day in the past
  const D0 = addDays(D, -1);
  const D1 = addDays(D, 1);
  const B = tehranDayStart(D).getTime(); // 00:00 Tehran of day D = 20:30 UTC the evening before
  const H = 3_600_000;
  type Shade = { id: string; lineId: string };
  type Ev = [type: string, shade?: Shade, at?: number];
  const v = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  async function session(at: number, visitorId: string, g: { id: string; tokens: Array<{ id: string }> } | null, events: Ev[], extra: { isTest?: boolean; isBot?: boolean; carried?: boolean } = {}) {
    await db.session.create({
      data: {
        visitorId, origin: g ? "QR" : "DIRECT", galleryId: g?.id ?? null, qrTokenId: g?.tokens[0].id ?? null, qrEnteredAt: g ? new Date(at) : null,
        startedAt: new Date(at), lastSeenAt: new Date(at), ...extra,
        events: {
          create: [["SESSION_STARTED"] as Ev, ...events].map(([type, shade, eventAt]) => ({
            eventId: randomUUID(), type: type as never, galleryId: g?.id ?? null, lineId: shade?.lineId ?? null,
            shadeId: type === "BRAND_SELECTED" ? null : (shade?.id ?? null), createdAt: new Date(eventAt ?? at + 60_000),
          })),
        },
      },
    });
  }
  // s1: the last second of day D-1.  s2: the first instant of day D, the same visitor.
  await session(B - 1000, v[0], G1, [["QR_LANDING"], ["BRAND_SELECTED", AX], ["PHOTO_READY"], ["SHADE_SELECTED", AX], ["TRYON_STARTED", AX], ["TRYON_SUCCEEDED", AX]]);
  await session(B, v[0], G1, [["QR_LANDING"], ["SHADE_SELECTED", BX], ["SHADE_SELECTED", BX], ["TRYON_SUCCEEDED", BX], ["TRYON_SUCCEEDED", BX]]);
  await session(B + H, v[1], G2, [["QR_LANDING"], ["BRAND_SELECTED", AY], ["SHADE_SELECTED", AY], ["TRYON_FAILED", AY]]); // s3
  await session(B + 2 * H, v[2], null, [["SHADE_SELECTED", AX], ["TRYON_SUCCEEDED", AX]]); // s4: no QR
  await session(B + 3 * H, v[3], G3, [["QR_LANDING"], ["TRYON_SUCCEEDED", AY], ["TRYON_SUCCEEDED", BX]]); // s5: two lines, a gallery now inactive
  await session(B + 4 * H, v[0], G1, [], { carried: true }); // s6: carried, no entry
  await session(B + 5 * H, v[4], G1, [["QR_LANDING"], ["TRYON_SUCCEEDED", AX]], { isTest: true }); // s7: staff
  await session(B + 5 * H, v[4], G1, [["QR_LANDING"], ["TRYON_SUCCEEDED", AX]], { isBot: true }); // s8: robot
  await session(B + 6 * H, v[4], GS, [["QR_LANDING"], ["TRYON_SUCCEEDED", AX]]); // s9: a sample gallery
  await session(B + 24 * H - 1000, v[5], G2, [["QR_LANDING"], ["TRYON_SUCCEEDED", AX, B + 24 * H + 10_000]]); // s10: starts 23:59:59, succeeds after midnight
  await session(B + 24 * H, v[6], G2, [["QR_LANDING"]]); // s11: day D+1

  const F = (p: Record<string, string>) => parseFilters({ range: "custom", from: D0, to: D, ...p }, now);
  const sum = <T,>(rows: T[], k: (r: T) => number) => rows.reduce((a, r) => a + k(r), 0);
  // Every card against every table, for one filter set.
  async function agree(label: string, f: ReturnType<typeof F>) {
    const [s, provinces, galleries, byShade, days, lines] = await Promise.all([
      q.summary(f, now), q.byProvince(f, now), q.byGallery(f, now), q.byShade(f, now), q.byDay(f, now), q.byLine(f, now),
    ]);
    const pairs: Array<[string, number, number]> = [
      ["sessions/provinces", s.sessions, sum(provinces, (r) => r.sessions)], ["sessions/galleries", s.sessions, sum(galleries, (r) => r.sessions)],
      ["sessions/days", s.sessions, sum(days, (r) => r.sessions)], ["entries/provinces", s.qrEntries, sum(provinces, (r) => r.qrEntries)],
      ["entries/galleries", s.qrEntries, sum(galleries, (r) => r.qrEntries)], ["successes/provinces", s.successes, sum(provinces, (r) => r.successes)],
      ["successes/galleries", s.successes, sum(galleries, (r) => r.successes)], ["successes/shades", s.successes, sum(byShade, (r) => r.successes)],
      ["successes/lines", s.successes, sum(lines, (r) => r.successes)], ["successes/days", s.successes, sum(days, (r) => r.successes)],
      ["selections/shades", s.selections, sum(byShade, (r) => r.selections)],
    ];
    const bad = pairs.filter(([, a, b]) => a !== b).map(([n, a, b]) => `${n} ${a}/${b}`);
    check(`cards equal tables: ${label}`, bad, []);
    return s;
  }
  const card = (s: Awaited<ReturnType<typeof agree>>) => [s.sessions, s.qrEntries, s.successes, s.selections, s.visitors, s.activeGalleries, s.completedSessions];

  group = "Tehran day boundary";
  check("23:59:59 belongs to the day before", card(await agree("day D-1", F({ from: D0, to: D0 }))), [1, 1, 1, 1, 1, 1, 1]);
  check("00:00:00 opens the new day", card(await agree("day D", F({ from: D, to: D }))), [6, 4, 6, 4, 5, 3, 4]);
  check("a session that crosses midnight stays whole in its start day", card(await agree("day D+1", F({ from: D1, to: D1 }))), [1, 1, 0, 0, 1, 1, 0]);
  check("per-day table", (await q.byDay(F({ from: D0, to: D1 }), now)).map((r) => [r.day, r.sessions, r.qrEntries, r.successes]),
    [[D0, 1, 1, 1], [D, 6, 4, 6], [D1, 1, 1, 0]]);

  group = "Card totals and filter combinations";
  //                                              sessions, QR entries, successes, selections, visitors, active galleries, completed
  check("no filter (staff, robot and sample left out)", card(await agree("no filter", F({}))), [7, 5, 7, 5, 5, 3, 5]);
  check("province", card(await agree("province", F({ province: "تهران" }))), [4, 3, 5, 3, 2, 2, 3]);
  check("second province", card(await agree("province 2", F({ province: "فارس" }))), [2, 2, 1, 1, 2, 1, 1]);
  check("unknown province", card(await agree("unknown province", F({ province: UNKNOWN }))), [1, 0, 1, 1, 1, 0, 1]);
  check("gallery", card(await agree("gallery", F({ gallery: G1.id }))), [3, 2, 3, 3, 1, 1, 2]);
  check("unknown origin", card(await agree("unknown gallery", F({ gallery: UNKNOWN }))), [1, 0, 1, 1, 1, 0, 1]);
  check("brand line A", card(await agree("line A", F({ line: LA }))), [5, 4, 4, 3, 5, 3, 4]);
  check("brand line B", card(await agree("line B", F({ line: LB }))), [2, 2, 3, 2, 2, 2, 2]);
  check("province + brand", card(await agree("province + line", F({ province: "تهران", line: LB }))), [2, 2, 3, 2, 2, 2, 2]);
  check("province + brand with no visits", card(await agree("empty", F({ province: "فارس", line: LB }))), [0, 0, 0, 0, 0, 0, 0]);
  check("gallery + brand", card(await agree("gallery + line", F({ gallery: G1.id, line: LA }))), [1, 1, 1, 1, 1, 1, 1]);
  check("province + gallery + brand", card(await agree("three filters", F({ province: "تهران", gallery: G1.id, line: LB }))), [1, 1, 2, 2, 1, 1, 1]);
  check("sample mode shows only sample galleries", card(await agree("sample", F({ sample: "1" }))), [1, 1, 1, 0, 1, 1, 1]);
  const gRows = await q.byGallery(F({}), now);
  check("gallery table: every registered gallery (zeros too), then unknown origin; no sample gallery",
    gRows.map((g) => [g.publicId, g.sessions, g.qrEntries, g.successes]).sort(),
    [["", 1, 0, 1], ["AT-1", 3, 2, 3], ["AT-2", 2, 2, 1], ["AT-3", 1, 1, 2], ["AT-4", 0, 0, 0]]);
  check("unknown filter lists no registered gallery", (await q.byGallery(F({ gallery: UNKNOWN }), now)).map((g) => g.publicId), [""]);

  group = "Shared codes across brands";
  const sRows = await q.byShade(F({}), now);
  check("the same code in two lines is two rows", sRows.filter((r) => r.code === AX.code).map((r) => [r.lineKey, r.selections, r.successes]),
    [[LA, 2, 3], [LB, 2, 3]]);
  check("all shade rows", sRows.map((r) => [r.lineKey, r.code, r.selections, r.successes]).sort(),
    [[LA, AX.code, 2, 3], [LA, AY.code, 1, 1], [LB, BX.code, 2, 3]].sort());
  check("brand filter counts that line's shade only", (await q.byShade(F({ line: LB }), now)).map((r) => [r.lineKey, r.code, r.successes]), [[LB, BX.code, 3]]);

  // ─── The running app ──────────────────────────────────────────────────────
  const rows = (visitorId: string) => db.session.findMany({ where: { visitorId }, orderBy: { startedAt: "asc" }, include: { events: true } });
  const count = (s: { events: Array<{ type: string }> }, type: string) => s.events.filter((e) => e.type === type).length;
  const token1 = G1.tokens[0].token;

  group = "QR to output";
  const p = new Browser();
  const open = await p.go(`/q/${token1}`, { headers: NAV });
  check("the QR link opens the app", [open.status, open.headers.get("location")], [307, "/"]);
  const vid = p.jar.get("ar_vid") ?? "";
  let mine = await rows(vid);
  if (mine.length === 0) throw new Error(`the app at ${BASE} is not using the test database (no session appeared): stopped`);
  check("one session for the gallery, one QR entry", [mine.length, mine[0].origin, mine[0].galleryId === G1.id, count(mine[0], "QR_LANDING"), count(mine[0], "SESSION_STARTED")], [1, "QR", true, 1, 1]);
  await p.go(`/q/${token1}`, { headers: NAV });
  await p.go(`/q/${token1}`, { headers: NAV });
  mine = await rows(vid);
  check("opening the link again is not a second entry", [mine.length, count(mine[0], "QR_LANDING")], [1, 1]);
  check("the app is told its gallery", (await (await p.go("/api/session")).json()).gallery, { name: G1.name, city: G1.city });
  const send = async (type: string, extra: Record<string, unknown> = {}) => (await p.event({ eventId: randomUUID(), type, ...extra })).status;
  const flow = [
    await send("BRAND_SELECTED", { lineKey: LA }), await send("PHOTO_READY"), await send("SHADE_SELECTED", { lineKey: LA, shadeCode: AX.code }),
    await send("TRYON_STARTED", { lineKey: LA, shadeCode: AX.code, status: "local" }),
    await send("TRYON_SUCCEEDED", { lineKey: LA, shadeCode: AX.code, status: "local", galleryId: G2.id }), // a browser cannot name another gallery
    await send("RESULT_DOWNLOADED", { lineKey: LA, shadeCode: AX.code }),
  ];
  check("every step is accepted", flow, [200, 200, 200, 200, 200, 200]);
  mine = await rows(vid);
  check("all steps are in one session, credited to the scanned gallery", [mine.length, mine[0].events.length, mine[0].events.every((e) => e.galleryId === G1.id)], [1, 8, true]);
  check("the shade is stored with its own line", mine[0].events.filter((e) => e.type === "TRYON_SUCCEEDED").map((e) => [e.lineId === AX.lineId, e.shadeId === AX.id]), [[true, true]]);
  const today = parseFilters({ range: "today", gallery: G1.id }, new Date());
  check("the visit shows in today's report", card(await q.summary(today, new Date())).slice(0, 4), [1, 1, 1, 1]);

  group = "Duplicate events";
  const dup = randomUUID();
  const first = await p.event({ eventId: dup, type: "SHADE_SELECTED", lineKey: LA, shadeCode: AX.code });
  const again = await p.event({ eventId: dup, type: "SHADE_SELECTED", lineKey: LA, shadeCode: AX.code });
  check("a resent event is accepted and stored once", [first.status, again.status, await db.analyticsEvent.count({ where: { eventId: dup } })], [200, 200, 1]);
  const burst = randomUUID();
  const statuses = await Promise.all(Array.from({ length: 8 }, () => p.event({ eventId: burst, type: "SHADE_SELECTED", lineKey: LA, shadeCode: AX.code }).then((r) => r.status)));
  check("eight copies at the same moment are stored once", [statuses.every((s) => s === 200), await db.analyticsEvent.count({ where: { eventId: burst } })], [true, 1]);
  const fresh = new Browser();
  fresh.jar.set("ar_vid", randomUUID());
  await Promise.all(Array.from({ length: 6 }, () => fresh.go("/api/session")));
  check("six requests at once from a new browser open one session", (await rows(fresh.jar.get("ar_vid")!)).length, 1);
  const full = await rows(vid);
  await db.analyticsEvent.createMany({ data: Array.from({ length: 500 - full[0].events.length - 2 }, () => ({ eventId: randomUUID(), type: "PHOTO_READY" as const, sessionId: full[0].id, galleryId: G1.id })) });
  check("one session cannot add events without end (limit 500)", [await send("PHOTO_READY"), await send("PHOTO_READY"), await send("PHOTO_READY")], [200, 200, 429]);
  await db.analyticsEvent.deleteMany({ where: { sessionId: full[0].id, type: "PHOTO_READY" } });

  group = "Sessions and gallery credit";
  await db.session.updateMany({ where: { visitorId: vid }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } });
  await p.go("/api/session");
  mine = await rows(vid);
  check("after 30 idle minutes: a new session, same gallery, no new QR entry", [mine.length, mine[1].galleryId === G1.id, mine[1].carried, count(mine[1], "QR_LANDING")], [2, true, true, 0]);
  await db.session.updateMany({ where: { visitorId: vid }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000), qrEnteredAt: new Date(Date.now() - 13 * H) } });
  await p.go("/api/session");
  mine = await rows(vid);
  check("12 hours after the scan: unknown origin", [mine.length, mine[2].origin, mine[2].galleryId], [3, "DIRECT", null]);
  await p.go(`/q/${G2.tokens[0].token}`, { headers: NAV });
  mine = await rows(vid);
  check("scanning another gallery starts its own session and entry", [mine.length, mine[3].galleryId === G2.id, count(mine[3], "QR_LANDING")], [4, true, 1]);
  await p.go(`/q/${randomBytes(18).toString("base64url")}`, { headers: NAV });
  mine = await rows(vid);
  check("an unknown QR never credits the gallery scanned before", [mine.length, mine[4].origin, mine[4].galleryId], [5, "DIRECT", null]);
  for (const [label, t] of [["a revoked QR", revoked.token], ["the QR of an inactive gallery", G3.tokens[0].token], ["a malformed QR", "x"]] as const) {
    const b = new Browser();
    const r = await b.go(`/q/${t}`, { headers: NAV });
    const s = await rows(b.jar.get("ar_vid") ?? "");
    check(`${label} opens the app as unknown origin`, [r.status, s.length, s[0]?.origin, s[0]?.galleryId, s[0] ? count(s[0], "QR_LANDING") : -1], [307, 1, "DIRECT", null, 0]);
  }
  const before = await db.session.count();
  const quiet: Array<[string, Browser, Record<string, string>]> = [
    ["a search robot", new Browser("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), NAV],
    ["a Telegram link preview", new Browser("TelegramBot (like TwitterBot)"), NAV],
    ["no user agent", new Browser(""), NAV],
    ["a browser prefetch", new Browser(), { ...NAV, "sec-purpose": "prefetch" }],
    ["an image tag on another page", new Browser(), { "sec-fetch-dest": "image", "sec-fetch-mode": "no-cors" }],
  ];
  for (const [label, b, headers] of quiet) {
    const r = await b.go(`/q/${token1}`, { headers });
    check(`${label} counts nothing`, [r.status, b.jar.size, (await db.session.count()) - before], [307, 0, 0]);
  }

  group = "Events the server refuses";
  const e = async (body: Record<string, unknown>, b: Browser = p) => {
    const r = await b.event({ eventId: randomUUID(), ...body });
    return [r.status, r.status === 200 ? "" : ((await r.json().catch(() => ({}))) as { error?: string }).error ?? ""];
  };
  check("a browser cannot claim a picture the server made", await e({ type: "TRYON_SUCCEEDED", lineKey: LA, shadeCode: AX.code, status: "ai" }), [400, "server_event"]);
  check("nor a try-on with no status", await e({ type: "TRYON_SUCCEEDED", lineKey: LA, shadeCode: AX.code }), [400, "server_event"]);
  check("server-only event types are refused", [await e({ type: "QR_LANDING" }), await e({ type: "SESSION_STARTED" })], [[400, "bad_event"], [400, "bad_event"]]);
  check("an unknown shade", await e({ type: "SHADE_SELECTED", lineKey: LA, shadeCode: "0-none" }), [400, "unknown_shade"]);
  check("an unknown line", await e({ type: "BRAND_SELECTED", lineKey: "no-such-line" }), [400, "unknown_line"]);
  check("a shade without its line", await e({ type: "SHADE_SELECTED", shadeCode: AX.code }), [400, "line_required"]);
  if (noTryOn) check("a product that is not a hair colour (corrector, lightener)", await e({ type: "SHADE_SELECTED", lineKey: noTryOn.line.key, shadeCode: noTryOn.code }), [400, "unknown_shade"]);
  check("free text in the status (a phone number)", await e({ type: "PHOTO_READY", status: "09121234567" }), [400, "bad_status"]);
  check("an event from a browser the app never opened", await e({ type: "PHOTO_READY" }, new Browser()), [409, "no_session"]);
  const verdict = await p.go("/api/tryon/verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: randomUUID(), verdict: "accepted" }) });
  check("a success for a picture that was never started", verdict.status, 404);
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
  const tryOn = async (b: Browser, consent: boolean) => {
    const fd = new FormData();
    fd.set("image", jpeg, "p.jpg"); fd.set("lineKey", LA); fd.set("shadeCode", AX.code); fd.set("attemptId", randomUUID());
    if (consent) fd.set("consent", "yes");
    const r = await b.go("/api/tryon", { method: "POST", body: fd });
    return [r.status, ((await r.json().catch(() => ({}))) as { error?: string }).error ?? ""];
  };
  const engineOn = (await tryOn(p, false))[0] !== 503;
  if (engineOn) {
    check("no photo is accepted without consent", await tryOn(p, false), [400, "consent_required"]);
    // 30 pictures already made today by this browser: the next is refused before the image service is called.
    const live = (await rows(vid)).at(-1)!;
    await db.analyticsEvent.createMany({ data: Array.from({ length: 30 }, () => ({ eventId: randomUUID(), type: "TRYON_STARTED" as const, status: "ai", sessionId: live.id, lineId: AX.lineId, shadeId: AX.id })) });
    check("the daily picture limit per browser holds", await tryOn(p, true), [429, "daily_limit"]);
    await db.analyticsEvent.deleteMany({ where: { sessionId: live.id, type: "TRYON_STARTED", status: "ai" } });
  } else {
    results.push({ group, name: "consent and daily limit of the image service", ok: true, detail: "SKIPPED: the app has no image service key" });
  }

  group = "Access without permission";
  const staff = async (username: string, role: "ADMIN" | "VIEWER", o: { active?: boolean; expired?: boolean } = {}) => {
    const u = await db.adminUser.create({ data: { username, displayName: username, role, passwordHash: "none", active: o.active ?? true } });
    const raw = randomBytes(32).toString("base64url");
    await db.adminSession.create({ data: { tokenHash: createHash("sha256").update(raw).digest("hex"), adminUserId: u.id, expiresAt: new Date(Date.now() + (o.expired ? -1000 : H)) } });
    const b = new Browser();
    b.jar.set("ar_admin", raw);
    return b;
  };
  const admin = await staff("at-admin", "ADMIN");
  const viewer = await staff("at-viewer", "VIEWER");
  const nobody = new Browser();
  const forged = new Browser();
  forged.jar.set("ar_admin", randomBytes(32).toString("base64url"));
  const to = async (b: Browser, path: string) => {
    const r = await b.go(path);
    return r.status >= 300 && r.status < 400 ? new URL(r.headers.get("location") ?? "", BASE).pathname + new URL(r.headers.get("location") ?? "", BASE).search : String(r.status);
  };
  const PAGES = ["/admin", "/admin/galleries", "/admin/shades", "/admin/catalog", "/admin/settings", "/admin/galleries/new", `/admin/galleries/${G1.id}`];
  for (const [label, b] of [["no login", nobody], ["a made-up login cookie", forged], ["an expired login", await staff("at-expired", "ADMIN", { expired: true })], ["a switched-off user", await staff("at-off", "ADMIN", { active: false })]] as const) {
    const got: string[] = [];
    for (const path of PAGES) got.push(await to(b, path));
    check(`${label}: every panel page sends to the login`, [...new Set(got)], ["/admin/login"]);
    check(`${label}: no Excel, no QR file`, [await to(b, "/admin/export?report=shades"), await to(b, `/admin/galleries/${G1.id}/qr?format=png`)], ["401", "401"]);
  }
  check("viewer: reports open", [await to(viewer, "/admin"), await to(viewer, "/admin/galleries"), await to(viewer, "/admin/shades"), await to(viewer, "/admin/export?report=shades")], ["200", "200", "200", "200"]);
  check("viewer: catalogue, settings and new gallery are refused", [await to(viewer, "/admin/catalog"), await to(viewer, "/admin/settings"), await to(viewer, "/admin/galleries/new")],
    ["/admin?denied=1", "/admin?denied=1", "/admin?denied=1"]);
  check("admin: every page opens", [...new Set(await Promise.all(PAGES.map((path) => to(admin, path))))], ["200"]);
  await admin.go(`/q/${G4.tokens[0].token}`, { headers: NAV });
  const staffVisit = await rows(admin.jar.get("ar_vid") ?? "");
  check("a signed-in staff member's own visit is marked as a test", [staffVisit.length, staffVisit[0]?.isTest], [1, true]);
  check("and is left out of the report", card(await q.summary(parseFilters({ range: "today", gallery: G4.id }, new Date()), new Date())).slice(0, 3), [0, 0, 0]);

  group = "Excel equals the screen";
  const range = `range=custom&from=${D0}&to=${D}`;
  async function excel(path: string) {
    const r = await admin.go(path);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.arrayBuffer());
    const out: string[][] = [];
    wb.worksheets[0].eachRow((row) => out.push((row.values as unknown[]).slice(1).map((c) => (c === null || c === undefined ? "" : String(c)))));
    const head = out.findIndex((r2) => r2.length > 3);
    return { status: r.status, intro: out.slice(0, head).map((r2) => r2[0] ?? ""), head: out[head], body: out.slice(head + 1) };
  }
  const key = (r: string[]) => r.join(" | ");
  for (const [label, query] of [["no filter", ""], ["province", `&province=${encodeURIComponent("تهران")}`], ["brand", `&line=${LA}`], ["unknown origin", "&gallery=__unknown__"]] as const) {
    const xs = await excel(`/admin/export?report=shades&${range}${query}`);
    const total = xs.body.at(-1) ?? [];
    const screen = screenRows(await (await admin.go(`/admin/shades?${range}${query}`)).text());
    // screen and file: rank, line, code, name, selections, successes (the last column is a percentage, formatted differently)
    check(`shades, ${label}: the file's rows are the screen's rows`, xs.body.slice(0, -1).map((r) => key(r.slice(0, 6))), screen.map((r) => key(r.slice(0, 6))));
    const f = parseFilters(Object.fromEntries(new URLSearchParams(`${range}${query}`)), now);
    const s = await q.summary(f, now);
    check(`shades, ${label}: the file's total line is the cards' numbers`, [Number(total[4]), Number(total[5])], [s.selections, s.successes]);

    const xg = await excel(`/admin/export?report=galleries&${range}${query}`);
    const gTotal = xg.body.at(-1) ?? [];
    const gScreen = screenRows(await (await admin.go(`/admin/galleries?${range}${query}`)).text());
    // file: rank, name, id, province, city, status, entries, sessions, successes. screen: rank, name, id, province+city, status, entries, sessions, successes
    check(`galleries, ${label}: the file's rows are the screen's rows`,
      xg.body.slice(0, -1).map((r) => key([r[0], r[1], r[2], r[5], r[6], r[7], r[8]])), gScreen.map((r) => key([r[0], r[1], r[2], r[4], r[5], r[6], r[7]])));
    check(`galleries, ${label}: the file's total line is the cards' numbers`, [Number(gTotal[6]), Number(gTotal[7]), Number(gTotal[8])], [s.qrEntries, s.sessions, s.successes]);

    const xp = await reportTable("provinces", f, now);
    const xpFile = await excel(`/admin/export?report=provinces&${range}${query}`);
    check(`provinces, ${label}: the file equals the report`, xpFile.body.map((r) => key(r.map((c) => c))), [...xp.rows, xp.total ?? []].map((r) => key(r.map((c) => (c === null ? "" : String(c))))));
  }
  const stated = await excel(`/admin/export?report=galleries&${range}&province=${encodeURIComponent("تهران")}&line=${LA}&status=ACTIVE&q=AT`);
  const intro = stated.intro.join("\n");
  check("the file states its range, filters and time of making",
    [intro.includes("تهران"), intro.includes(AX.line.nameFa), intro.includes("AT"), stated.intro.length >= 4], [true, true, true, true]);
  check("a search and a status filter change the file as they change the screen",
    stated.body.slice(0, -1).map((r) => r[2]), screenRows(await (await admin.go(`/admin/galleries?${range}&province=${encodeURIComponent("تهران")}&line=${LA}&status=ACTIVE&q=AT`)).text()).map((r) => r[2]));

  // ─── The result ───────────────────────────────────────────────────────────
  let last = "";
  for (const r of results) {
    if (r.group !== last) process.stdout.write(`\n${r.group}\n`);
    last = r.group;
    process.stdout.write(`  ${r.ok ? (r.detail ? "skip" : "ok  ") : "FAIL"}  ${r.name}${r.detail ? `\n          ${r.detail}` : ""}\n`);
  }
  const failed = results.filter((r) => !r.ok).length;
  process.stdout.write(`\n${results.length - failed} of ${results.length} checks passed${failed ? `, ${failed} FAILED` : ""}\n`);
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
