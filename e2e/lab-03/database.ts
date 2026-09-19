import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const serverRoot = resolve(root, "server");

export type PostgreSqlConnectionTarget = {
  protocol: "postgresql:";
  hostname: string;
  port: string;
  database: string;
  username: string;
};

function readDevelopmentDatabaseUrl() {
  const env = readFileSync(resolve(serverRoot, ".env"), "utf8");
  const match = env.match(/^DATABASE_URL=(?:"([^"]+)"|'([^']+)'|([^\n]+))/m);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!value) throw new Error("server/.env must define DATABASE_URL before Lab 3 E2E can run.");
  return value.trim();
}

function normalizePostgresHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(normalized)) return "loopback";
  return normalized;
}

export function parsePostgreSqlConnectionTarget(raw: string): PostgreSqlConnectionTarget {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Lab 3 E2E database URL must be a valid PostgreSQL connection URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Lab 3 E2E database URL must use the postgres or postgresql protocol.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database) {
    throw new Error("Lab 3 E2E database URL must include a hostname and database name.");
  }

  return {
    protocol: "postgresql:",
    hostname: normalizePostgresHostname(url.hostname),
    port: url.port || "5432",
    database,
    username: decodeURIComponent(url.username),
  };
}

function sameDestructiveDatabaseTarget(a: PostgreSqlConnectionTarget, b: PostgreSqlConnectionTarget) {
  return a.protocol === b.protocol
    && a.hostname === b.hostname
    && a.port === b.port
    && a.database === b.database;
}

export function validateLab3E2EDatabaseUrl(developmentUrl: string, requestedUrl?: string) {
  const developmentTarget = parsePostgreSqlConnectionTarget(developmentUrl);
  const testUrl = requestedUrl || (() => {
    const derived = new URL(developmentUrl);
    derived.pathname = "/toktickit_lab3_suite_test";
    return derived.toString();
  })();
  const testTarget = parsePostgreSqlConnectionTarget(testUrl);

  if (sameDestructiveDatabaseTarget(testTarget, developmentTarget)) {
    throw new Error("Lab 3 E2E must never target the normal development DATABASE_URL.");
  }
  if (!testTarget.database.endsWith("_test")) {
    throw new Error("Lab 3 E2E database name must end in _test.");
  }

  return testUrl;
}

export function getLab3E2EDatabaseUrl() {
  return validateLab3E2EDatabaseUrl(readDevelopmentDatabaseUrl(), process.env.E2E_DATABASE_URL);
}

export function prepareLab3E2EDatabase() {
  const databaseUrl = getLab3E2EDatabaseUrl();
  const prisma = resolve(serverRoot, "node_modules/.bin/prisma");
  execFileSync(prisma, ["db", "execute", "--stdin", "--url", databaseUrl], {
    cwd: serverRoot,
    input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
  execFileSync("npm", ["run", "prisma:deploy:lab3"], {
    cwd: serverRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  execFileSync("npm", ["run", "prisma:seed"], {
    cwd: serverRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
