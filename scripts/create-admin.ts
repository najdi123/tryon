// Creates a panel user (or resets its password) with a generated password.
// The password is written to a file only the owner can read; it is never printed.
//   npx tsx scripts/create-admin.ts <username> "<display name>" [ADMIN|VIEWER] [output file]
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

async function main() {
  const [username, displayName, roleArg, fileArg] = process.argv.slice(2);
  if (!username || !displayName || !/^[a-z0-9.-]{3,30}$/.test(username)) {
    process.stderr.write('usage: create-admin.ts <username> "<display name>" [ADMIN|VIEWER] [output file]\n');
    process.exit(1);
  }
  const asked = roleArg === "VIEWER" || roleArg === "ADMIN" ? roleArg : null;
  const file = fileArg ?? `panel-password-${username}.txt`;
  const password = randomBytes(12).toString("base64url");
  const salt = randomBytes(16);
  const passwordHash = `scrypt$${salt.toString("base64")}$${(await scrypt(password, salt, 64)).toString("base64")}`;
  const { makeClient } = await import("../lib/db");
  const db = makeClient();
  const existed = await db.adminUser.findUnique({ where: { username } });
  const role = asked ?? existed?.role ?? "ADMIN"; // a reset keeps the user's role unless one is given
  await db.adminUser.upsert({
    where: { username },
    update: { passwordHash, displayName, role, active: true },
    create: { username, displayName, role, passwordHash },
  });
  if (existed) await db.adminSession.deleteMany({ where: { adminUserId: existed.id } });
  writeFileSync(file, `${username}\n${password}\n`, { mode: 0o600 });
  chmodSync(file, 0o600); // an existing file keeps its old permissions otherwise
  process.stdout.write(`${existed ? "password reset for" : "created"} ${username} (${role}); the password is in ${file}\n`);
  await db.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
