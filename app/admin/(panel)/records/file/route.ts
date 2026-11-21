import { NextResponse, type NextRequest } from "next/server";
import { currentStaff } from "@/lib/admin/auth";
import { recordFile } from "@/lib/records";

export const dynamic = "force-dynamic";

// One recorded picture. Admins only; the path parts are checked in lib/records.ts.
export async function GET(req: NextRequest) {
  const user = await currentStaff();
  if (!user || user.role !== "ADMIN") return new NextResponse(null, { status: 401 });
  const q = req.nextUrl.searchParams;
  const file = await recordFile(q.get("day") ?? "", q.get("photo") ?? "", q.get("name") ?? "");
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
