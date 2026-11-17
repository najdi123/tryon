import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hasVisitor, logAnalyticsFailure, sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent } from "@/lib/analytics/rules";
import { finishAiTryOn, startAiTryOn, type SessionRef } from "@/lib/analytics/session";
import { compensatedHex } from "@/lib/colour/judge";
import { hairEngine } from "@/lib/engine";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // the app sends a 1280 px JPEG, well under this
const MAX_BODY = MAX_BYTES + 200 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PER_VISITOR_PER_DAY = Number(process.env.AI_TRYONS_PER_VISITOR_PER_DAY ?? 30);
const SITE_WIDE_PER_DAY = Number(process.env.AI_TRYONS_SITE_PER_DAY ?? 2000); // the real bound on cost
const ENGINE_LIMIT_MS = 50_000; // under the proxy's 60 s, so the customer always gets our answer

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// Makes one picture with the image service. The photo is held in memory for the call and is not
// stored. The server records the start and any failure itself. A success is recorded only when
// the customer's phone has measured the picture and kept it (/api/tryon/verdict): a picture that
// nobody received, or whose colour missed, is never a successful try-on.
export async function POST(req: NextRequest) {
  if (isBotUserAgent(req.headers.get("user-agent"))) return fail("forbidden", 403);
  const engine = hairEngine();
  if (!engine.available()) return fail("not_configured", 503); // said before any photo is read
  if (!hasVisitor(req)) return fail("no_session", 409);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail("image_too_large", 413);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("bad_request", 400);
  }
  const image = form.get("image");
  const lineKey = String(form.get("lineKey") ?? "");
  const shadeCode = String(form.get("shadeCode") ?? "");
  const attemptId = String(form.get("attemptId") ?? "");
  // A second request for the same preview may ask for the colour moved by a bounded amount.
  const comp = String(form.get("compensate") ?? "").split(",").map(Number);
  const compensate = comp.length === 3 && comp.every((v) => Number.isFinite(v)) ? (comp as [number, number, number]) : null;
  if (form.get("consent") !== "yes") return fail("consent_required", 400);
  if (!/^[A-Za-z0-9-]{8,48}$/.test(attemptId)) return fail("bad_request", 400);
  if (!(image instanceof File) || !ALLOWED_TYPES.has(image.type)) return fail("bad_image", 400);
  if (image.size > MAX_BYTES) return fail("image_too_large", 413);

  let session: SessionRef;
  let target: { lineId: string; shadeId: string };
  let shade: { nameEn: string; hex: string; description: string | null };
  const cookies = NextResponse.json({});
  const withCookies = (res: NextResponse) => {
    for (const c of cookies.cookies.getAll()) res.cookies.set(c);
    return res;
  };
  try {
    const row = await db.shade.findFirst({
      where: { code: shadeCode, active: true, tryOn: true, hex: { not: null }, line: { key: lineKey, active: true } },
    });
    if (!row || !row.hex) return fail("unknown_shade", 400);
    target = { lineId: row.lineId, shadeId: row.id };
    shade = { nameEn: row.nameEn, hex: compensate ? compensatedHex(row.hex, compensate) : row.hex, description: row.colorDescription };
    session = await sessionForRequest(req, cookies, { kind: "direct" });
    const start = await startAiTryOn(db, {
      session, target, eventId: `${attemptId}_s`, perVisitor: PER_VISITOR_PER_DAY, siteWide: SITE_WIDE_PER_DAY, now: new Date(),
    });
    if (!start.ok) return withCookies(fail(start.reason, 429));
  } catch (e) {
    logAnalyticsFailure("tryon", e);
    return fail("unavailable", 503);
  }

  const finish = async (type: "TRYON_SUCCEEDED" | "TRYON_FAILED", status: string) => {
    try {
      await finishAiTryOn(db, { session, target, eventId: `${attemptId}_${type === "TRYON_SUCCEEDED" ? "ok" : "f"}`, type, status, now: new Date() });
    } catch (e) {
      logAnalyticsFailure("tryon-event", e);
    }
  };
  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(ENGINE_LIMIT_MS)]);
  const result = await engine.recolor({ image: { mimeType: image.type, base64 }, shade, signal });
  if (req.signal.aborted) {
    await finish("TRYON_FAILED", "client_gone"); // nobody received it: not a success
    return withCookies(fail("failed", 499));
  }
  if (!result.ok) {
    await finish("TRYON_FAILED", result.reason);
    return withCookies(fail(result.reason, 502));
  }
  return withCookies(NextResponse.json({ image: result.imageDataUrl }));
}
