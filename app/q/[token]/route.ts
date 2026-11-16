import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent, isValidTokenShape } from "@/lib/analytics/rules";
import { resolveQrToken } from "@/lib/analytics/session";

export const dynamic = "force-dynamic";

// A gallery's QR opens /q/<token>. The server checks the token, starts the session,
// counts one "ورود از QR" and sends the visitor to the app. An unknown or switched-off
// token still opens the app, as a direct visit of unknown origin.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const res = new NextResponse(null, { status: 307, headers: { Location: "/", "Cache-Control": "no-store" } });
  if (isBotUserAgent(req.headers.get("user-agent"))) return res; // robots and link previews count nothing
  const entry = isValidTokenShape(token) ? await resolveQrToken(db, token) : ({ kind: "direct" } as const);
  await sessionForRequest(req, res, entry);
  return res;
}
