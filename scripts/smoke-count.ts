// Prints the counts for one visitor's sessions and events: used by the live smoke check.
import { config } from "dotenv";
config({ path: ".env.local" });
async function main() {
  const { makeClient } = await import("../lib/db");
  const db = makeClient();
  const since = new Date(Date.now() - 15 * 60_000);
  const sessions = await db.session.findMany({ where: { startedAt: { gte: since } }, include: { gallery: true } });
  for (const s of sessions) {
    const ev = await db.analyticsEvent.groupBy({ by: ["type", "status"], where: { sessionId: s.id }, _count: true });
    process.stdout.write(`${s.origin} ${s.gallery?.publicId ?? "-"} test=${s.isTest} ${ev.map((e) => `${e.type}${e.status ? `(${e.status})` : ""}:${e._count}`).join(" ")}\n`);
  }
  await db.$disconnect();
}
main().catch((e) => { process.stderr.write(`${String(e)}\n`); process.exit(1); });
