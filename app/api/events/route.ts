import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent, isClientEventType, isValidEventId } from "@/lib/analytics/rules";
import { recordEvent } from "@/lib/analytics/session";

export const dynamic = "force-dynamic";

function short(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined;
}

// One analytics event from the browser. It carries no photo, no name and no phone number:
// only what happened, and to which line and shade.
export async function POST(req: NextRequest) {
  if (isBotUserAgent(req.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });
  const raw = await req.text();
  if (raw.length > 2000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!isValidEventId(body.eventId) || !isClientEventType(body.type)) {
    return NextResponse.json({ error: "bad_event" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  const s = await sessionForRequest(req, res, { kind: "direct" });
  const r = await recordEvent(
    db,
    s,
    {
      eventId: body.eventId,
      type: body.type,
      lineKey: short(body.lineKey, 40),
      shadeCode: short(body.shadeCode, 16),
      status: short(body.status, 40),
    },
    new Date(),
  );
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
  return res;
}
