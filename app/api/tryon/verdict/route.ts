import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logAnalyticsFailure } from "@/lib/analytics/http";
import { VISITOR_COOKIE, isBotUserAgent, isValidVisitorId } from "@/lib/analytics/rules";
import { AI_VERDICTS, settleAiTryOn, type AiVerdict } from "@/lib/analytics/session";

export const dynamic = "force-dynamic";

// The phone reports what became of a picture the server made for it: kept as it came, kept after
// the colour correction, or not kept. Only this turns a started try-on into a success.
export async function POST(req: NextRequest) {
  if (isBotUserAgent(req.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });
  const visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
  if (!isValidVisitorId(visitorId)) return NextResponse.json({ error: "no_session" }, { status: 409 });
  let body: { attemptId?: unknown; verdict?: unknown };
  try {
    const parsed: unknown = JSON.parse((await req.text()).slice(0, 500));
    if (typeof parsed !== "object" || parsed === null) throw new Error("shape");
    body = parsed as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const { attemptId, verdict } = body;
  if (typeof attemptId !== "string" || !/^[A-Za-z0-9-]{8,48}$/.test(attemptId) || !AI_VERDICTS.includes(verdict as AiVerdict)) {
    return NextResponse.json({ error: "bad_verdict" }, { status: 400 });
  }
  try {
    const r = await settleAiTryOn(db, { visitorId, attemptId, verdict: verdict as AiVerdict, now: new Date() });
    return NextResponse.json({ result: r }, { status: r === "unknown_attempt" ? 404 : 200 });
  } catch (e) {
    logAnalyticsFailure("verdict", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
