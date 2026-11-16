import type { NextRequest, NextResponse } from "next/server";
import { db } from "../db";
import { ADMIN_COOKIE, SESSION_COOKIE, VISITOR_COOKIE, type Entry } from "./rules";
import { isStaffRequest, newVisitorId, openSession, type SessionRef } from "./session";

const YEAR_S = 400 * 24 * 60 * 60;
const DAY_S = 24 * 60 * 60;

function cookieBase() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
}

// Opens the request's session and puts both cookies on the response.
export async function sessionForRequest(req: NextRequest, res: NextResponse, entry: Entry): Promise<SessionRef> {
  const now = new Date();
  const known = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = known && /^[0-9a-f-]{36}$/.test(known) ? known : newVisitorId();
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
