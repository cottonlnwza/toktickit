import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateLab3Database } from "../../prisma/lab3-migrate.js";
import { seedDatabase } from "../../prisma/seed.js";
import { isVersionedScryptHash } from "../../src/auth/password.js";
import { requireSafeTestDatabaseUrl, resetTestDatabaseToLab2Baseline } from "./test-database.js";

describe("Lab 3 seed data", () => {
  let databaseUrl: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    databaseUrl = requireSafeTestDatabaseUrl();
    resetTestDatabaseToLab2Baseline(databaseUrl);
    await migrateLab3Database(databaseUrl);
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }, 30_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("is idempotent, satisfies minimum role fixtures, and never resets existing credentials", async () => {
    await seedDatabase(databaseUrl);

    const before = await prisma.$queryRawUnsafe<Array<{ email: string; passwordHash: string; mustChangePassword: boolean }>>(
      `SELECT "email", "passwordHash", "mustChangePassword" FROM "User" ORDER BY "email"`,
    );
    const firstStaff = before.find((user) => user.email === "it.staff.one@example.test");
    expect(firstStaff).toBeDefined();

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "mustChangePassword"=false WHERE "email"='it.staff.one@example.test'`,
    );
    await seedDatabase(databaseUrl);

    const roleCounts = await prisma.$queryRawUnsafe<Array<{ role: string; active: bigint; inactive: bigint }>>(
      `SELECT "role"::text AS role,
              COUNT(*) FILTER (WHERE "isActive") AS active,
              COUNT(*) FILTER (WHERE NOT "isActive") AS inactive
       FROM "User" GROUP BY "role" ORDER BY "role"`,
    );
    const counts = Object.fromEntries(roleCounts.map((row) => [row.role, { active: Number(row.active), inactive: Number(row.inactive) }]));
    expect(counts.REQUESTER.active).toBeGreaterThanOrEqual(4);
    expect(counts.REQUESTER.inactive).toBeGreaterThanOrEqual(1);
    expect(counts.IT_STAFF.active).toBeGreaterThanOrEqual(3);
    expect(counts.IT_STAFF.inactive).toBeGreaterThanOrEqual(1);
    expect(counts.ADMINISTRATOR.active).toBeGreaterThanOrEqual(1);

    const after = await prisma.$queryRawUnsafe<Array<{ email: string; passwordHash: string; mustChangePassword: boolean }>>(
      `SELECT "email", "passwordHash", "mustChangePassword" FROM "User" ORDER BY "email"`,
    );
    expect(after.every((user) => isVersionedScryptHash(user.passwordHash))).toBe(true);
    const afterStaff = after.find((user) => user.email === "it.staff.one@example.test");
    expect(afterStaff?.passwordHash).toBe(firstStaff?.passwordHash);
    expect(afterStaff?.mustChangePassword).toBe(false);

    const duplicateEmails = await prisma.$queryRawUnsafe<Array<{ email: string; count: bigint }>>(
      `SELECT "email", COUNT(*) AS count FROM "User" GROUP BY "email" HAVING COUNT(*) > 1`,
    );
    expect(duplicateEmails).toHaveLength(0);
  }, 30_000);

  it("seeds realistic assigned/unassigned Tickets plus Public Comments and Internal Notes", async () => {
    await seedDatabase(databaseUrl);

    const statuses = await prisma.$queryRawUnsafe<Array<{ currentStatus: string }>>(
      `SELECT DISTINCT "currentStatus"::text AS "currentStatus" FROM "Ticket" WHERE "ticketNumber" LIKE 'LAB3-%'`,
    );
    expect(new Set(statuses.map((row) => row.currentStatus))).toEqual(
      new Set(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]),
    );

    const ownership = await prisma.$queryRawUnsafe<Array<{ assigned: bigint; unassigned: bigint }>>(
      `SELECT COUNT(*) FILTER (WHERE "ownerId" IS NOT NULL) AS assigned,
              COUNT(*) FILTER (WHERE "ownerId" IS NULL) AS unassigned
       FROM "Ticket" WHERE "ticketNumber" LIKE 'LAB3-%'`,
    );
    expect(Number(ownership[0].assigned)).toBeGreaterThan(0);
    expect(Number(ownership[0].unassigned)).toBeGreaterThan(0);

    const commentCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM "PublicComment"`);
    const noteCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM "InternalNote"`);
    expect(Number(commentCount[0].count)).toBeGreaterThan(0);
    expect(Number(noteCount[0].count)).toBeGreaterThan(0);
  });
});
