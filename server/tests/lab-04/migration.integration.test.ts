import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateLab3Database } from "../../prisma/lab3-migrate.js";
import { executeSqlFile, requireSafeTestDatabaseUrl, resetTestDatabaseToLab2Baseline } from "../lab-03/test-database.js";

describe("Lab 4 migration preservation", () => {
  let databaseUrl: string;
  let prisma: PrismaClient;
  beforeAll(async () => {
    databaseUrl = requireSafeTestDatabaseUrl();
    resetTestDatabaseToLab2Baseline(databaseUrl);
    await migrateLab3Database(databaseUrl);
    const lab3 = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await lab3.$executeRawUnsafe(`UPDATE "Ticket" SET "currentStatus"='RESOLVED'::"TicketStatus", "updatedAt"='2026-09-03T03:00:00.000Z' WHERE "id"=60`);
    await lab3.$disconnect();
    executeSqlFile(databaseUrl, resolve("prisma/migrations/20261004190000_lab4_actions_foundation/migration.sql"));
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }, 60_000);
  afterAll(async () => { await prisma?.$disconnect(); });

  it("MIG-01 preserves Lab 3 data and adds Action/Event/Ticket workflow fields", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    const names = tables.map((x) => x.table_name);
    expect(names).toEqual(expect.arrayContaining(["User", "Ticket", "Attachment", "PublicComment", "InternalNote", "ActionTaken", "ActionTakenEvent"]));
    const tickets = await prisma.$queryRawUnsafe<Array<{ id: number; version: number; workflowCycle: number; resolvedAt: Date | null }>>(`SELECT "id","version","workflowCycle","resolvedAt" FROM "Ticket" ORDER BY "id"`);
    expect(tickets).toHaveLength(2);
    expect(tickets.every((t) => t.version === 0 && t.workflowCycle === 1)).toBe(true);
    expect(tickets[0].resolvedAt?.toISOString()).toBe("2026-09-03T03:00:00.000Z");
    expect(tickets[1].resolvedAt).toBeNull();
    expect(await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "Attachment"`)).toEqual([{ count: 1n }]);
  });
});
