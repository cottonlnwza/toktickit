import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import request from "supertest";
import { UserRole, type TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { getPrisma } from "../../src/prisma.js";

export const FRONTEND_ORIGIN = "http://localhost:5173";
export const TEST_PASSWORD = "Lab3-Requester-Test-2026";

export const fixtureUsers = {
  requesterA: { email: "issue36.requester.a@example.test", name: "Issue 36 Requester A", role: UserRole.REQUESTER },
  requesterB: { email: "issue36.requester.b@example.test", name: "Issue 36 Requester B", role: UserRole.REQUESTER },
  staff: { email: "issue36.staff@example.test", name: "Issue 36 IT Staff", role: UserRole.IT_STAFF },
  staffB: { email: "issue38.staff.b@example.test", name: "Issue 38 IT Staff B", role: UserRole.IT_STAFF },
  inactiveStaff: { email: "issue37.inactive.staff@example.test", name: "Issue 37 Inactive Staff", role: UserRole.IT_STAFF },
  admin: { email: "issue36.admin@example.test", name: "Issue 36 Administrator", role: UserRole.ADMINISTRATOR },
} as const;

export async function provisionIssue36User(fixture: (typeof fixtureUsers)[keyof typeof fixtureUsers]) {
  const prisma = getPrisma();
  const user = await prisma.user.upsert({
    where: { email: fixture.email },
    update: {
      name: fixture.name,
      role: fixture.role,
      isActive: true,
      passwordHash: await hashPassword(TEST_PASSWORD),
      mustChangePassword: false,
    },
    create: {
      name: fixture.name,
      email: fixture.email,
      role: fixture.role,
      isActive: true,
      passwordHash: await hashPassword(TEST_PASSWORD),
      mustChangePassword: false,
    },
  });
  await prisma.authSession.deleteMany({ where: { userId: user.id } });
  return user;
}

export async function loginIssue36(fixture: (typeof fixtureUsers)[keyof typeof fixtureUsers]) {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/login")
    .set("Origin", FRONTEND_ORIGIN)
    .send({ email: fixture.email, password: TEST_PASSWORD });
  return { agent, response };
}

export async function issue36ReferenceData() {
  const prisma = getPrisma();
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  return { category, relatedSystem };
}

export async function createIssue36Ticket(
  requesterId: number,
  input: { summary?: string; status?: TicketStatus; clientRequestId?: string } = {},
) {
  const prisma = getPrisma();
  const { category, relatedSystem } = await issue36ReferenceData();
  const token = randomUUID();
  return prisma.ticket.create({
    data: {
      ticketNumber: `I36-${token}`,
      clientRequestId: input.clientRequestId ?? randomUUID(),
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: input.summary ?? `Issue 36 fixture ${token.slice(0, 8)}`,
      description: "Issue 36 Requester authorization and regression fixture description.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: input.status ?? "NEW",
    },
  });
}

export async function cleanupIssue36Fixtures() {
  const prisma = getPrisma();
  const emails = Object.values(fixtureUsers).map((user) => user.email);
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((user) => user.id);

  if (ids.length > 0) {
    const ticketIds = (await prisma.ticket.findMany({ where: { requesterId: { in: ids } }, select: { id: true } })).map((ticket) => ticket.id);
    if (ticketIds.length > 0) {
      const attachmentFiles = await prisma.attachment.findMany({ where: { ticketId: { in: ticketIds } }, select: { storagePath: true } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      await Promise.all(attachmentFiles.map((attachment) => unlink(attachment.storagePath).catch(() => undefined)));
    }
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}
