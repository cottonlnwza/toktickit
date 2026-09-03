import { describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed.js";
import { getPrisma } from "../../src/prisma.js";

function expectPrismaCode(error: unknown, code: string) {
  expect(error).toMatchObject({ code });
}

describe("Lab 2 seed data", () => {
  it("is repeatable and creates the required reference data without duplicates", async () => {
    const prisma = getPrisma();

    await seedDatabase();
    await seedDatabase();

    const requiredCategoryNames = ["Account and Access", "Hardware", "Software", "Network"];
    for (const name of requiredCategoryNames) {
      const matches = await prisma.category.findMany({ where: { name } });
      expect(matches).toHaveLength(1);
    }

    const relatedSystemCount = await prisma.relatedSystem.count();
    expect(relatedSystemCount).toBeGreaterThanOrEqual(6);

    const activeRequesterCount = await prisma.requesterUser.count({
      where: { isActive: true },
    });
    expect(activeRequesterCount).toBeGreaterThanOrEqual(4);

    const inactiveRequesterCount = await prisma.requesterUser.count({
      where: { isActive: false },
    });
    expect(inactiveRequesterCount).toBeGreaterThanOrEqual(1);

    const selectorRequesters = await prisma.requesterUser.findMany({
      where: { isActive: true },
    });
    expect(selectorRequesters.every((requester) => requester.isActive)).toBe(true);
  });

  it("preserves existing extra categories when the seed runs repeatedly", async () => {
    const prisma = getPrisma();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const extraCategoryName = `Temporary Category ${unique}`;

    await prisma.category.create({ data: { name: extraCategoryName } });

    try {
      await seedDatabase();
      await seedDatabase();

      const extraCategory = await prisma.category.findUnique({
        where: { name: extraCategoryName },
      });
      expect(extraCategory).toMatchObject({ name: extraCategoryName });
    } finally {
      await prisma.category.deleteMany({ where: { name: extraCategoryName } });
    }
  });

  it("supports required relationships and attachment soft-removal fields", async () => {
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

    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Hardware" },
    });

    try {
      const requester = await prisma.requesterUser.create({
        data: {
          name: `Temporary Requester ${unique}`,
          email: requesterEmail,
        },
      });
      requesterId = requester.id;

      const relatedSystem = await prisma.relatedSystem.create({
        data: { name: relatedSystemName },
      });
      relatedSystemId = relatedSystem.id;

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          requesterId,
          categoryId: category.id,
          relatedSystemId,
          summary: "Temporary hardware issue",
          description: "Temporary description for relationship verification.",
          requestedPriority: "MEDIUM",
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
        include: {
          requester: true,
          category: true,
          relatedSystem: true,
          attachments: true,
        },
      });
      expect(ticketWithRelations.requester.id).toBe(requesterId);
      expect(ticketWithRelations.category.id).toBe(category.id);
      expect(ticketWithRelations.relatedSystem.id).toBe(relatedSystemId);
      expect(ticketWithRelations.attachments).toHaveLength(1);
      expect(ticketWithRelations.attachments[0]).toMatchObject({
        id: attachmentId,
        removedAt: null,
        removedByRequesterId: null,
        removalReason: null,
      });

      const removedAt = new Date();
      const removedAttachment = await prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          removedAt,
          removedByRequesterId: requesterId,
          removalReason: "Temporary removal verification",
        },
      });
      expect(removedAttachment).toMatchObject({
        removedByRequesterId: requesterId,
        removalReason: "Temporary removal verification",
      });
      expect(removedAttachment.removedAt).toEqual(removedAt);
    } finally {
      if (attachmentId) await prisma.attachment.deleteMany({ where: { id: attachmentId } });
      if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId } });
      if (relatedSystemId) await prisma.relatedSystem.deleteMany({ where: { id: relatedSystemId } });
      if (requesterId) await prisma.requesterUser.deleteMany({ where: { id: requesterId } });
    }
  });

  it("rejects duplicate unique values", async () => {
    const prisma = getPrisma();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const requesterEmail = `unique-${unique}@example.test`;
    const relatedSystemName = `Unique Related System ${unique}`;
    const ticketNumber = `UNIQUE-${unique}`;

    let requesterId: number | undefined;
    let relatedSystemId: number | undefined;
    let ticketId: number | undefined;

    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Hardware" },
    });

    try {
      const requester = await prisma.requesterUser.create({
        data: { name: `Unique Requester ${unique}`, email: requesterEmail },
      });
      requesterId = requester.id;

      const relatedSystem = await prisma.relatedSystem.create({
        data: { name: relatedSystemName },
      });
      relatedSystemId = relatedSystem.id;

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          requesterId,
          categoryId: category.id,
          relatedSystemId,
          summary: "Unique ticket summary",
          description: "Unique ticket description for duplicate verification.",
          requestedPriority: "LOW",
        },
      });
      ticketId = ticket.id;

      await expect(
        prisma.requesterUser.create({
          data: { name: "Duplicate Requester", email: requesterEmail },
        }),
      ).rejects.toSatisfy((error) => {
        expectPrismaCode(error, "P2002");
        return true;
      });

      await expect(
        prisma.relatedSystem.create({ data: { name: relatedSystemName } }),
      ).rejects.toSatisfy((error) => {
        expectPrismaCode(error, "P2002");
        return true;
      });

      await expect(
        prisma.ticket.create({
          data: {
            ticketNumber,
            requesterId,
            categoryId: category.id,
            relatedSystemId,
            summary: "Duplicate ticket summary",
            description: "Duplicate ticket description for duplicate verification.",
            requestedPriority: "HIGH",
          },
        }),
      ).rejects.toSatisfy((error) => {
        expectPrismaCode(error, "P2002");
        return true;
      });
    } finally {
      if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId } });
      if (relatedSystemId) await prisma.relatedSystem.deleteMany({ where: { id: relatedSystemId } });
      if (requesterId) await prisma.requesterUser.deleteMany({ where: { id: requesterId } });
    }
  });

  it("rejects tickets with invalid required foreign keys", async () => {
    const prisma = getPrisma();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const missingId = 2_147_483_647;

    await expect(
      prisma.ticket.create({
        data: {
          ticketNumber: `FK-${unique}`,
          requesterId: missingId,
          categoryId: missingId,
          relatedSystemId: missingId,
          summary: "Invalid foreign keys",
          description: "Invalid foreign key relationship verification.",
          requestedPriority: "URGENT",
        },
      }),
    ).rejects.toSatisfy((error) => {
      expectPrismaCode(error, "P2003");
      return true;
    });
  });
});
