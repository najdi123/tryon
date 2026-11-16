// The counting rules, as pure functions. Everything here is decided on the server.

export const SESSION_IDLE_MS = 30 * 60 * 1000; // a session ends after 30 minutes without activity
export const GALLERY_CARRY_MS = 12 * 60 * 60 * 1000; // an idle visitor keeps their gallery this long

export const VISITOR_COOKIE = "ar_vid";
export const SESSION_COOKIE = "ar_sid";
export const ADMIN_COOKIE = "ar_admin";

// Events a browser may report. QR_LANDING and SESSION_STARTED are written by the server only.
export const CLIENT_EVENT_TYPES = [
  "BRAND_SELECTED",
  "PHOTO_READY",
  "SHADE_SELECTED",
  "TRYON_STARTED",
  "TRYON_SUCCEEDED",
  "TRYON_FAILED",
  "RESULT_DOWNLOADED",
] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

export function isClientEventType(v: unknown): v is ClientEventType {
  return typeof v === "string" && (CLIENT_EVENT_TYPES as readonly string[]).includes(v);
}

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|monitor|curl\/|wget\/|python-requests|go-http-client|okhttp|axios\/|node-fetch|uptime/i;

// Known robots and link-preview fetchers. A missing user agent is treated as a robot.
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 8) return true;
  return BOT_UA.test(ua);
}

export function isValidEventId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

export function isValidTokenShape(v: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(v);
}

export type PrevSession = {
  id: string;
  origin: "QR" | "DIRECT";
  galleryId: string | null;
  qrTokenId: string | null;
  lastSeenAt: Date;
};

export type Entry = { kind: "qr"; galleryId: string; qrTokenId: string } | { kind: "direct" };

export type SessionDecision =
  | { action: "reuse"; id: string }
  | {
      action: "new";
      origin: "QR" | "DIRECT";
      galleryId: string | null;
      qrTokenId: string | null;
      countsLanding: boolean; // true only for a fresh open of a valid QR link
    };

// Which session a request belongs to.
//  - A valid QR link: the live session is kept when it is for the same gallery (a refresh or a
//    second scan is not a second entry); otherwise a new QR session starts and counts one entry.
//  - Anything else: the live session is kept. After 30 idle minutes a new session starts; it keeps
//    the gallery it came from for 12 hours (the visitor never left the shop's link), but it is not
//    a new QR entry. With no gallery to keep, it is a direct session of unknown origin.
export function decideSession(prev: PrevSession | null, now: Date, entry: Entry): SessionDecision {
  const idle = prev ? now.getTime() - prev.lastSeenAt.getTime() : Infinity;
  const live = prev !== null && idle >= 0 && idle < SESSION_IDLE_MS;

  if (entry.kind === "qr") {
    if (live && prev.galleryId === entry.galleryId) return { action: "reuse", id: prev.id };
    return { action: "new", origin: "QR", galleryId: entry.galleryId, qrTokenId: entry.qrTokenId, countsLanding: true };
  }
  if (live) return { action: "reuse", id: prev.id };
  if (prev && prev.origin === "QR" && prev.galleryId && idle >= 0 && idle < GALLERY_CARRY_MS) {
    return { action: "new", origin: "QR", galleryId: prev.galleryId, qrTokenId: prev.qrTokenId, countsLanding: false };
  }
  return { action: "new", origin: "DIRECT", galleryId: null, qrTokenId: null, countsLanding: false };
}
