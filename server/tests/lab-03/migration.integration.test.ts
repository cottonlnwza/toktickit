import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deployLab3Database, LAB3_MIGRATION_NAME } from "../../prisma/lab3-deploy.js";
import { legacyClientRequestId, migrateLab3Database } from "../../prisma/lab3-migrate.js";
import { hashPassword, isVersionedScryptHash, verifyPassword } from "../../src/auth/password.js";
import {
  requireSafeTestDatabaseUrl,
  resetTestDatabaseEmpty,
  resetTestDatabaseToLab2Baseline,
} from "./test-database.js";

const INITIAL_PASSWORD = "Lab3-ChangeMe-2026";

describe("Lab 3 migration/regression", () => {
  let databaseUrl: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    databaseUrl = requireSafeTestDatabaseUrl();
    resetTestDatabaseToLab2Baseline(databaseUrl);
    await migrateLab3Database(databaseUrl);
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }, 30_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("preserves legacy identities, Ticket ownership, Attachment metadata, and deterministic replay keys", async () => {
    const users = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "name", "email", "role", "isActive", "passwordHash", "mustChangePassword", "createdAt", "updatedAt"
       FROM "User" ORDER BY "id"`,
    );
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      id: 1,
      name: "Legacy One",
      email: "legacy.one@example.test",
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: true,
    });
    expect(users[1]).toMatchObject({ id: 2, role: "REQUESTER", isActive: false });

    const firstHash = String(users[0].passwordHash);
    const secondHash = String(users[1].passwordHash);
    expect(isVersionedScryptHash(firstHash)).toBe(true);
    expect(isVersionedScryptHash(secondHash)).toBe(true);
    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPassword(INITIAL_PASSWORD, firstHash)).resolves.toBe(true);
    await expect(verifyPassword(INITIAL_PASSWORD, secondHash)).resolves.toBe(true);

    const tickets = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "requestedPriority",
              "itPriority", "currentStatus", "clientRequestId", "ownerId", "problemAppearsResolvedAt", "problemAppearsResolvedById",
              "createdAt", "updatedAt"
       FROM "Ticket" ORDER BY "id"`,
    );
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toMatchObject({
      id: 60,
      ticketNumber: "TTK-20260901-0001",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 2,
      summary: "Battery issue",
      description: "Battery drains quickly during class.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "NEW",
      clientRequestId: legacyClientRequestId(60),
      ownerId: null,
      problemAppearsResolvedAt: null,
      problemAppearsResolvedById: null,
    });
    expect((tickets[0].createdAt as Date).toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect((tickets[0].updatedAt as Date).toISOString()).toBe("2026-09-02T03:00:00.000Z");
    expect(tickets[1]).toMatchObject({
      id: 333,
      ticketNumber: "TTK-20260901-0002",
      requesterId: 2,
      categoryId: 2,
      relatedSystemId: 1,
      summary: "Email issue",
      description: "Unable to access the mailbox from campus.",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      clientRequestId: legacyClientRequestId(333),
    });
    expect((tickets[1].createdAt as Date).toISOString()).toBe("2026-09-01T04:00:00.000Z");
    expect((tickets[1].updatedAt as Date).toISOString()).toBe("2026-09-02T04:00:00.000Z");

    const attachments = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "ticketId", "originalFilename", "storedFilename", "mimeType", "sizeBytes", "storagePath",
              "uploadedAt", "removedAt", "removedByUserId", "removalReason"
       FROM "Attachment" ORDER BY "id"`,
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      id: 9,
      ticketId: 60,
      originalFilename: "battery.pdf",
      storedFilename: "legacy-battery.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storagePath: "server/uploads/lab-02/legacy-battery.pdf",
      removedByUserId: 1,
      removalReason: "Duplicate evidence",
    });
    expect((attachments[0].uploadedAt as Date).toISOString()).toBe("2026-09-01T03:30:00.000Z");
    expect((attachments[0].removedAt as Date).toISOString()).toBe("2026-09-01T05:00:00.000Z");
  });

  it("creates the required constraints, relations, and Lab 3 foundation tables", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
    );
    const names = tables.map((row) => row.table_name);
    expect(names).toEqual(expect.arrayContaining(["User", "AuthSession", "PublicComment", "InternalNote", "Ticket", "Attachment"]));
    expect(names).not.toContain("RequesterUser");

    const nullable = await prisma.$queryRawUnsafe<Array<{ column_name: string; is_nullable: string }>>(
      `SELECT column_name, is_nullable
       FROM information_schema.columns
       WHERE table_name='Ticket' AND column_name IN ('clientRequestId','itPriority','ownerId')`,
    );
    expect(nullable).toEqual(expect.arrayContaining([
      { column_name: "clientRequestId", is_nullable: "NO" },
      { column_name: "itPriority", is_nullable: "NO" },
      { column_name: "ownerId", is_nullable: "YES" },
    ]));

    const foreignKeys = await prisma.$queryRawUnsafe<Array<{ name: string; deleteAction: string }>>(
      `SELECT conname AS name, confdeltype::text AS "deleteAction"
       FROM pg_constraint
       WHERE contype='f'
         AND conname IN (
           'Ticket_requesterId_fkey', 'Ticket_ownerId_fkey', 'Ticket_problemAppearsResolvedById_fkey',
           'Ticket_categoryId_fkey', 'Ticket_relatedSystemId_fkey', 'Attachment_ticketId_fkey',
           'Attachment_removedByUserId_fkey', 'AuthSession_userId_fkey',
           'PublicComment_ticketId_fkey', 'PublicComment_authorId_fkey',
           'InternalNote_ticketId_fkey', 'InternalNote_authorId_fkey'
         )
       ORDER BY conname`,
    );
    expect(Object.fromEntries(foreignKeys.map((row) => [row.name, row.deleteAction]))).toEqual({
      Attachment_removedByUserId_fkey: "n",
      Attachment_ticketId_fkey: "r",
      AuthSession_userId_fkey: "c",
      InternalNote_authorId_fkey: "r",
      InternalNote_ticketId_fkey: "r",
      PublicComment_authorId_fkey: "r",
      PublicComment_ticketId_fkey: "r",
      Ticket_categoryId_fkey: "r",
      Ticket_ownerId_fkey: "n",
      Ticket_problemAppearsResolvedById_fkey: "n",
      Ticket_requesterId_fkey: "r",
      Ticket_relatedSystemId_fkey: "r",
    });

    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public'`,
    );
    const indexNames = new Set(indexes.map((row) => row.indexname));
    for (const indexName of [
      "User_email_key",
      "User_role_isActive_idx",
      "Ticket_clientRequestId_key",
      "Ticket_requesterId_updatedAt_idx",
      "Ticket_requesterId_ticketNumber_idx",
      "Ticket_requesterId_categoryId_idx",
      "Ticket_requesterId_relatedSystemId_idx",
      "Ticket_requesterId_requestedPriority_idx",
      "Ticket_ownerId_updatedAt_idx",
      "Ticket_requestedPriority_updatedAt_idx",
      "Ticket_itPriority_updatedAt_idx",
      "Ticket_currentStatus_updatedAt_idx",
      "Ticket_updatedAt_idx",
      "Ticket_categoryId_updatedAt_idx",
      "Ticket_relatedSystemId_updatedAt_idx",
      "Attachment_ticketId_removedAt_idx",
      "AuthSession_tokenHash_key",
      "AuthSession_userId_revokedAt_idx",
      "AuthSession_expiresAt_idx",
      "PublicComment_ticketId_createdAt_idx",
      "PublicComment_authorId_idx",
      "InternalNote_ticketId_createdAt_idx",
      "InternalNote_authorId_idx",
    ]) {
      expect(indexNames.has(indexName), `missing index ${indexName}`).toBe(true);
    }

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "Ticket" SET "clientRequestId" = '${legacyClientRequestId(60)}' WHERE "id" = 333`),
    ).rejects.toMatchObject({ code: "P2010" });
  });

  it("is rerun-safe and does not reset already changed credentials", async () => {
    const changedHash = await hashPassword("Changed-Lab3-Password-2026");
    await prisma.$executeRaw`
      UPDATE "User"
      SET "passwordHash"=${changedHash}, "mustChangePassword"=false
      WHERE "id"=1
    `;

    await migrateLab3Database(databaseUrl);

    const users = await prisma.$queryRawUnsafe<Array<{ id: number; passwordHash: string; mustChangePassword: boolean }>>(
      `SELECT "id", "passwordHash", "mustChangePassword" FROM "User" WHERE "id"=1`,
    );
    expect(users[0]).toEqual({ id: 1, passwordHash: changedHash, mustChangePassword: false });
  });

  it("rejects unsupported deterministic Ticket ids instead of truncating or overflowing", () => {
    expect(() => legacyClientRequestId(1_000_000_000_000)).toThrow(/range/i);
  });

  it("aborts before mutation when legacy emails collide after trim/lowercase normalization", async () => {
    resetTestDatabaseToLab2Baseline(databaseUrl);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "RequesterUser" ("id", "name", "email", "isActive", "createdAt", "updatedAt")
      VALUES (3, 'Collision User', 'legacy.one@example.test', true, NOW(), NOW())
    `);

    await expect(migrateLab3Database(databaseUrl)).rejects.toThrow(/normalization collision/i);

    const state = await prisma.$queryRawUnsafe<Array<{
      requesterCount: bigint;
      ticketCount: bigint;
      attachmentCount: bigint;
      userTableExists: boolean;
      clientRequestIdExists: boolean;
    }>>(`
      SELECT
        (SELECT COUNT(*) FROM "RequesterUser") AS "requesterCount",
        (SELECT COUNT(*) FROM "Ticket") AS "ticketCount",
        (SELECT COUNT(*) FROM "Attachment") AS "attachmentCount",
        to_regclass('public."User"') IS NOT NULL AS "userTableExists",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='Ticket' AND column_name='clientRequestId'
        ) AS "clientRequestIdExists"
    `);
    expect(state[0]).toEqual({
      requesterCount: 3n,
      ticketCount: 2n,
      attachmentCount: 1n,
      userTableExists: false,
      clientRequestIdExists: false,
    });
  });

  it("deploys from an empty database through the documented path and reconciles Prisma migration history", async () => {
    resetTestDatabaseEmpty(databaseUrl);

    await deployLab3Database(databaseUrl);
    await expect(deployLab3Database(databaseUrl)).resolves.toBeUndefined();

    const tables = await prisma.$queryRawUnsafe<Array<{ userTable: boolean; legacyTable: boolean }>>(`
      SELECT
        to_regclass('public."User"') IS NOT NULL AS "userTable",
        to_regclass('public."RequesterUser"') IS NOT NULL AS "legacyTable"
    `);
    expect(tables[0]).toEqual({ userTable: true, legacyTable: false });

    const migrationHistory = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
       ORDER BY migration_name`,
    );
    expect(migrationHistory.map((row) => row.migration_name)).toEqual([
      "20260809225834_init",
      "20260903144335_lab2_database_seed",
      LAB3_MIGRATION_NAME,
    ]);
  }, 30_000);
});
