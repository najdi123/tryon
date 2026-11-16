import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hasVisitor, logAnalyticsFailure, sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent, isClientEventType, isTryOnEvent, isValidEventId, isValidStatus } from "@/lib/analytics/rules";
import { recordEvent, resolveEventTarget, type EventInput } from "@/lib/analytics/session";

export const dynamic = "force-dynamic";

function short(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// One analytics event from the browser. It carries no photo, no name and no phone number:
// only what happened, and to which line and shade.
export async function POST(req: NextRequest) {
  if (isBotUserAgent(req.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });
  const raw = await req.text();
  if (raw.length > 2000) return bad("too_large", 413);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return bad("bad_json");
    body = parsed as Record<string, unknown>;
  } catch {
    return bad("bad_json");
  }
  if (!isValidEventId(body.eventId) || !isClientEventType(body.type)) return bad("bad_event");
  if (body.status !== undefined && !isValidStatus(body.status)) return bad("bad_status");
  // The server writes the try-on events for pictures it makes; a browser reports only its own.
  if (isTryOnEvent(body.type) && body.status !== "local") return bad("server_event");
  // An event never starts a browser id: the page opens /api/session first.
  if (!hasVisitor(req)) return bad("no_session", 409);

  const input: EventInput = {
    eventId: body.eventId,
    type: body.type,
    lineKey: short(body.lineKey, 40),
    shadeCode: short(body.shadeCode, 16),
    status: body.status as string | undefined,
  };
  try {
    const target = await resolveEventTarget(db, input); // checked before any session is opened
    if (!target.ok) return bad(target.reason);
    const res = NextResponse.json({ ok: true });
    const s = await sessionForRequest(req, res, { kind: "direct" });
    const r = await recordEvent(db, s, input, target, new Date());
    if (!r.ok) {
      const full = bad(r.reason, 429);
      for (const c of res.cookies.getAll()) full.cookies.set(c);
      return full;
    }
    return res;
  } catch (e) {
    logAnalyticsFailure("event", e);
    return bad("unavailable", 503);
  }
}
