// Sample galleries with QR tokens, marked isSample, for development and the test site.
// Safe to run again: existing sample galleries are kept.
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const SAMPLES = [
  { publicId: "S-1001", name: "گالری نمونه یک", province: "تهران", city: "تهران" },
  { publicId: "S-1002", name: "گالری نمونه دو", province: "فارس", city: "شیراز" },
  { publicId: "S-1003", name: "گالری نمونه سه", province: "هرمزگان", city: "قشم" },
];

async function main() {
  const { makeClient } = await import("../lib/db");
  const { newQrToken } = await import("../lib/analytics/session");
  const db = makeClient();
  for (const g of SAMPLES) {
    const row = await db.gallery.upsert({
      where: { publicId: g.publicId },
      update: {},
      create: { ...g, isSample: true, tokens: { create: { token: newQrToken() } } },
      include: { tokens: true },
    });
    process.stdout.write(`${row.publicId} /q/${row.tokens[0]?.token ?? "-"}\n`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
