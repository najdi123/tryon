import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { currentStaff } from "@/lib/admin/auth";
import { qrLink } from "@/lib/admin/qr";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// The gallery's QR as a file, for printing. Staff only: the token is what attributes a visit.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentStaff())) return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;
  const gallery = await db.gallery.findUnique({ where: { id }, include: { tokens: { where: { active: true }, take: 1 } } });
  const token = gallery?.tokens[0]?.token;
  if (!gallery || !token) return new NextResponse(null, { status: 404 });
  const link = await qrLink(token);
  const options = { errorCorrectionLevel: "M" as const, margin: 3 };
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const name = `qr-${gallery.publicId}`;
  if (req.nextUrl.searchParams.get("format") === "png") {
    const png = await QRCode.toBuffer(link, { ...options, width: 1200 });
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}.png"`, "Cache-Control": "no-store" },
    });
  }
  const svg = await QRCode.toString(link, { ...options, type: "svg" });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
