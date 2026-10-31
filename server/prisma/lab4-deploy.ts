import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { deployLab3Database } from "./lab3-deploy.js";

export async function deployLab4Database(databaseUrl: string) {
  // Preserve the guarded Lab 2 -> Lab 3 data migration first, then apply the
  // normal forward-only migration chain from the Lab 3 baseline to Lab 4.
  await deployLab3Database(databaseUrl);
  const serverRoot = resolve(new URL("..", import.meta.url).pathname);
  const prismaBinary = resolve(serverRoot, "node_modules/.bin/prisma");
  execFileSync(prismaBinary, ["migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  await deployLab4Database(databaseUrl);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
