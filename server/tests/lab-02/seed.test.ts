import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth/password.js";

function expectPrismaCode(error: unknown, code: string) {
  expect(error).toMatchObject({ code });
}

async function createTemporaryRequester(email: string, name: string) {
  return getPrisma().user.create({
    data: {
      name,
      email,
      role: "REQUESTER",
      isActive: true,
      passwordHash: await hashPassword("Lab3-ChangeMe-2026"),
      mustChangePassword: true,
    },
  });
}

describe("Lab 2 seed data under Lab 3 schema", () => {
  it("is repeatable and keeps required reference/requester data without duplicates", async () => {
    const prisma = getPrisma();

    await seedDatabase();
    await seedDatabase();

    const requiredCategoryNames = ["Account and Access", "Hardware", "Software", "Network"];
    const expectedRelatedSystemNames = [
      "Email",
      "Campus Wi-Fi",
      "VPN",
      "LEB2 App",
      "Grade Submission App",
      "Printer",
      "Corporate Laptop",
    ];
    const expectedRequesterEmails = [
      "anong.student@example.test",
      "burin.lecturer@example.test",
      "chalida.staff@example.test",
      "darin.researcher@example.test",
      "inactive.requester@example.test",
    ];

    for (const name of requiredCategoryNames) {
      await expect(prisma.category.count({ where: { name } })).resolves.toBe(1);
    }
    for (const name of expectedRelatedSystemNames) {
      await expect(prisma.relatedSystem.count({ where: { name } })).resolves.toBe(1);
    }
    for (const email of expectedRequesterEmails) {
      await expect(prisma.user.count({ where: { email, role: "REQUESTER" } })).resolves.toBe(1);
    }

    await expect(prisma.relatedSystem.count()).resolves.toBeGreaterThanOrEqual(6);
    await expect(prisma.user.count({ where: { role: "REQUESTER", isActive: true } })).resolves.toBeGreaterThanOrEqual(4);
    await expect(prisma.user.count({ where: { role: "REQUESTER", isActive: false } })).resolves.toBeGreaterThanOrEqual(1);

    const selectorRequesters = await prisma.user.findMany({ where: { role: "REQUESTER", isActive: true } });
    expect(selectorRequesters.every((requester) => requester.role === "REQUESTER" && requester.isActive)).toBe(true);
  });

  it("preserves existing extra categories when the seed runs repeatedly", async () => {
    const prisma = getPrisma();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const extraCategoryName = `Temporary Category ${unique}`;

    await prisma.category.create({ data: { name: extraCategoryName } });
    try {
      await seedDatabase();
      await seedDatabase();
      await expect(prisma.category.findUnique({ where: { name: extraCategoryName } })).resolves.toMatchObject({ name: extraCategoryName });
    } finally {
      await prisma.category.deleteMany({ where: { name: extraCategoryName } });
    }
  });

  it("supports requester relationships and attachment soft-removal fields after the identity migration", async () => {
    const prisma = getPrisma();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const requesterEmail = `temporary-${unique}@example.test`;
    const relatedSystemName = `Temporary Related System ${unique}`;
    const ticketNumber = `TEMP-${unique}`;
    const storedFilename = `temporary-${unique}.pdf`;

    let attachmentId: number | undefined;
    let ticketId: number | undefined;
    let requesterId: number | undefined;
    let relatedSystemId: number | undefined;
    const category = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });

    try {
      const requester = await createTemporaryRequester(requesterEmail, `Temporary Requester ${unique}`);
      requesterId = requester.id;
      const relatedSystem = await prisma.relatedSystem.create({ data: { name: relatedSystemName } });
      relatedSystemId = relatedSystem.id;

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          clientRequestId: randomUUID(),
          requesterId,
          categoryId: category.id,
          relatedSystemId,
          summary: "Temporary hardware issue",
          description: "Temporary description for relationship verification.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
        },
      });
      ticketId = ticket.id;

      const attachment = await prisma.attachment.create({
        data: {
          ticketId,
          originalFilename: "temporary.pdf",
          storedFilename,
          mimeType: "application/pdf",
          sizeBytes: 1024,
          storagePath: `server/uploads/lab-02/${storedFilename}`,
        },
      });
      attachmentId = attachment.id;

      const ticketWithRelations = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: { requester: true, category: true, relatedSystem: true, attachments: true },
      });
      expect(ticketWithRelations.requester.id).toBe(requesterId);
      expect(ticketWithRelations.category.id).toBe(category.id);
      expect(ticketWithRelations.relatedSystem.id).toBe(relatedSystemId);
      expect(ticketWithRelations.attachments[0]).toMatchObject({
        id: attachmentId,
        removedAt: null,
        removedByUserId: null,
        removalReason: null,
      });

      const removedAt = new Date();
      const removedAttachment = await prisma.attachment.update({
        where: { id: attachmentId },
        data: { removedAt, removedByUserId: requesterId, removalReason: "Temporary removal verification" },
      });
      expect(removedAttachment).toMatchObject({
        removedByUserId: requesterId,
        removalReason: "Temporary removal verification",
      });
      expect(removedAttachment.removedAt).toEqual(removedAt);
    } finally {
      if (attachmentId) await prisma.attachment.deleteMany({ where: { id: attachmentId } });
      if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId } });
      if (relatedSystemId) await prisma.relatedSystem.deleteMany({ where: { id: relatedSystemId } });
      if (requesterId) await prisma.user.deleteMany({ where: { id: requesterId } });
    }
  });

  it("rejects duplicate unique values", async () => {
    const prisma = getPrisma();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const requesterEmail = `unique-${unique}@example.test`;
    const relatedSystemName = `Unique Related System ${unique}`;
    const ticketNumber = `UNIQUE-${unique}`;
    const clientRequestId = randomUUID();
    let requesterId: number | undefined;
    let relatedSystemId: number | undefined;
    let ticketId: number | undefined;
    const category = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });

    try {
      const requester = await createTemporaryRequester(requesterEmail, `Unique Requester ${unique}`);
      requesterId = requester.id;
      const relatedSystem = await prisma.relatedSystem.create({ data: { name: relatedSystemName } });
      relatedSystemId = relatedSystem.id;
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          clientRequestId,
          requesterId,
          categoryId: category.id,
          relatedSystemId,
          summary: "Unique ticket summary",
          description: "Unique ticket description for duplicate verification.",
          requestedPriority: "LOW",
          itPriority: "LOW",
        },
      });
      ticketId = ticket.id;

      await expect(createTemporaryRequester(requesterEmail, "Duplicate Requester")).rejects.toSatisfy((error) => {
        expectPrismaCode(error, "P2002");
        return true;
      });
      await expect(prisma.relatedSystem.create({ data: { name: relatedSystemName } })).rejects.toSatisfy((error) => {
        expectPrismaCode(error, "P2002");
        return true;
      });
      await expect(prisma.ticket.create({
        data: {
          ticketNumber: `OTHER-${unique}`,
          clientRequestId,
          requesterId,
          categoryId: category.id,
          relatedSystemId,
          summary: "Duplicate replay key",
          description: "Duplicate client request identifier should be rejected.",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
        },
      })).rejects.toSatisfy((error) => {
        expectPrismaCode(error, "P2002");
        return true;
      });
    } finally {
      if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId } });
      if (relatedSystemId) await prisma.relatedSystem.deleteMany({ where: { id: relatedSystemId } });
      if (requesterId) await prisma.user.deleteMany({ where: { id: requesterId } });
    }
  });

  it("rejects tickets with invalid required foreign keys", async () => {
    const prisma = getPrisma();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const missingId = 2_147_483_647;

    await expect(prisma.ticket.create({
      data: {
        ticketNumber: `FK-${unique}`,
        clientRequestId: randomUUID(),
        requesterId: missingId,
        categoryId: missingId,
        relatedSystemId: missingId,
        summary: "Invalid foreign keys",
        description: "Invalid foreign key relationship verification.",
        requestedPriority: "URGENT",
        itPriority: "URGENT",
      },
    })).rejects.toSatisfy((error) => {
      expectPrismaCode(error, "P2003");
      return true;
    });
  });
});
