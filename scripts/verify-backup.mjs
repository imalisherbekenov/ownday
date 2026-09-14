// Restore rehearsal for an isolated local test database. Never accepts the production DATABASE_URL.
import { PrismaClient } from "../packages/db/generated/client/index.js";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = new URL(process.env.TEST_DATABASE_URL ?? "http://invalid");
if (
  !["postgres:", "postgresql:"].includes(source.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(source.hostname) ||
  !/^\/ownday_test[a-z0-9_]*$/.test(source.pathname)
)
  throw new Error("TEST_DATABASE_URL must name an isolated local ownday_test database");
const name = `ownday_test_restore_${randomUUID().replaceAll("-", "")}`;
const target = new URL(source);
target.pathname = `/${name}`;
target.search = "";
const directory = path.join(root, ".test-postgres", "backups");
mkdirSync(directory, { recursive: true });
const archive = path.join(directory, `${name}.dump`);
const env = {
  ...process.env,
  PGHOST: source.hostname.replace(/^\[|\]$/g, ""),
  PGPORT: source.port || "5432",
  PGUSER: decodeURIComponent(source.username),
  PGPASSWORD: decodeURIComponent(source.password),
  PGDATABASE: source.pathname.slice(1),
};
function cli(binary, args) {
  const executable = process.env.PG_BIN
    ? path.join(process.env.PG_BIN, binary + (process.platform === "win32" ? ".exe" : ""))
    : binary;
  const result = spawnSync(executable, args, {
    env,
    encoding: "utf8",
    timeout: 120000,
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `${binary} failed (${result.error?.code ?? result.status}); archive retained for inspection`,
    );
}
const sourceDb = new PrismaClient({ datasources: { db: { url: source.toString() } } });
const restored = new PrismaClient({ datasources: { db: { url: target.toString() } } });
async function fingerprint(db) {
  const tables =
    await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const results = [];
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const [result] = await db.$queryRawUnsafe(
      `SELECT count(*)::text AS count, md5(coalesce(string_agg(row_to_json(r)::text, E'\\n' ORDER BY row_to_json(r)::text),'')) AS checksum FROM public.${quoted} r`,
    );
    results.push({ table: tablename, ...result });
  }
  return results;
}
let created = false;
let fixtureUser;
try {
  if (process.argv.includes("--with-fixture")) {
    fixtureUser = randomUUID();
    await sourceDb.user.create({
      data: { id: fixtureUser, timezone: "America/New_York", dayStartHour: 4, locale: "ru" },
    });
    const habit = await sourceDb.habit.create({
      data: {
        userId: fixtureUser,
        title: "Restore rehearsal / проверка",
        icon: "water",
        color: "moss",
        category: "general",
        type: "counter",
        targetValue: 8,
      },
    });
    await sourceDb.scheduleVersion.create({
      data: {
        habitId: habit.id,
        kind: "daily",
        config: { kind: "daily" },
        validFrom: new Date("2026-09-01T00:00:00Z"),
      },
    });
    await sourceDb.entry.create({
      data: {
        habitId: habit.id,
        userId: fixtureUser,
        localDate: new Date("2026-09-13T00:00:00Z"),
        value: 2.5,
        status: "miss",
        source: "mobile",
        clientId: randomUUID(),
      },
    });
  }
  const before = await fingerprint(sourceDb);
  cli("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", archive]);
  await sourceDb.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  created = true;
  cli("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", name, archive]);
  const after = await fingerprint(restored);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error(
      "Restored table fingerprints differ; ensure no writers are using the test database",
    );
  writeFileSync(
    archive + ".verification.json",
    JSON.stringify({ verifiedAt: new Date().toISOString(), tables: after }, null, 2),
  );
  console.log(
    `Backup restored and verified: ${after.length} tables. Archive: ${path.relative(root, archive)}`,
  );
} finally {
  await restored.$disconnect();
  if (created && /^ownday_test_restore_[a-f0-9]{32}$/.test(name))
    await sourceDb.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
  if (fixtureUser) await sourceDb.user.deleteMany({ where: { id: fixtureUser } });
  await sourceDb.$disconnect();
}
