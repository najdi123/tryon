"use server";

// Every change a staff member can make. Each action checks the session on the server first,
// and each change is written to the change log.
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { newQrToken } from "@/lib/analytics/session";
import {
  endStaffSession, hashPassword, logChange, loginBlocked, noteLoginFailure, requireAdmin, startStaffSession, verifyPassword,
} from "./auth";

export type FormState = { error?: string; ok?: boolean };
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = text(fd, "username").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (loginBlocked(username)) return { error: "blocked" };
  const user = await db.adminUser.findUnique({ where: { username } });
  // The password is checked even for an unknown username, so the answer takes the same time.
  const ok = await verifyPassword(password, user?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!user || !user.active || !ok) {
    noteLoginFailure(username);
    return { error: "wrong" };
  }
  await startStaffSession(user.id);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endStaffSession();
  redirect("/admin/login");
}

// ─── Galleries and their QR ─────────────────────────────────────────────────

export async function saveGallery(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const id = text(fd, "id");
  const data = {
    publicId: text(fd, "publicId").toUpperCase(),
    name: text(fd, "name"),
    province: text(fd, "province"),
    city: text(fd, "city"),
    status: text(fd, "status") === "INACTIVE" ? ("INACTIVE" as const) : ("ACTIVE" as const),
  };
  if (!data.publicId || !data.name || !data.province || !data.city) return { error: "required" };
  if (!/^[A-Z0-9-]{3,20}$/.test(data.publicId)) return { error: "publicIdShape" };
  const clash = await db.gallery.findUnique({ where: { publicId: data.publicId } });
  if (clash && clash.id !== id) return { error: "publicIdTaken" };
  if (id) {
    await db.gallery.update({ where: { id }, data });
    await logChange(user, "update", "gallery", id, `ویرایش گالری ${data.name} (${data.publicId})، وضعیت ${data.status === "ACTIVE" ? "فعال" : "غیرفعال"}`);
    refresh();
    return { ok: true };
  }
  const g = await db.gallery.create({ data: { ...data, tokens: { create: { token: newQrToken() } } } });
  await logChange(user, "create", "gallery", g.id, `ثبت گالری ${data.name} (${data.publicId}) در ${data.province}، ${data.city}`);
  redirect(`/admin/galleries/${g.id}`);
}

// The old QR stops working; the history stays with the gallery.
export async function renewQr(fd: FormData): Promise<void> {
  const user = await requireAdmin();
  const galleryId = text(fd, "galleryId");
  const g = await db.gallery.findUnique({ where: { id: galleryId } });
  if (!g) return;
  await db.$transaction([
    db.qrToken.updateMany({ where: { galleryId, active: true }, data: { active: false, revokedAt: new Date() } }),
    db.qrToken.create({ data: { galleryId, token: newQrToken() } }),
  ]);
  await logChange(user, "renew_qr", "gallery", galleryId, `ساخت QR جدید برای گالری ${g.name} (${g.publicId})؛ QR قبلی از کار افتاد`);
  refresh();
}

// ─── Panel users ────────────────────────────────────────────────────────────

async function activeAdmins(exceptId?: string): Promise<number> {
  return db.adminUser.count({ where: { role: "ADMIN", active: true, ...(exceptId ? { id: { not: exceptId } } : {}) } });
}

export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const username = text(fd, "username").toLowerCase();
  const displayName = text(fd, "displayName");
  const password = String(fd.get("password") ?? "");
  const role = text(fd, "role") === "ADMIN" ? ("ADMIN" as const) : ("VIEWER" as const);
  if (!username || !displayName) return { error: "required" };
  if (!/^[a-z0-9.-]{3,30}$/.test(username)) return { error: "usernameShape" };
  if (password.length < 10) return { error: "passwordShort" };
  if (await db.adminUser.findUnique({ where: { username } })) return { error: "usernameTaken" };
  const u = await db.adminUser.create({ data: { username, displayName, role, passwordHash: await hashPassword(password) } });
  await logChange(user, "create", "user", u.id, `ثبت کاربر ${displayName} (${username}) با نقش ${role === "ADMIN" ? "مدیر" : "مشاهده‌گر"}`);
  refresh();
  return { ok: true };
}

export async function updateUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const id = text(fd, "id");
  const target = await db.adminUser.findUnique({ where: { id } });
  if (!target) return { error: "required" };
  const intent = text(fd, "intent");
  if (intent === "password") {
    const password = String(fd.get("password") ?? "");
    if (password.length < 10) return { error: "passwordShort" };
    await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    await db.adminSession.deleteMany({ where: { adminUserId: id, ...(id === user.id ? { id: "none" } : {}) } }); // others are signed out
    await logChange(user, "password", "user", id, `تغییر رمز کاربر ${target.username}`);
  } else if (intent === "toggle") {
    if (id === user.id) return { error: "self" };
    if (target.active && target.role === "ADMIN" && (await activeAdmins(id)) === 0) return { error: "lastAdmin" };
    await db.adminUser.update({ where: { id }, data: { active: !target.active } });
    if (target.active) await db.adminSession.deleteMany({ where: { adminUserId: id } });
    await logChange(user, target.active ? "deactivate" : "activate", "user", id, `${target.active ? "غیرفعال‌کردن" : "فعال‌کردن"} کاربر ${target.username}`);
  } else if (intent === "role") {
    if (id === user.id) return { error: "self" };
    const role = target.role === "ADMIN" ? ("VIEWER" as const) : ("ADMIN" as const);
    if (target.role === "ADMIN" && target.active && (await activeAdmins(id)) === 0) return { error: "lastAdmin" };
    await db.adminUser.update({ where: { id }, data: { role } });
    await logChange(user, "role", "user", id, `تغییر نقش کاربر ${target.username} به ${role === "ADMIN" ? "مدیر" : "مشاهده‌گر"}`);
  }
  refresh();
  return { ok: true };
}

// ─── Catalogue and settings ─────────────────────────────────────────────────

export async function saveShade(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const id = text(fd, "id");
  const nameFa = text(fd, "nameFa");
  const hex = text(fd, "hex").toLowerCase();
  if (!nameFa) return { error: "required" };
  if (!/^#[0-9a-f]{6}$/.test(hex)) return { error: "hex" };
  const before = await db.shade.findUnique({ where: { id }, include: { line: true } });
  if (!before) return { error: "required" };
  const data = { nameFa, hex, active: fd.get("active") === "on", nameChecked: fd.get("nameChecked") === "on" };
  await db.shade.update({ where: { id }, data });
  const changed = [
    before.nameFa !== nameFa ? `نام «${before.nameFa}» به «${nameFa}»` : "",
    before.hex !== hex ? `رنگ ${before.hex ?? "-"} به ${hex}` : "",
    before.active !== data.active ? (data.active ? "فعال شد" : "غیرفعال شد") : "",
    before.nameChecked !== data.nameChecked ? (data.nameChecked ? "بررسی‌شده" : "بررسی‌نشده") : "",
  ].filter(Boolean);
  if (changed.length) await logChange(user, "update", "shade", id, `${before.line.nameEn} ${before.code}: ${changed.join("، ")}`);
  refresh();
  return { ok: true };
}

export async function setLineActive(fd: FormData): Promise<void> {
  const user = await requireAdmin();
  const key = text(fd, "key");
  const line = await db.productLine.findUnique({ where: { key } });
  if (!line) return;
  await db.productLine.update({ where: { key }, data: { active: !line.active } });
  await logChange(user, line.active ? "deactivate" : "activate", "line", line.id, `${line.nameEn}: ${line.active ? "از دید مشتری پنهان شد" : "برای مشتری نمایش داده می‌شود"}`);
  refresh();
}

export async function saveRetention(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const days = Number(text(fd, "days"));
  if (!Number.isInteger(days) || days < 30 || days > 3650) return { error: "required" };
  await db.setting.upsert({ where: { key: "retention.eventDays" }, update: { value: String(days) }, create: { key: "retention.eventDays", value: String(days) } });
  await logChange(user, "update", "setting", "retention.eventDays", `مدت نگهداری رخدادهای آماری: ${days} روز`);
  refresh();
  return { ok: true };
}
