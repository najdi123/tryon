import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideSession, eventNeeds, isBotUserAgent, isClientEventType, isRealNavigation, isValidEventId,
  isValidStatus, isValidTokenShape, isValidVisitorId, type PrevSession,
} from "./rules";

const T0 = new Date("2026-11-16T10:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const qrA = { kind: "qr", galleryId: "A", qrTokenId: "ta" } as const;
const qrB = { kind: "qr", galleryId: "B", qrTokenId: "tb" } as const;
const direct = { kind: "direct" } as const;
const invalid = { kind: "invalid_qr" } as const;
const prev = (p: Partial<PrevSession>): PrevSession => ({
  id: "s1", origin: "QR", galleryId: "A", qrTokenId: "ta", qrEnteredAt: T0, lastSeenAt: T0, ...p,
});
const directPrev = (p: Partial<PrevSession> = {}) =>
  prev({ origin: "DIRECT", galleryId: null, qrTokenId: null, qrEnteredAt: null, ...p });
const DIRECT_NEW = {
  action: "new", origin: "DIRECT", galleryId: null, qrTokenId: null, qrEnteredAt: null, carried: false, countsLanding: false,
};

test("a first QR open starts a QR session and counts one entry", () => {
  assert.deepEqual(decideSession(null, T0, qrA), {
    action: "new", origin: "QR", galleryId: "A", qrTokenId: "ta", qrEnteredAt: T0, carried: false, countsLanding: true,
  });
});
test("refreshing or rescanning the same gallery inside 30 minutes is not a second entry", () => {
  assert.deepEqual(decideSession(prev({}), at(29), qrA), { action: "reuse", id: "s1" });
});
test("scanning the same gallery after 30 idle minutes is a new entry", () => {
  const d = decideSession(prev({}), at(30), qrA);
  assert.equal(d.action === "new" && d.countsLanding && !d.carried, true);
});
test("scanning another gallery starts a new session for that gallery", () => {
  const d = decideSession(prev({}), at(5), qrB);
  assert.equal(d.action === "new" && d.galleryId === "B" && d.countsLanding, true);
});
test("a QR scan during a direct session starts a QR session", () => {
  const d = decideSession(directPrev(), at(5), qrA);
  assert.equal(d.action === "new" && d.origin, "QR");
});
test("activity inside 30 minutes keeps the session", () => {
  assert.deepEqual(decideSession(prev({}), at(29.9), direct), { action: "reuse", id: "s1" });
});
test("after 30 idle minutes a new session keeps the gallery, marked carried, and counts no entry", () => {
  assert.deepEqual(decideSession(prev({}), at(31), direct), {
    action: "new", origin: "QR", galleryId: "A", qrTokenId: "ta", qrEnteredAt: T0, carried: true, countsLanding: false,
  });
});
test("the gallery is kept for 12 hours from the scan itself, not from the last visit", () => {
  // a carried session last seen 11 h after the scan; the next visit is 12 h 30 after the scan
  const carried = prev({ lastSeenAt: at(11 * 60) });
  assert.deepEqual(decideSession(carried, at(12 * 60 + 30), direct), DIRECT_NEW);
  assert.equal(decideSession(prev({ lastSeenAt: at(60) }), at(12 * 60 - 1), direct).action, "new");
  const justInside = decideSession(prev({ lastSeenAt: at(60) }), at(12 * 60 - 1), direct);
  assert.equal(justInside.action === "new" && justInside.carried, true);
  assert.deepEqual(decideSession(prev({ lastSeenAt: at(60) }), at(12 * 60), direct), DIRECT_NEW);
});
test("opening the app without a QR is a direct session of unknown origin", () => {
  assert.deepEqual(decideSession(null, T0, direct), DIRECT_NEW);
});
test("an unknown or switched-off QR is never credited to the gallery scanned before", () => {
  assert.deepEqual(decideSession(prev({}), at(5), invalid), DIRECT_NEW); // live QR session of gallery A
  assert.deepEqual(decideSession(prev({}), at(60), invalid), DIRECT_NEW); // inside the carry window
  assert.deepEqual(decideSession(null, T0, invalid), DIRECT_NEW);
  assert.deepEqual(decideSession(directPrev(), at(5), invalid), { action: "reuse", id: "s1" });
});
test("a session dated in the future is not trusted", () => {
  assert.equal(decideSession(prev({ lastSeenAt: at(10) }), T0, direct).action, "new");
});
test("robots and link previews are recognised", () => {
  for (const ua of [
    "WhatsApp/2.23.20.0", "TelegramBot (like TwitterBot)", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1", "meta-externalagent/1.1", "python-httpx/0.27", "curl/8.4.0", "PostmanRuntime/7.39",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36", "", null,
  ]) assert.equal(isBotUserAgent(ua), true, String(ua));
});
test("real phones are not robots, in-app browsers included", () => {
  const chrome = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
  for (const ua of [
    chrome,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    `${chrome} Telegram-Android/11.4.2 (Samsung SM-A546E; Android 14; SDK 34; AVERAGE)`,
    `${chrome} Instagram 355.0.0.31.100 Android (34/14; 450dpi; 1080x2340; samsung; SM-A546E)`,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0;FBBV/1]",
    "Mozilla/5.0 (Linux; Android 11; CUBOT NOTE 20 PRO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    `${chrome} WhatsApp/2.24.1`,
  ]) assert.equal(isBotUserAgent(ua), false, ua);
});
test("only a page navigation is a QR entry", () => {
  assert.equal(isRealNavigation({ dest: "document", mode: "navigate", purpose: null }), true);
  assert.equal(isRealNavigation({ dest: null, mode: null, purpose: null }), true); // an old browser
  assert.equal(isRealNavigation({ dest: "image", mode: "no-cors", purpose: null }), false);
  assert.equal(isRealNavigation({ dest: "document", mode: "navigate", purpose: "prefetch" }), false);
  assert.equal(isRealNavigation({ dest: "empty", mode: "cors", purpose: null }), false);
});
test("the browser cannot send the server's own events, and ids have a shape", () => {
  assert.equal(isClientEventType("QR_LANDING"), false);
  assert.equal(isClientEventType("SESSION_STARTED"), false);
  assert.equal(isClientEventType("TRYON_SUCCEEDED"), true);
  assert.equal(isValidEventId("abc"), false);
  assert.equal(isValidEventId("start:0b6f7c1e"), false); // the server's own prefix cannot be forged
  assert.equal(isValidEventId("0b6f7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b"), true);
  assert.equal(isValidTokenShape("CNem9FU1yrlSY8Z8UNu842Ft"), true);
  assert.equal(isValidTokenShape("short"), false);
  assert.equal(isValidTokenShape("has/slash/in/it/0000000"), false);
  assert.equal(isValidVisitorId("------------------------------------"), false);
  assert.equal(isValidVisitorId("0b6f7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b"), true);
});
test("a status is a machine word, never a phone number", () => {
  assert.equal(isValidStatus("local"), true);
  assert.equal(isValidStatus("bad_photo"), true);
  assert.equal(isValidStatus("09121234567"), false);
  assert.equal(isValidStatus("Ali Rezaei"), false);
});
test("each event names what it is about", () => {
  assert.equal(eventNeeds("PHOTO_READY"), "none");
  assert.equal(eventNeeds("BRAND_SELECTED"), "line");
  assert.equal(eventNeeds("SHADE_SELECTED"), "shade");
  assert.equal(eventNeeds("TRYON_SUCCEEDED"), "shade");
  assert.equal(eventNeeds("RESULT_DOWNLOADED"), "shade");
});
