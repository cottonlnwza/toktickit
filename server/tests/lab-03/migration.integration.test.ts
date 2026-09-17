import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { legacyClientRequestId, migrateLab3Database } from "../../prisma/lab3-migrate.js";
import { hashPassword, isVersionedScryptHash, verifyPassword } from "../../src/auth/password.js";
import { requireSafeTestDatabaseUrl, resetTestDatabaseToLab2Baseline } from "./test-database.js";

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
      `SELECT "id", "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "requestedPriority",
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
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "NEW",
      clientRequestId: legacyClientRequestId(60),
      ownerId: null,
      problemAppearsResolvedAt: null,
      problemAppearsResolvedById: null,
    });
    expect(tickets[1]).toMatchObject({
      id: 333,
      requesterId: 2,
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      clientRequestId: legacyClientRequestId(333),
    });

    const attachments = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "ticketId", "originalFilename", "storedFilename", "removedAt", "removedByUserId", "removalReason"
       FROM "Attachment" ORDER BY "id"`,
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      id: 9,
      ticketId: 60,
      originalFilename: "battery.pdf",
      storedFilename: "legacy-battery.pdf",
      removedByUserId: 1,
      removalReason: "Duplicate evidence",
    });
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
});
