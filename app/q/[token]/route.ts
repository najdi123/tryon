import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logAnalyticsFailure, sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent, isRealNavigation, isValidTokenShape } from "@/lib/analytics/rules";
import { resolveQrToken } from "@/lib/analytics/session";

export const dynamic = "force-dynamic";

// A gallery's QR opens /q/<token>. The server checks the token, starts the session,
// counts one "ورود از QR" and sends the visitor to the app. An unknown or switched-off
// token still opens the app, as a direct visit of unknown origin.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const res = new NextResponse(null, { status: 307, headers: { Location: "/", "Cache-Control": "no-store" } });
  const h = req.headers;
  if (isBotUserAgent(h.get("user-agent"))) return res; // robots and link previews count nothing
  const nav = { dest: h.get("sec-fetch-dest"), mode: h.get("sec-fetch-mode"), purpose: h.get("sec-purpose") ?? h.get("purpose") };
  if (!isRealNavigation(nav)) return res; // an image tag or a prefetch is not a person opening the link
  try {
    const entry = isValidTokenShape(token) ? await resolveQrToken(db, token) : ({ kind: "invalid_qr" } as const);
    await sessionForRequest(req, res, entry);
  } catch (e) {
    logAnalyticsFailure("qr", e); // the app still opens
  }
  return res;
}
