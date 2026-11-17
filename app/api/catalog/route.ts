import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shadeEngine } from "@/lib/catalog/hex";

export const dynamic = "force-dynamic";

export type CatalogShade = { code: string; nameFa: string; hex: string; familyKey: string; engine: "local" | "ai" };
export type CatalogLine = {
  key: string;
  brandKey: string;
  nameFa: string;
  nameEn: string;
  families: Array<{ key: string; nameFa: string }>;
  shades: CatalogShade[];
};

// The shades a customer can try: active lines, active try-on shades with a colour.
export async function GET() {
  try {
    const lines = await db.productLine.findMany({
      where: { active: true },
      orderBy: { sort: "asc" },
      include: { brand: true, shades: { where: { active: true, tryOn: true, hex: { not: null } }, orderBy: { sort: "asc" } } },
    });
    const out: CatalogLine[] = lines.map((l) => {
      const families = new Map<string, string>();
      for (const s of l.shades) families.set(s.familyKey, s.familyFa);
      return {
        key: l.key,
        brandKey: l.brand.key,
        nameFa: l.nameFa,
        nameEn: l.nameEn,
        families: [...families].map(([key, nameFa]) => ({ key, nameFa })),
        shades: l.shades.map((s) => ({ code: s.code, nameFa: s.nameFa, hex: s.hex ?? "#000000", familyKey: s.familyKey, engine: shadeEngine(s.code) })),
      };
    });
    return NextResponse.json({ lines: out }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
