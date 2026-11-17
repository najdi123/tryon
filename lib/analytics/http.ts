import type { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { ADMIN_COOKIE, SESSION_COOKIE, VISITOR_COOKIE, isValidVisitorId, type Entry } from "./rules";
import { isStaffRequest, newVisitorId, openSession, type SessionRef } from "./session";

const YEAR_S = 400 * 24 * 60 * 60;
const DAY_S = 24 * 60 * 60;

// Secure cookies in production: the site is served over HTTPS only.
function cookieBase() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
}

export function hasVisitor(req: NextRequest): boolean {
  return isValidVisitorId(req.cookies.get(VISITOR_COOKIE)?.value);
}

// Opens the request's session and puts both cookies on the response.
export async function sessionForRequest(req: NextRequest, res: NextResponse, entry: Entry): Promise<SessionRef> {
  const now = new Date();
  const known = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = isValidVisitorId(known) ? known : newVisitorId();
  const isTest = await isStaffRequest(db, req.cookies.get(ADMIN_COOKIE)?.value, now);
  const s = await openSession(db, {
    sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
    visitorId,
    entry,
    isTest,
    now,
  });
  res.cookies.set(VISITOR_COOKIE, visitorId, { ...cookieBase(), maxAge: YEAR_S });
  res.cookies.set(SESSION_COOKIE, s.id, { ...cookieBase(), maxAge: DAY_S });
  return s;
}

// Analytics must never stop the product: a failure is logged and the caller carries on.
export function logAnalyticsFailure(where: string, e: unknown): void {
  // The server's only log line when the analytics database is unreachable.
  const code = typeof e === "object" && e !== null ? ((e as { code?: string }).code ?? "") : "";
  console.error(`[analytics] ${where}: ${code} ${e instanceof Error ? e.name + " " + e.message.slice(0, 300) : String(e)}`);
}
