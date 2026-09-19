import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const serverRoot = resolve(root, "server");

function readDevelopmentDatabaseUrl() {
  const env = readFileSync(resolve(serverRoot, ".env"), "utf8");
  const match = env.match(/^DATABASE_URL=(?:"([^"]+)"|'([^']+)'|([^\n]+))/m);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!value) throw new Error("server/.env must define DATABASE_URL before Lab 3 E2E can run.");
  return value.trim();
}

function databaseIdentity(raw: string) {
  const url = new URL(raw);
  return `${url.protocol}//${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
}

export function getLab3E2EDatabaseUrl() {
  const developmentUrl = readDevelopmentDatabaseUrl();
  const requested = process.env.E2E_DATABASE_URL;
  const testUrl = requested || (() => {
    const derived = new URL(developmentUrl);
    derived.pathname = "/toktickit_lab3_suite_test";
    return derived.toString();
  })();
  const databaseName = new URL(testUrl).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) throw new Error("Lab 3 E2E database name must end in _test.");
  if (databaseIdentity(testUrl) === databaseIdentity(developmentUrl)) {
    throw new Error("Lab 3 E2E must never target the normal development DATABASE_URL.");
  }
  return testUrl;
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
