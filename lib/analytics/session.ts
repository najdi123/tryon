import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";
import {
  MAX_EVENTS_PER_SESSION,
  decideSession,
  eventNeeds,
  type ClientEventType,
  type Entry,
  type PrevSession,
} from "./rules";

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
  const row = await db.adminSession.findUnique({
    where: { tokenHash: hashAdminToken(adminCookie) },
    include: { adminUser: { select: { active: true } } },
  });
  return row !== null && row.expiresAt > now && row.adminUser.active;
}

// A QR link is valid when its token is registered, active and not revoked, and its gallery is active.
export async function resolveQrToken(db: PrismaClient, token: string): Promise<Entry> {
  const row = await db.qrToken.findUnique({ where: { token }, include: { gallery: true } });
  if (!row || !row.active || row.revokedAt !== null || row.gallery.status !== "ACTIVE") return { kind: "invalid_qr" };
  return { kind: "qr", galleryId: row.galleryId, qrTokenId: row.id };
}

export type SessionRef = { id: string; galleryId: string | null; created: boolean };

// Finds or starts the session for this request and writes the server's own events.
// One visitor's requests are taken one at a time (an advisory lock on the browser id), so two
// requests arriving together cannot open two sessions.
export async function openSession(
  db: PrismaClient,
  args: { sessionCookie: string | undefined; visitorId: string; entry: Entry; isTest: boolean; now: Date },
): Promise<SessionRef> {
  const { sessionCookie, visitorId, entry, isTest, now } = args;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${visitorId}, 0))`;
    // The cookie names the session; a cookie from another browser id is not trusted, and a
    // missing one falls back to this browser's latest session.
    let row = sessionCookie ? await tx.session.findUnique({ where: { id: sessionCookie } }) : null;
    if (!row || row.visitorId !== visitorId) {
      row = await tx.session.findFirst({ where: { visitorId }, orderBy: { lastSeenAt: "desc" } });
    }
    const prev: PrevSession | null = row;
    let d = decideSession(prev, now, entry);
    if (d.action === "reuse") {
      await tx.session.update({
        where: { id: d.id },
        data: { lastSeenAt: now, ...(isTest ? { isTest: true } : {}) }, // staff who sign in later still count as test
      });
      return { id: d.id, galleryId: prev?.galleryId ?? null, created: false };
    }
    if (d.carried && d.galleryId) {
      // A gallery switched off since the scan gets no new sessions.
      const g = await tx.gallery.findUnique({ where: { id: d.galleryId }, select: { status: true } });
      if (!g || g.status !== "ACTIVE") {
        d = { ...d, origin: "DIRECT", galleryId: null, qrTokenId: null, qrEnteredAt: null, carried: false };
      }
    }
    const s = await tx.session.create({
      data: {
        visitorId,
        origin: d.origin,
        galleryId: d.galleryId,
        qrTokenId: d.qrTokenId,
        qrEnteredAt: d.qrEnteredAt,
        carried: d.carried,
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
  });
}

export type EventInput = {
  eventId: string;
  type: ClientEventType;
  lineKey?: string;
  shadeCode?: string;
  status?: string;
};

export type EventTarget =
  | { ok: true; lineId: string | null; shadeId: string | null }
  | { ok: false; reason: "line_required" | "shade_required" | "unknown_line" | "unknown_shade" };

// Checks what the event names before any session is opened. A shade is named by its line and its
// code together: the same code in two lines is two products. Only an active, try-on shade counts.
export async function resolveEventTarget(db: PrismaClient, input: EventInput): Promise<EventTarget> {
  const needs = eventNeeds(input.type);
  if (needs === "none") return { ok: true, lineId: null, shadeId: null };
  if (!input.lineKey) return { ok: false, reason: "line_required" };
  const line = await db.productLine.findUnique({ where: { key: input.lineKey } });
  if (!line || !line.active) return { ok: false, reason: "unknown_line" };
  if (needs === "line") return { ok: true, lineId: line.id, shadeId: null };
  if (!input.shadeCode) return { ok: false, reason: "shade_required" };
  const shade = await db.shade.findUnique({ where: { lineId_code: { lineId: line.id, code: input.shadeCode } } });
  if (!shade || !shade.active || !shade.tryOn) return { ok: false, reason: "unknown_shade" };
  return { ok: true, lineId: line.id, shadeId: shade.id };
}

export type EventResult = { ok: true; duplicate: boolean } | { ok: false; reason: "session_full" };

// Stores one event. The gallery is the session's, never the browser's word.
// The same eventId twice is stored once.
export async function recordEvent(
  db: PrismaClient,
  session: { id: string; galleryId: string | null },
  input: EventInput,
  target: { lineId: string | null; shadeId: string | null },
  now: Date,
): Promise<EventResult> {
  const n = await db.analyticsEvent.count({ where: { sessionId: session.id } });
  if (n >= MAX_EVENTS_PER_SESSION) return { ok: false, reason: "session_full" };
  try {
    await db.analyticsEvent.create({
      data: {
        eventId: input.eventId,
        type: input.type,
        sessionId: session.id,
        galleryId: session.galleryId,
        lineId: target.lineId,
        shadeId: target.shadeId,
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
