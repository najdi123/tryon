import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hasVisitor, logAnalyticsFailure, sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent, type ClientEventType } from "@/lib/analytics/rules";
import { recordEvent } from "@/lib/analytics/session";
import { hairEngine } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AI_TRYONS_PER_DAY = 30; // per browser: bounds the cost one visitor can cause

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// Makes one preview with the image service. The photo is held in memory for the call and
// is not stored. The server writes the try-on events itself, so a success cannot be faked.
export async function POST(req: NextRequest) {
  if (isBotUserAgent(req.headers.get("user-agent"))) return fail("forbidden", 403);
  if (!hasVisitor(req)) return fail("no_session", 409);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("bad_request", 400);
  }
  const image = form.get("image");
  const lineKey = String(form.get("lineKey") ?? "");
  const shadeCode = String(form.get("shadeCode") ?? "");
  if (form.get("consent") !== "yes") return fail("consent_required", 400);
  if (!(image instanceof File) || !ALLOWED_TYPES.has(image.type)) return fail("bad_image", 400);
  if (image.size > MAX_BYTES) return fail("image_too_large", 413);

  let session: { id: string; galleryId: string | null };
  let target: { lineId: string; shadeId: string };
  let shade: { nameEn: string; hex: string; description: string | null };
  const res = NextResponse.json({});
  try {
    const row = await db.shade.findFirst({
      where: { code: shadeCode, active: true, tryOn: true, hex: { not: null }, line: { key: lineKey, active: true } },
    });
    if (!row || !row.hex) return fail("unknown_shade", 400);
    target = { lineId: row.lineId, shadeId: row.id };
    shade = { nameEn: row.nameEn, hex: row.hex, description: row.colorDescription };
    session = await sessionForRequest(req, res, { kind: "direct" });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const used = await db.analyticsEvent.count({
      where: { type: "TRYON_STARTED", status: "ai", createdAt: { gte: since }, session: { visitorId: req.cookies.get("ar_vid")?.value } },
    });
    if (used >= MAX_AI_TRYONS_PER_DAY) return fail("daily_limit", 429);
  } catch (e) {
    logAnalyticsFailure("tryon", e);
    return fail("unavailable", 503);
  }

  const write = async (type: ClientEventType, status: string) => {
    try {
      await recordEvent(db, session, { eventId: randomUUID(), type, lineKey, shadeCode, status }, target, new Date());
    } catch (e) {
      logAnalyticsFailure("tryon-event", e);
    }
  };
  await write("TRYON_STARTED", "ai");
  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const result = await hairEngine().recolor({ image: { mimeType: image.type, base64 }, shade });
  if (!result.ok) {
    await write("TRYON_FAILED", result.reason);
    return fail(result.reason, result.reason === "not_configured" ? 503 : 502);
  }
  await write("TRYON_SUCCEEDED", "ai");
  const out = NextResponse.json({ image: result.imageDataUrl });
  for (const c of res.cookies.getAll()) out.cookies.set(c);
  return out;
}
