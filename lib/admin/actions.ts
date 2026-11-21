"use server";

// Every change a staff member can make. Each action checks the session on the server first,
// and each change is written to the change log.
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { newQrToken } from "@/lib/analytics/session";
import {
  clearLoginFailures, clientAddress, endOtherSessions, endStaffSession, hashPassword, isUsername, logChange, loginBlocked,
  noteLoginFailure, requireAdmin, startStaffSession, verifyPassword,
} from "./auth";
import { PROVINCES } from "./provinces";

export type FormState = { error?: string; ok?: boolean };
const isUniqueClash = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const NO_COLOUR_PLACEHOLDER = "#888888";

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = text(fd, "username").toLowerCase();
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!isUsername(username)) return { error: "wrong" }; // nothing is remembered for a malformed name
  const address = await clientAddress();
  if (loginBlocked(username, address)) return { error: "blocked" };
  const user = await db.adminUser.findUnique({ where: { username } });
  // The password is checked even for an unknown username, so the answer takes the same time.
  const ok = await verifyPassword(password, user?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!user || !user.active || !ok) {
    noteLoginFailure(username, address);
    return { error: "wrong" };
  }
  clearLoginFailures(username, address);
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
  if (data.name.length > 80 || data.city.length > 40) return { error: "tooLong" };
  if (!(PROVINCES as readonly string[]).includes(data.province)) return { error: "province" };
  if (!/^[A-Z0-9-]{3,20}$/.test(data.publicId)) return { error: "publicIdShape" };
  const clash = await db.gallery.findUnique({ where: { publicId: data.publicId } });
  if (clash && clash.id !== id) return { error: "publicIdTaken" };
  let createdId = "";
  try {
    if (id) {
      const before = await db.gallery.findUnique({ where: { id } });
      if (!before) return { error: "notFound" };
      await db.gallery.update({ where: { id }, data });
      const was = [
        before.name !== data.name ? `نام «${before.name}»` : "",
        before.publicId !== data.publicId ? `شناسه ${before.publicId}` : "",
        before.province !== data.province || before.city !== data.city ? `محل ${before.province}، ${before.city}` : "",
        before.status !== data.status ? `وضعیت ${before.status === "ACTIVE" ? "فعال" : "غیرفعال"}` : "",
      ].filter(Boolean);
      await logChange(user, "update", "gallery", id,
        `ویرایش گالری ${data.name} (${data.publicId})، ${data.province}، ${data.city}، ${data.status === "ACTIVE" ? "فعال" : "غیرفعال"}${was.length ? `؛ قبلاً: ${was.join("، ")}` : ""}`);
    } else {
      const g = await db.gallery.create({ data: { ...data, tokens: { create: { token: newQrToken() } } } });
      createdId = g.id;
      await logChange(user, "create", "gallery", g.id, `ثبت گالری ${data.name} (${data.publicId}) در ${data.province}، ${data.city}`);
    }
  } catch (e) {
    if (isUniqueClash(e)) return { error: "publicIdTaken" }; // two people saved the same id at once
    throw e;
  }
  if (createdId) redirect(`/admin/galleries/${createdId}`);
  refresh();
  return { ok: true };
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
  if (displayName.length > 60) return { error: "tooLong" };
  if (!isUsername(username)) return { error: "usernameShape" };
  if (password.length < 10) return { error: "passwordShort" };
  if (await db.adminUser.findUnique({ where: { username } })) return { error: "usernameTaken" };
  let u;
  try {
    u = await db.adminUser.create({ data: { username, displayName, role, passwordHash: await hashPassword(password) } });
  } catch (e) {
    if (isUniqueClash(e)) return { error: "usernameTaken" };
    throw e;
  }
  await logChange(user, "create", "user", u.id, `ثبت کاربر ${displayName} (${username}) با نقش ${role === "ADMIN" ? "مدیر" : "مشاهده‌گر"}`);
  refresh();
  return { ok: true };
}

export async function updateUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const id = text(fd, "id");
  const target = await db.adminUser.findUnique({ where: { id } });
  if (!target) return { error: "notFound" };
  const intent = text(fd, "intent");
  if (intent === "password") {
    const password = String(fd.get("password") ?? "");
    if (password.length < 10) return { error: "passwordShort" };
    await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    // Every other session of that user ends. Changing your own password keeps only the session you are in.
    if (id === user.id) await endOtherSessions(id);
    else await db.adminSession.deleteMany({ where: { adminUserId: id } });
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
  } else {
    return { error: "notFound" };
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
  if (!nameFa || nameFa.length > 60) return { error: "required" };
  if (!/^#[0-9a-f]{6}$/.test(hex)) return { error: "hex" };
  const before = await db.shade.findUnique({ where: { id }, include: { line: true } });
  if (!before) return { error: "notFound" };
  // A shade with no colour is hidden from customers. Its row shows a grey placeholder; saving the
  // row must not turn that placeholder into the shade's colour.
  const keepNoColour = before.hex === null && hex === NO_COLOUR_PLACEHOLDER;
  const data = { nameFa, hex: keepNoColour ? null : hex, active: fd.get("active") === "on", nameChecked: fd.get("nameChecked") === "on" };
  await db.shade.update({ where: { id }, data });
  const changed = [
    before.nameFa !== nameFa ? `نام «${before.nameFa}» به «${nameFa}»` : "",
    before.hex !== data.hex ? `رنگ ${before.hex ?? "-"} به ${data.hex ?? "-"}` : "",
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
  const want = text(fd, "active") === "1";
  if (want === line.active) return;
  await db.productLine.update({ where: { key }, data: { active: want } });
  await logChange(user, want ? "activate" : "deactivate", "line", line.id, `${line.nameEn}: ${want ? "برای مشتری نمایش داده می‌شود" : "از دید مشتری پنهان شد"}`);
  refresh();
}

// A test switch: the image service also retouches the face lightly.
export async function saveRetouch(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const value = text(fd, "value") === "on" ? "on" : "off";
  await db.setting.upsert({ where: { key: "tryon.retouch" }, update: { value }, create: { key: "tryon.retouch", value } });
  await logChange(user, "update", "setting", "tryon.retouch", `روتوش چهره (آزمایشی): ${value === "on" ? "روشن" : "خاموش"}`);
  refresh();
  return { ok: true };
}

export async function saveRetention(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const days = Number(text(fd, "days"));
  if (!Number.isInteger(days) || days < 30 || days > 3650) return { error: "retention" };
  await db.setting.upsert({ where: { key: "retention.eventDays" }, update: { value: String(days) }, create: { key: "retention.eventDays", value: String(days) } });
  await logChange(user, "update", "setting", "retention.eventDays", `مدت نگهداری رخدادهای آماری: ${days} روز`);
  refresh();
  return { ok: true };
}
