import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { getLab3E2EDatabaseUrl } from "../lab-03/database.js";

export default async function globalSetup() {
  const root = process.cwd();
  const serverRoot = resolve(root, "server");
  const databaseUrl = getLab3E2EDatabaseUrl();
  const prisma = resolve(serverRoot, "node_modules/.bin/prisma");

  execFileSync(prisma, ["db", "execute", "--stdin", "--url", databaseUrl], {
    cwd: serverRoot,
    input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
  execFileSync("npm", ["run", "prisma:deploy:lab4"], {
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
