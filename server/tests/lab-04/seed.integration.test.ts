import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deployLab4Database } from "../../prisma/lab4-deploy.js";
import { seedDatabase } from "../../prisma/seed.js";
import { requireSafeTestDatabaseUrl, resetTestDatabaseEmpty } from "../lab-03/test-database.js";

describe("Lab 4 seed", () => {
  let databaseUrl: string;
  let prisma: PrismaClient;
  beforeAll(async () => {
    databaseUrl = requireSafeTestDatabaseUrl();
    resetTestDatabaseEmpty(databaseUrl);
    await deployLab4Database(databaseUrl);
    await seedDatabase(databaseUrl);
    await seedDatabase(databaseUrl);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }, 60_000);
  afterAll(async () => { await prisma?.$disconnect(); });

  it("SEED-01 is idempotent and provides zero/one/many Actions plus audit events", async () => {
    const tickets = await prisma.ticket.findMany({ include: { actionsTaken: true } });
    const counts = tickets.map((t) => t.actionsTaken.length);
    expect(counts.some((n) => n === 0)).toBe(true);
    expect(counts.some((n) => n === 1)).toBe(true);
    expect(counts.some((n) => n >= 2)).toBe(true);
    expect(await prisma.actionTaken.count()).toBeGreaterThan(0);
    expect(await prisma.actionTakenEvent.count()).toBeGreaterThanOrEqual(await prisma.actionTaken.count());
    const uniqueIds = await prisma.actionTaken.groupBy({ by: ["clientRequestId"], _count: true });
    expect(uniqueIds.every((r) => r._count === 1)).toBe(true);
  });
});
