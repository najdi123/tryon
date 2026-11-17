// Sample usage for the SAMPLE galleries only, so the panel has something to show in sample mode.
// Nothing here touches a real gallery, and the panel never mixes sample data into real reports.
// Safe to run again: the sample galleries' sessions are replaced.
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const SAMPLES = [
  { publicId: "S-1001", name: "گالری نمونه یک", province: "تهران", city: "تهران", weight: 9 },
  { publicId: "S-1002", name: "گالری نمونه دو", province: "فارس", city: "شیراز", weight: 6 },
  { publicId: "S-1003", name: "گالری نمونه سه", province: "هرمزگان", city: "قشم", weight: 5 },
  { publicId: "S-1004", name: "گالری نمونه چهار", province: "تهران", city: "تهران", weight: 4 },
  { publicId: "S-1005", name: "گالری نمونه پنج", province: "اصفهان", city: "اصفهان", weight: 3 },
  { publicId: "S-1006", name: "گالری نمونه شش", province: "فارس", city: "مرودشت", weight: 0 }, // registered, no visits
];

// A small fixed-seed generator: the same sample numbers every run.
let seed = 20261117;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

async function main() {
  const { makeClient } = await import("../lib/db");
  const { newQrToken } = await import("../lib/analytics/session");
  const db = makeClient();
  const galleries = [];
  for (const g of SAMPLES) {
    const { weight, ...data } = g;
    const row = await db.gallery.upsert({
      where: { publicId: g.publicId },
      update: { name: data.name, province: data.province, city: data.city },
      create: { ...data, isSample: true, tokens: { create: { token: newQrToken() } } },
      include: { tokens: { where: { active: true }, take: 1 } },
    });
    if (!row.isSample) throw new Error(`${g.publicId} is a real gallery: refusing to write sample data to it`);
    galleries.push({ id: row.id, tokenId: row.tokens[0]?.id ?? null, weight });
  }
  const ids = galleries.map((g) => g.id);
  const removed = await db.session.deleteMany({ where: { galleryId: { in: ids } } });

  const shades = await db.shade.findMany({ where: { tryOn: true, active: true }, select: { id: true, lineId: true } });
  const popular = shades.filter((_, i) => i % 9 === 0); // a few shades get most of the attention
  type Ev = { eventId: string; type: string; sessionId: string; galleryId: string; createdAt: Date; lineId?: string; shadeId?: string; status?: string };
  const sessions = [];
  const events: Ev[] = [];
  const now = Date.now();
  for (let day = 0; day < 35; day++) {
    for (const g of galleries) {
      const count = Math.round(g.weight * (0.6 + rnd() * 0.9));
      for (let i = 0; i < count; i++) {
        const at = new Date(now - day * 86_400_000 - Math.floor(rnd() * 80_000_000));
        if (at.getTime() > now) continue;
        const sid = randomUUID();
        sessions.push({ id: sid, visitorId: rnd() < 0.25 ? `repeat-${Math.floor(rnd() * 60)}` : randomUUID(), origin: "QR" as const,
          galleryId: g.id, qrTokenId: g.tokenId, qrEnteredAt: at, startedAt: at, lastSeenAt: at });
        const ev = (type: string, extra: { lineId?: string; shadeId?: string; status?: string } = {}, offset = 0) =>
          events.push({ eventId: randomUUID(), type, sessionId: sid, galleryId: g.id, createdAt: new Date(at.getTime() + offset * 1000), ...extra });
        ev("SESSION_STARTED");
        ev("QR_LANDING");
        if (rnd() < 0.82) {
          const first = pick(rnd() < 0.7 ? popular : shades);
          ev("BRAND_SELECTED", { lineId: first.lineId }, 8);
          if (rnd() < 0.8) {
            ev("PHOTO_READY", {}, 40);
            const tries = 1 + Math.floor(rnd() * 4);
            for (let t = 0; t < tries; t++) {
              const lineShades = (rnd() < 0.7 ? popular : shades).filter((s) => s.lineId === first.lineId);
              const s = pick(lineShades.length ? lineShades : [first]);
              ev("SHADE_SELECTED", { lineId: s.lineId, shadeId: s.id }, 60 + t * 40);
              if (rnd() < 0.85) {
                ev("TRYON_STARTED", { lineId: s.lineId, shadeId: s.id, status: "ai" }, 62 + t * 40);
                ev(rnd() < 0.9 ? "TRYON_SUCCEEDED" : "TRYON_FAILED", { lineId: s.lineId, shadeId: s.id, status: "ai" }, 70 + t * 40);
              }
            }
          }
        }
      }
    }
  }
  await db.session.createMany({ data: sessions });
  for (let i = 0; i < events.length; i += 2000) {
    await db.analyticsEvent.createMany({ data: events.slice(i, i + 2000) as never });
  }
  process.stdout.write(`sample data: removed ${removed.count} old sessions, wrote ${sessions.length} sessions and ${events.length} events for ${galleries.length} sample galleries\n`);
  await db.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
