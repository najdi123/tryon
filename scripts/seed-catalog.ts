// Loads data/catalog-official.json into the database. Safe to run again:
// it updates names and order, and never deletes a shade (events may point at it).
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Shade = { code: string; nameFa: string; nameEn: string; faSource: string };
type Family = { key: string; nameFa: string; nameEn: string; tryOn: boolean; shades: Shade[] };
type Line = { key: string; brand: string; nameFa: string; nameEn: string; families: Family[] };

const BRANDS: Record<string, { key: string; nameFa: string; sort: number }> = {
  Bianca: { key: "bianca", nameFa: "بیانکا", sort: 1 },
  Oyster: { key: "oyster", nameFa: "اویستر", sort: 2 },
};

async function main() {
  const { makeClient } = await import("../lib/db");
  const db = makeClient();
  const cat = JSON.parse(readFileSync("data/catalog-official.json", "utf8")) as { lines: Line[] };
  let lineSort = 0;
  for (const line of cat.lines) {
    const b = BRANDS[line.brand];
    const brand = await db.brand.upsert({
      where: { key: b.key },
      update: { nameFa: b.nameFa, nameEn: line.brand, sort: b.sort },
      create: { key: b.key, nameFa: b.nameFa, nameEn: line.brand, sort: b.sort },
    });
    lineSort += 1;
    const row = await db.productLine.upsert({
      where: { key: line.key },
      update: { nameFa: line.nameFa, nameEn: line.nameEn, sort: lineSort, brandId: brand.id },
      create: { key: line.key, nameFa: line.nameFa, nameEn: line.nameEn, sort: lineSort, brandId: brand.id },
    });
    let sort = 0;
    for (const fam of line.families) {
      for (const s of fam.shades) {
        sort += 1;
        const data = {
          nameFa: s.nameFa,
          nameEn: s.nameEn,
          familyKey: fam.key,
          familyFa: fam.nameFa,
          tryOn: fam.tryOn,
          nameChecked: s.faSource === "chart",
          sort,
        };
        await db.shade.upsert({
          where: { lineId_code: { lineId: row.id, code: s.code } },
          update: data,
          create: { ...data, lineId: row.id, code: s.code },
        });
      }
    }
    const n = await db.shade.count({ where: { lineId: row.id } });
    process.stdout.write(`${line.key}: ${n} shades\n`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
