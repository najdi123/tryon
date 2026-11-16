import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logAnalyticsFailure, sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent } from "@/lib/analytics/rules";

export const dynamic = "force-dynamic";

type Body = { gallery: null | { name: string; city: string } };
const NO_STORE = { "Cache-Control": "no-store" };

// The app calls this once when it opens, before it sends any event: it keeps the session alive
// (or starts a direct one) and tells the page which gallery the visit belongs to.
export async function GET(req: NextRequest) {
  const empty = NextResponse.json<Body>({ gallery: null }, { headers: NO_STORE });
  if (isBotUserAgent(req.headers.get("user-agent"))) return empty;
  try {
    const s = await sessionForRequest(req, empty, { kind: "direct" });
    if (!s.galleryId) return empty;
    const g = await db.gallery.findUnique({ where: { id: s.galleryId }, select: { name: true, city: true } });
    const out = NextResponse.json<Body>({ gallery: g }, { headers: NO_STORE });
    for (const c of empty.cookies.getAll()) out.cookies.set(c);
    return out;
  } catch (e) {
    logAnalyticsFailure("session", e);
    return NextResponse.json<Body>({ gallery: null }, { headers: NO_STORE });
  }
}
