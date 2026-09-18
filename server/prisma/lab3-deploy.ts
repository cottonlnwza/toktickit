import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { migrateLab3Database } from "./lab3-migrate.js";

export const LAB3_MIGRATION_NAME = "20260918010000_lab3_user_migration_seed";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "..");
const prismaBinary = resolve(serverRoot, "node_modules/.bin/prisma");

function runPrisma(args: string[], databaseUrl: string): void {
  execFileSync(prismaBinary, args, {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function tableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1
    ) AS "exists"`,
    tableName,
  );
  return Boolean(rows[0]?.exists);
}

async function expectedLab3GuardFailureExists(prisma: PrismaClient): Promise<boolean> {
  const migrationsTableExists = await tableExists(prisma, "_prisma_migrations");
  if (!migrationsTableExists) return false;

  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count
     FROM "_prisma_migrations"
     WHERE migration_name=$1
       AND finished_at IS NULL
       AND rolled_back_at IS NULL
       AND logs LIKE '%LAB3_DATA_MIGRATION_REQUIRED%'`,
    LAB3_MIGRATION_NAME,
  );
  return (rows[0]?.count ?? 0n) > 0n;
}

export async function deployLab3Database(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    try {
      runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databaseUrl);
    } catch (error) {
      const requesterUserExists = await tableExists(prisma, "RequesterUser");
      const userExists = await tableExists(prisma, "User");
      const expectedFailure = await expectedLab3GuardFailureExists(prisma);

      if (!requesterUserExists || userExists || !expectedFailure) throw error;

      runPrisma(
        ["migrate", "resolve", "--rolled-back", LAB3_MIGRATION_NAME, "--schema", "prisma/schema.prisma"],
        databaseUrl,
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  await migrateLab3Database(databaseUrl);

  // The guarded migration is now safe to record through Prisma's normal
  // migration history. A second deploy also proves that no migration remains
  // pending after the custom data-preserving step.
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databaseUrl);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  await deployLab3Database(databaseUrl);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
