import assert from "node:assert/strict";
import { test } from "node:test";
import { decideSession, isBotUserAgent, isClientEventType, isValidEventId, type PrevSession } from "./rules";

const T0 = new Date("2026-11-16T10:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const qrA = { kind: "qr", galleryId: "A", qrTokenId: "ta" } as const;
const qrB = { kind: "qr", galleryId: "B", qrTokenId: "tb" } as const;
const direct = { kind: "direct" } as const;
const prev = (p: Partial<PrevSession>): PrevSession => ({
  id: "s1", origin: "QR", galleryId: "A", qrTokenId: "ta", lastSeenAt: T0, ...p,
});

test("a first QR open starts a QR session and counts one entry", () => {
  assert.deepEqual(decideSession(null, T0, qrA), {
    action: "new", origin: "QR", galleryId: "A", qrTokenId: "ta", countsLanding: true,
  });
});
test("refreshing or rescanning the same gallery inside 30 minutes is not a second entry", () => {
  assert.deepEqual(decideSession(prev({}), at(29), qrA), { action: "reuse", id: "s1" });
});
test("scanning the same gallery after 30 idle minutes is a new entry", () => {
  const d = decideSession(prev({}), at(30), qrA);
  assert.equal(d.action, "new");
  assert.equal(d.action === "new" && d.countsLanding, true);
});
test("scanning another gallery starts a new session for that gallery", () => {
  const d = decideSession(prev({}), at(5), qrB);
  assert.deepEqual(d, { action: "new", origin: "QR", galleryId: "B", qrTokenId: "tb", countsLanding: true });
});
test("a QR scan during a direct session starts a QR session", () => {
  const d = decideSession(prev({ origin: "DIRECT", galleryId: null, qrTokenId: null }), at(5), qrA);
  assert.equal(d.action === "new" && d.origin, "QR");
});
test("activity inside 30 minutes keeps the session", () => {
  assert.deepEqual(decideSession(prev({}), at(29.9), direct), { action: "reuse", id: "s1" });
});
test("after 30 idle minutes a new session keeps the gallery but counts no entry", () => {
  assert.deepEqual(decideSession(prev({}), at(31), direct), {
    action: "new", origin: "QR", galleryId: "A", qrTokenId: "ta", countsLanding: false,
  });
});
test("after 12 hours the gallery is no longer kept", () => {
  assert.deepEqual(decideSession(prev({}), at(12 * 60), direct), {
    action: "new", origin: "DIRECT", galleryId: null, qrTokenId: null, countsLanding: false,
  });
});
test("opening the app without a QR is a direct session of unknown origin", () => {
  assert.deepEqual(decideSession(null, T0, direct), {
    action: "new", origin: "DIRECT", galleryId: null, qrTokenId: null, countsLanding: false,
  });
});
test("a session dated in the future is not trusted", () => {
  assert.equal(decideSession(prev({ lastSeenAt: at(10) }), T0, direct).action, "new");
});
test("robots and link previews are recognised, phones are not", () => {
  assert.equal(isBotUserAgent("WhatsApp/2.23.20.0"), true);
  assert.equal(isBotUserAgent("TelegramBot (like TwitterBot)"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBotUserAgent(""), true);
  assert.equal(isBotUserAgent(null), true);
  assert.equal(
    isBotUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"),
    false,
  );
  assert.equal(
    isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"),
    false,
  );
});
test("the browser cannot send the server's own events", () => {
  assert.equal(isClientEventType("QR_LANDING"), false);
  assert.equal(isClientEventType("SESSION_STARTED"), false);
  assert.equal(isClientEventType("TRYON_SUCCEEDED"), true);
  assert.equal(isValidEventId("abc"), false);
  assert.equal(isValidEventId("0b6f7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b"), true);
});
