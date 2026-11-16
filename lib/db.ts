import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// One client per server process; Next's dev reload would otherwise open a pool per edit.
const holder = globalThis as unknown as { ayenehPrisma?: PrismaClient };

export function makeClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

// Built on first use, not at import, so a build without DATABASE_URL does not fail.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = holder.ayenehPrisma ?? (holder.ayenehPrisma = makeClient());
    const v = Reflect.get(client, prop, client) as unknown;
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(client) : v;
  },
});
