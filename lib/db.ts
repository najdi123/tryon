import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// One client per server process; Next's dev reload would otherwise open a pool per edit.
const holder = globalThis as unknown as { ayenehPrisma?: PrismaClient };

export function makeClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const db: PrismaClient = holder.ayenehPrisma ?? (holder.ayenehPrisma = makeClient());
