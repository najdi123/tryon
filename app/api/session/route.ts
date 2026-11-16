import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sessionForRequest } from "@/lib/analytics/http";
import { isBotUserAgent } from "@/lib/analytics/rules";

export const dynamic = "force-dynamic";

// The app calls this once when it opens: it keeps the session alive (or starts a direct one)
// and tells the page which gallery the visit belongs to.
export async function GET(req: NextRequest) {
  if (isBotUserAgent(req.headers.get("user-agent"))) return NextResponse.json({ gallery: null });
  const res = NextResponse.json({ gallery: null as null | { name: string; city: string } });
  const s = await sessionForRequest(req, res, { kind: "direct" });
  if (!s.galleryId) return res;
  const g = await db.gallery.findUnique({ where: { id: s.galleryId }, select: { name: true, city: true } });
  const out = NextResponse.json({ gallery: g }, { headers: { "Cache-Control": "no-store" } });
  for (const c of res.cookies.getAll()) out.cookies.set(c);
  return out;
}
