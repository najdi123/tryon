import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ADMIN_COOKIE } from "@/lib/analytics/rules";
import { hashAdminToken } from "@/lib/analytics/session";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SESSION_HOURS = 12;

export type StaffUser = { id: string; username: string; displayName: string; role: "ADMIN" | "VIEWER" };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await scrypt(password, Buffer.from(salt, "base64"), want.length);
  return timingSafeEqual(want, got);
}

// The cookie holds a random token; only its hash is stored, so a database copy opens no session.
export async function startStaffSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await db.adminSession.create({ data: { tokenHash: hashAdminToken(token), adminUserId: userId, expiresAt } });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function endStaffSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: hashAdminToken(token) } });
  jar.delete(ADMIN_COOKIE);
}

export async function currentStaff(): Promise<StaffUser | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const row = await db.adminSession.findUnique({ where: { tokenHash: hashAdminToken(token) }, include: { adminUser: true } });
  if (!row || row.expiresAt <= new Date() || !row.adminUser.active) return null;
  const u = row.adminUser;
  return { id: u.id, username: u.username, displayName: u.displayName, role: u.role };
}

// Every panel page and every panel action starts with one of these two. The check is on the
// server; hiding a button in the page is never the protection.
export async function requireStaff(): Promise<StaffUser> {
  const user = await currentStaff();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireAdmin(): Promise<StaffUser> {
  const user = await requireStaff();
  if (user.role !== "ADMIN") redirect("/admin?denied=1");
  return user;
}

export async function logChange(user: StaffUser, action: string, entity: string, entityId: string | null, summary: string): Promise<void> {
  await db.changeLog.create({ data: { adminUserId: user.id, action, entity, entityId, summary } });
}

// Five wrong passwords for one username FROM ONE ADDRESS in ten minutes lock that pair for the
// rest of the ten minutes. Keyed on both, so a stranger hammering a username cannot lock its real
// owner out. Only well-formed usernames are ever stored, nothing is stored for a first look, and
// the map is bounded. Kept in the server's memory: enough for a small panel behind one process;
// nginx limits the login address as well.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_KEYS = 5000;
const failures = new Map<string, number[]>();
const recentFor = (key: string) => (failures.get(key) ?? []).filter((t) => Date.now() - t < WINDOW_MS);

export const isUsername = (v: string) => /^[a-z0-9.-]{3,30}$/.test(v);

export async function clientAddress(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

export function loginBlocked(username: string, address: string): boolean {
  return recentFor(`${username}|${address}`).length >= 5;
}

export function noteLoginFailure(username: string, address: string): void {
  const key = `${username}|${address}`;
  if (failures.size >= MAX_KEYS && !failures.has(key)) {
    for (const [k, v] of failures) if (v.every((t) => Date.now() - t >= WINDOW_MS)) failures.delete(k);
    if (failures.size >= MAX_KEYS) failures.clear(); // under a flood, forgetting is safer than growing
  }
  failures.set(key, [...recentFor(key), Date.now()]);
}

export function clearLoginFailures(username: string, address: string): void {
  failures.delete(`${username}|${address}`);
}

// Signs out every other session of this user: the one asking keeps theirs.
export async function endOtherSessions(userId: string): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  await db.adminSession.deleteMany({
    where: { adminUserId: userId, ...(token ? { tokenHash: { not: hashAdminToken(token) } } : {}) },
  });
}
