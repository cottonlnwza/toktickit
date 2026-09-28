import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.js";

const INITIAL_PASSWORD = "Lab3-ChangeMe-2026";
const MAX_BACKFILL_TICKET_ID = 999_999_999_999;

type LegacyRequester = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function tableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS "exists"`,
    tableName,
  );
  return Boolean(rows[0]?.exists);
}

async function columnExists(prisma: PrismaClient, tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS "exists"`,
    tableName,
    columnName,
  );
  return Boolean(rows[0]?.exists);
}

async function validateAlreadyMigratedState(prisma: PrismaClient): Promise<void> {
  const issues = await prisma.$queryRawUnsafe<Array<{
    nullClientRequestIds: bigint;
    duplicateClientRequestIds: bigint;
    nullItPriority: bigint;
  }>>(`
    SELECT
      (SELECT COUNT(*) FROM "Ticket" WHERE "clientRequestId" IS NULL) AS "nullClientRequestIds",
      (SELECT COUNT(*) FROM (SELECT "clientRequestId" FROM "Ticket" GROUP BY "clientRequestId" HAVING COUNT(*) > 1) d) AS "duplicateClientRequestIds",
      (SELECT COUNT(*) FROM "Ticket" WHERE "itPriority" IS NULL) AS "nullItPriority"
  `);
  const state = issues[0];
  if (!state || state.nullClientRequestIds > 0n || state.duplicateClientRequestIds > 0n || state.nullItPriority > 0n) {
    throw new Error("Existing Lab 3 schema failed migration rerun-safety validation.");
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function legacyClientRequestId(ticketId: number): string {
  if (!Number.isSafeInteger(ticketId) || ticketId <= 0 || ticketId > MAX_BACKFILL_TICKET_ID) {
    throw new Error("Legacy Ticket id is outside the supported deterministic clientRequestId range.");
  }
  return `00000000-0000-5000-8000-${String(ticketId).padStart(12, "0")}`;
}

export async function migrateLab3Database(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const userExists = await tableExists(prisma, "User");
    const requesterUserExists = await tableExists(prisma, "RequesterUser");
    const existingClientRequestId = await columnExists(prisma, "Ticket", "clientRequestId");

    if (userExists && !requesterUserExists && existingClientRequestId) {
      await validateAlreadyMigratedState(prisma);
      return;
    }
    if (userExists || !requesterUserExists || existingClientRequestId) {
      throw new Error("Database is neither the verified Lab 2 baseline nor a complete Lab 3 migrated state.");
    }

    const legacyRequesters = await prisma.$queryRawUnsafe<LegacyRequester[]>(
      `SELECT "id", "name", "email", "isActive", "createdAt", "updatedAt"
       FROM "RequesterUser"
       ORDER BY "id" ASC`,
    );

    const normalizedEmails = new Set<string>();
    for (const requester of legacyRequesters) {
      const normalized = requester.email.trim().toLowerCase();
      if (normalizedEmails.has(normalized)) {
        throw new Error(`Legacy Requester email normalization collision: ${normalized}`);
      }
      normalizedEmails.add(normalized);
    }

    const maxTicketRows = await prisma.$queryRawUnsafe<Array<{ maxId: number | null }>>(
      `SELECT MAX("id")::int AS "maxId" FROM "Ticket"`,
    );
    const maxTicketId = maxTicketRows[0]?.maxId ?? 0;
    if (maxTicketId > MAX_BACKFILL_TICKET_ID) {
      throw new Error("Legacy Ticket id exceeds deterministic clientRequestId range.");
    }

    const requesterHashes = new Map<number, string>();
    for (const requester of legacyRequesters) {
      requesterHashes.set(requester.id, await hashPassword(INITIAL_PASSWORD));
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR')`);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "User" (
          "id" SERIAL NOT NULL,
          "name" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "role" "UserRole" NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "passwordHash" TEXT NOT NULL,
          "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "User_pkey" PRIMARY KEY ("id")
        )
      `);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive")`);

      for (const requester of legacyRequesters) {
        const normalizedEmail = requester.email.trim().toLowerCase();
        const passwordHash = requesterHashes.get(requester.id);
        if (!passwordHash) throw new Error(`Missing password hash for legacy Requester ${requester.id}.`);

        await tx.$executeRaw`
          INSERT INTO "User" (
            "id", "name", "email", "role", "isActive", "passwordHash", "mustChangePassword", "createdAt", "updatedAt"
          ) VALUES (
            ${requester.id}, ${requester.name.trim()}, ${normalizedEmail}, 'REQUESTER'::"UserRole",
            ${requester.isActive}, ${passwordHash}, true, ${requester.createdAt}, ${requester.updatedAt}
          )
        `;
      }

      await tx.$executeRawUnsafe(`
        SELECT setval(
          pg_get_serial_sequence('"User"', 'id'),
          GREATEST(COALESCE((SELECT MAX("id") FROM "User"), 0), 1),
          COALESCE((SELECT MAX("id") FROM "User"), 0) > 0
        )
      `);

      for (const value of ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]) {
        await tx.$executeRawUnsafe(`ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS ${quoteIdentifier(value).replace(/^"|"$/g, "'")}`);
      }

      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD COLUMN "clientRequestId" TEXT`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD COLUMN "ownerId" INTEGER`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD COLUMN "itPriority" "RequestedPriority"`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD COLUMN "problemAppearsResolvedAt" TIMESTAMP(3)`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD COLUMN "problemAppearsResolvedById" INTEGER`);

      await tx.$executeRawUnsafe(`
        UPDATE "Ticket"
        SET "clientRequestId" = '00000000-0000-5000-8000-' || LPAD("id"::text, 12, '0'),
            "itPriority" = "requestedPriority"
      `);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ALTER COLUMN "clientRequestId" SET NOT NULL`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "Ticket_clientRequestId_key" ON "Ticket"("clientRequestId")`);

      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey"`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_removedByRequesterId_fkey"`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Attachment" RENAME COLUMN "removedByRequesterId" TO "removedByUserId"`);

      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_problemAppearsResolvedById_fkey" FOREIGN KEY ("problemAppearsResolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
      await tx.$executeRawUnsafe(`ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_removedByUserId_fkey" FOREIGN KEY ("removedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "AuthSession" (
          "id" TEXT NOT NULL,
          "userId" INTEGER NOT NULL,
          "tokenHash" TEXT NOT NULL,
          "csrfTokenHash" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "revokedAt" TIMESTAMP(3),
          CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt")`);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "PublicComment" (
          "id" SERIAL NOT NULL,
          "ticketId" INTEGER NOT NULL,
          "authorId" INTEGER NOT NULL,
          "content" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);
      await tx.$executeRawUnsafe(`CREATE INDEX "PublicComment_ticketId_createdAt_idx" ON "PublicComment"("ticketId", "createdAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "PublicComment_authorId_idx" ON "PublicComment"("authorId")`);

      await tx.$executeRawUnsafe(`
        CREATE TABLE "InternalNote" (
          "id" SERIAL NOT NULL,
          "ticketId" INTEGER NOT NULL,
          "authorId" INTEGER NOT NULL,
          "content" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);
      await tx.$executeRawUnsafe(`CREATE INDEX "InternalNote_ticketId_createdAt_idx" ON "InternalNote"("ticketId", "createdAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "InternalNote_authorId_idx" ON "InternalNote"("authorId")`);

      await tx.$executeRawUnsafe(`CREATE INDEX "Ticket_ownerId_updatedAt_idx" ON "Ticket"("ownerId", "updatedAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "Ticket_requestedPriority_updatedAt_idx" ON "Ticket"("requestedPriority", "updatedAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "Ticket_itPriority_updatedAt_idx" ON "Ticket"("itPriority", "updatedAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "Ticket_currentStatus_updatedAt_idx" ON "Ticket"("currentStatus", "updatedAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "Ticket_categoryId_updatedAt_idx" ON "Ticket"("categoryId", "updatedAt")`);
      await tx.$executeRawUnsafe(`CREATE INDEX "Ticket_relatedSystemId_updatedAt_idx" ON "Ticket"("relatedSystemId", "updatedAt")`);

      await tx.$executeRawUnsafe(`DROP TABLE "RequesterUser"`);
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  await migrateLab3Database(databaseUrl);
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
