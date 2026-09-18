import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "../..");
const prismaBinary = resolve(serverRoot, "node_modules/.bin/prisma");

function readDevDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(resolve(serverRoot, ".env"), "utf8");
    const match = env.match(/^DATABASE_URL=(?:"([^"]+)"|'([^']+)'|([^\n]+))/m);
    return match?.[1] ?? match?.[2] ?? match?.[3];
  } catch {
    return undefined;
  }
}

function normalizedDatabaseIdentity(rawUrl: string): string {
  const url = new URL(rawUrl);
  return `${url.protocol}//${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
}

export function requireSafeTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL is required for Lab 3 migration/seed integration tests.");

  const test = new URL(testUrl);
  const databaseName = test.pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL database name must end in _test.");
  }

  const devUrl = readDevDatabaseUrl();
  if (devUrl && normalizedDatabaseIdentity(devUrl) === normalizedDatabaseIdentity(testUrl)) {
    throw new Error("TEST_DATABASE_URL must not point to the development DATABASE_URL.");
  }

  return testUrl;
}

export function executeSql(databaseUrl: string, sql: string): void {
  execFileSync(prismaBinary, ["db", "execute", "--stdin", "--url", databaseUrl], {
    cwd: serverRoot,
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
}

export function executeSqlFile(databaseUrl: string, file: string): void {
  execFileSync(prismaBinary, ["db", "execute", "--file", file, "--url", databaseUrl], {
    cwd: serverRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

export function resetTestDatabaseEmpty(databaseUrl: string): void {
  executeSql(databaseUrl, 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
}

export function resetTestDatabaseToLab2Baseline(databaseUrl: string): void {
  resetTestDatabaseEmpty(databaseUrl);
  executeSqlFile(databaseUrl, resolve(serverRoot, "prisma/migrations/20260809225834_init/migration.sql"));
  executeSqlFile(databaseUrl, resolve(serverRoot, "prisma/migrations/20260903144335_lab2_database_seed/migration.sql"));

  executeSql(
    databaseUrl,
    `
      INSERT INTO "Category" ("id", "name", "isActive", "createdAt") VALUES
        (1, 'Hardware', true, '2026-09-01T00:00:00.000Z'),
        (2, 'Software', true, '2026-09-01T00:00:00.000Z');

      INSERT INTO "RelatedSystem" ("id", "name", "isActive", "createdAt", "updatedAt") VALUES
        (1, 'Email', true, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
        (2, 'Corporate Laptop', true, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');

      INSERT INTO "RequesterUser" ("id", "name", "email", "isActive", "createdAt", "updatedAt") VALUES
        (1, ' Legacy One ', 'Legacy.One@Example.Test ', true, '2026-09-01T01:00:00.000Z', '2026-09-02T01:00:00.000Z'),
        (2, 'Legacy Two', 'legacy.two@example.test', false, '2026-09-01T02:00:00.000Z', '2026-09-02T02:00:00.000Z');

      INSERT INTO "Ticket" (
        "id", "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "summary", "description",
        "requestedPriority", "currentStatus", "createdAt", "updatedAt"
      ) VALUES
        (60, 'TTK-20260901-0001', 1, 1, 2, 'Battery issue', 'Battery drains quickly during class.', 'MEDIUM', 'NEW', '2026-09-01T03:00:00.000Z', '2026-09-02T03:00:00.000Z'),
        (333, 'TTK-20260901-0002', 2, 2, 1, 'Email issue', 'Unable to access the mailbox from campus.', 'HIGH', 'NEW', '2026-09-01T04:00:00.000Z', '2026-09-02T04:00:00.000Z');

      INSERT INTO "Attachment" (
        "id", "ticketId", "originalFilename", "storedFilename", "mimeType", "sizeBytes", "storagePath",
        "uploadedAt", "removedAt", "removedByRequesterId", "removalReason"
      ) VALUES
        (9, 60, 'battery.pdf', 'legacy-battery.pdf', 'application/pdf', 1024, 'server/uploads/lab-02/legacy-battery.pdf',
         '2026-09-01T03:30:00.000Z', '2026-09-01T05:00:00.000Z', 1, 'Duplicate evidence');

      SELECT setval(pg_get_serial_sequence('"Category"', 'id'), 2, true);
      SELECT setval(pg_get_serial_sequence('"RelatedSystem"', 'id'), 2, true);
      SELECT setval(pg_get_serial_sequence('"RequesterUser"', 'id'), 2, true);
      SELECT setval(pg_get_serial_sequence('"Ticket"', 'id'), 333, true);
      SELECT setval(pg_get_serial_sequence('"Attachment"', 'id'), 9, true);
    `,
  );
}
