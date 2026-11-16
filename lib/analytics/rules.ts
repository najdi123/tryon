// The counting rules, as pure functions. Everything here is decided on the server.

export const SESSION_IDLE_MS = 30 * 60 * 1000; // a session ends after 30 minutes without activity
export const GALLERY_CARRY_MS = 12 * 60 * 60 * 1000; // a visitor keeps their gallery this long after the scan
export const MAX_EVENTS_PER_SESSION = 500; // bounds what one browser can add to a report

export const VISITOR_COOKIE = "ar_vid";
export const SESSION_COOKIE = "ar_sid";
export const ADMIN_COOKIE = "ar_admin";

// Events a browser may report. QR_LANDING and SESSION_STARTED are written by the server only.
// The three try-on events are the server's too when the server makes the picture; a browser may
// send them only for a preview it made on the device itself (status "local").
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

export function isTryOnEvent(t: ClientEventType): boolean {
  return t === "TRYON_STARTED" || t === "TRYON_SUCCEEDED" || t === "TRYON_FAILED";
}

// What each event must name: nothing, a product line, or a line and a shade.
export function eventNeeds(t: ClientEventType): "none" | "line" | "shade" {
  if (t === "PHOTO_READY") return "none";
  if (t === "BRAND_SELECTED") return "line";
  return "shade";
}

// A short machine word only, so nothing personal (a phone number, a name) can ride in it.
export function isValidStatus(v: unknown): v is string {
  return typeof v === "string" && /^[a-z_]{1,40}$/.test(v);
}

// Named robots and link-preview fetchers. In-app browsers of Telegram, Instagram and WhatsApp
// are real customers and must not match: only their preview fetchers do.
const BOT_UA = new RegExp(
  [
    "googlebot", "bingbot", "yandex", "baiduspider", "duckduckbot", "applebot", "telegrambot", "twitterbot",
    "facebookexternalhit", "meta-external", "linkedinbot", "slackbot", "discordbot", "^whatsapp\\/",
    "bingpreview", "google-inspectiontool", "googleother", "mediapartners-google", "google-pagerenderer",
    "headless", "lighthouse", "crawl", "spider", "slurp", "scrapy", "uptimerobot", "pingdom",
    "curl\\/", "wget\\/", "python-", "aiohttp", "go-http-client", "okhttp", "axios\\/", "node-fetch", "undici",
    "java\\/", "postmanruntime", "bot\\/", "compatible;[^)]*bot",
  ].join("|"),
  "i",
);

// A missing user agent is treated as a robot.
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 8) return true;
  return BOT_UA.test(ua);
}

// A QR entry is a person opening the link: a page navigation, not an image tag on someone
// else's page and not a browser's speculative prefetch. Old browsers send none of these headers.
export function isRealNavigation(h: { dest: string | null; mode: string | null; purpose: string | null }): boolean {
  if (h.purpose && /prefetch|prerender/i.test(h.purpose)) return false;
  if (h.dest && h.dest !== "document") return false;
  if (h.mode && h.mode !== "navigate") return false;
  return true;
}

export function isValidEventId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

export function isValidTokenShape(v: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(v);
}

export function isValidVisitorId(v: string | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
}

export type PrevSession = {
  id: string;
  origin: "QR" | "DIRECT";
  galleryId: string | null;
  qrTokenId: string | null;
  qrEnteredAt: Date | null; // when the QR link was opened; copied forward to carried sessions
  lastSeenAt: Date;
};

export type Entry =
  | { kind: "qr"; galleryId: string; qrTokenId: string }
  | { kind: "invalid_qr" } // a QR link whose token is unknown or switched off
  | { kind: "direct" };

export type SessionDecision =
  | { action: "reuse"; id: string }
  | {
      action: "new";
      origin: "QR" | "DIRECT";
      galleryId: string | null;
      qrTokenId: string | null;
      qrEnteredAt: Date | null;
      carried: boolean; // true: started after an idle gap, gallery kept from the earlier scan
      countsLanding: boolean; // true only for a fresh open of a valid QR link
    };

const DIRECT_NEW: SessionDecision = {
  action: "new", origin: "DIRECT", galleryId: null, qrTokenId: null, qrEnteredAt: null, carried: false, countsLanding: false,
};

// Which session a request belongs to.
//  - A valid QR link: the live session is kept when it is for the same gallery (a refresh or a
//    second scan is not a second entry); otherwise a new QR session starts and counts one entry.
//  - A QR link that is unknown or switched off: never credited to any gallery, not even the one
//    the visitor scanned before. It opens a direct session of unknown origin.
//  - Anything else: the live session is kept. After 30 idle minutes a new session starts. Within
//    12 hours of the scan itself it keeps that gallery, marked "carried", and counts no entry.
//    After that it is a direct session of unknown origin.
export function decideSession(prev: PrevSession | null, now: Date, entry: Entry): SessionDecision {
  const idle = prev ? now.getTime() - prev.lastSeenAt.getTime() : Infinity;
  const live = prev !== null && idle >= 0 && idle < SESSION_IDLE_MS;

  if (entry.kind === "qr") {
    if (live && prev.galleryId === entry.galleryId) return { action: "reuse", id: prev.id };
    return {
      action: "new", origin: "QR", galleryId: entry.galleryId, qrTokenId: entry.qrTokenId,
      qrEnteredAt: now, carried: false, countsLanding: true,
    };
  }
  if (entry.kind === "invalid_qr") {
    if (live && prev.origin === "DIRECT") return { action: "reuse", id: prev.id };
    return DIRECT_NEW;
  }
  if (live) return { action: "reuse", id: prev.id };
  if (prev && prev.origin === "QR" && prev.galleryId && prev.qrEnteredAt) {
    const sinceScan = now.getTime() - prev.qrEnteredAt.getTime();
    if (sinceScan >= 0 && sinceScan < GALLERY_CARRY_MS) {
      return {
        action: "new", origin: "QR", galleryId: prev.galleryId, qrTokenId: prev.qrTokenId,
        qrEnteredAt: prev.qrEnteredAt, carried: true, countsLanding: false,
      };
    }
  }
  return DIRECT_NEW;
}
