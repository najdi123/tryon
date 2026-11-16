import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";
import { decideSession, type ClientEventType, type Entry, type PrevSession } from "./rules";

export function newQrToken(): string {
  return randomBytes(18).toString("base64url"); // 24 characters, 144 random bits
}

export function newVisitorId(): string {
  return randomUUID();
}

export function hashAdminToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Staff signed in to the panel are test traffic, left out of the main report.
export async function isStaffRequest(db: PrismaClient, adminCookie: string | undefined, now: Date): Promise<boolean> {
  if (!adminCookie) return false;
  const row = await db.adminSession.findUnique({ where: { tokenHash: hashAdminToken(adminCookie) } });
  return row !== null && row.expiresAt > now;
}

// A QR link is valid when its token is registered and active and its gallery is active.
export async function resolveQrToken(db: PrismaClient, token: string): Promise<Entry> {
  const row = await db.qrToken.findUnique({ where: { token }, include: { gallery: true } });
  if (!row || !row.active || row.gallery.status !== "ACTIVE") return { kind: "direct" };
  return { kind: "qr", galleryId: row.galleryId, qrTokenId: row.id };
}

export type SessionRef = { id: string; galleryId: string | null; created: boolean };

// Finds or starts the session for this request and writes the server's own events.
export async function openSession(
  db: PrismaClient,
  args: { sessionCookie: string | undefined; visitorId: string; entry: Entry; isTest: boolean; now: Date },
): Promise<SessionRef> {
  const { sessionCookie, visitorId, entry, isTest, now } = args;
  let prev: PrevSession | null = null;
  if (sessionCookie) {
    const row = await db.session.findUnique({ where: { id: sessionCookie } });
    // A session cookie from another browser id is not trusted.
    if (row && row.visitorId === visitorId) prev = row;
  }
  const d = decideSession(prev, now, entry);
  if (d.action === "reuse") {
    await db.session.update({ where: { id: d.id }, data: { lastSeenAt: now } });
    return { id: d.id, galleryId: prev?.galleryId ?? null, created: false };
  }
  const s = await db.session.create({
    data: {
      visitorId,
      origin: d.origin,
      galleryId: d.galleryId,
      qrTokenId: d.qrTokenId,
      isTest,
      startedAt: now,
      lastSeenAt: now,
      events: {
        create: [
          { eventId: `start:${randomUUID()}`, type: "SESSION_STARTED", galleryId: d.galleryId, createdAt: now },
          ...(d.countsLanding
            ? [{ eventId: `landing:${randomUUID()}`, type: "QR_LANDING" as const, galleryId: d.galleryId, createdAt: now }]
            : []),
        ],
      },
    },
  });
  return { id: s.id, galleryId: s.galleryId, created: true };
}

export type EventInput = {
  eventId: string;
  type: ClientEventType;
  lineKey?: string;
  shadeCode?: string;
  status?: string;
};

export type EventResult = { ok: true; duplicate: boolean } | { ok: false; reason: "unknown_line" | "unknown_shade" };

// Stores one browser event. The gallery is the session's, never the browser's word.
// The same eventId twice is stored once.
export async function recordEvent(
  db: PrismaClient,
  session: { id: string; galleryId: string | null },
  input: EventInput,
  now: Date,
): Promise<EventResult> {
  let lineId: string | null = null;
  let shadeId: string | null = null;
  if (input.lineKey) {
    const line = await db.productLine.findUnique({ where: { key: input.lineKey } });
    if (!line) return { ok: false, reason: "unknown_line" };
    lineId = line.id;
    if (input.shadeCode) {
      const shade = await db.shade.findUnique({ where: { lineId_code: { lineId, code: input.shadeCode } } });
      if (!shade) return { ok: false, reason: "unknown_shade" };
      shadeId = shade.id;
    }
  } else if (input.shadeCode) {
    return { ok: false, reason: "unknown_line" }; // a code alone is ambiguous: two lines share codes
  }
  try {
    await db.analyticsEvent.create({
      data: {
        eventId: input.eventId,
        type: input.type,
        sessionId: session.id,
        galleryId: session.galleryId,
        lineId,
        shadeId,
        status: input.status ?? null,
        createdAt: now,
      },
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return { ok: true, duplicate: true };
    }
    throw e;
  }
  return { ok: true, duplicate: false };
}
