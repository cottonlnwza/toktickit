import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

async function getReferenceData() {
  const prisma = getPrisma();
  const requester = await prisma.requesterUser.findFirstOrThrow({ where: { isActive: true } });
  const category = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  return { category, relatedSystem, requester };
}

async function cleanupTickets(ticketNumbers: string[]) {
  const knownTicketNumbers = ticketNumbers.filter((ticketNumber): ticketNumber is string => Boolean(ticketNumber));
  if (knownTicketNumbers.length === 0) return;

  const prisma = getPrisma();
  await prisma.attachment.deleteMany({ where: { ticket: { ticketNumber: { in: knownTicketNumbers } } } });
  await prisma.ticket.deleteMany({ where: { ticketNumber: { in: knownTicketNumbers } } });
}

describe("Lab 2 Create Ticket API", () => {
  const createdTicketNumbers: string[] = [];

  afterEach(async () => {
    await cleanupTickets(createdTicketNumbers);
    createdTicketNumbers.length = 0;
  });

  it("returns active Related Systems with a safe shape", async () => {
    const res = await request(app).get("/api/related-systems");

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(6);
    expect(res.body[0]).toEqual({
      id: expect.any(Number),
      name: expect.any(String),
    });
    expect(res.body[0]).not.toHaveProperty("createdAt");
    expect(res.body[0]).not.toHaveProperty("updatedAt");
  });

  it("creates a valid requester-owned Ticket with backend-generated values", async () => {
    const { category, relatedSystem, requester } = await getReferenceData();

    const res = await request(app)
      .post("/api/tickets")
      .send({
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "  Laptop battery drains quickly  ",
        description: "  The battery drops during one class session.  ",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketNumber: expect.stringMatching(/^TTK-\d{8}-\d{4}$/),
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Laptop battery drains quickly",
      description: "The battery drops during one class session.",
      requestedPriority: "MEDIUM",
      currentStatus: "NEW",
      currentStatusLabel: "New",
    });
    createdTicketNumbers.push(res.body.ticketNumber);

    const ticket = await getPrisma().ticket.findUniqueOrThrow({
      where: { ticketNumber: res.body.ticketNumber },
    });
    expect(ticket.requesterId).toBe(requester.id);
  });

  it("rejects invalid create input without saving a Ticket", async () => {
    const before = await getPrisma().ticket.count();

    const res = await request(app).post("/api/tickets").send({
      requesterId: 0,
      categoryId: null,
      relatedSystemId: null,
      summary: "",
      description: " ",
      requestedPriority: "CRITICAL",
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Ticket validation failed.",
      fields: expect.arrayContaining([
        { field: "requesterId", message: "Requester is required." },
        { field: "categoryId", message: "Category is required." },
        { field: "relatedSystemId", message: "Related System is required." },
        { field: "summary", message: "Summary is required." },
        { field: "description", message: "Description is required." },
        { field: "requestedPriority", message: "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT." },
      ]),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SQL|stack|DATABASE_URL|\/Users|Prisma/i);
    await expect(getPrisma().ticket.count()).resolves.toBe(before);
  });

  it("uploads a valid create-time attachment to an existing Ticket", async () => {
    const { category, relatedSystem, requester } = await getReferenceData();
    const ticketRes = await request(app).post("/api/tickets").send({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Attachment ticket",
      description: "Ticket for attachment upload.",
      requestedPriority: "LOW",
    });
    if (ticketRes.body.ticketNumber) createdTicketNumbers.push(ticketRes.body.ticketNumber);

    const res = await request(app)
      .post(`/api/tickets/${ticketRes.body.id}/attachments`)
      .field("requesterId", String(requester.id))
      .attach("file", Buffer.from("fake pdf content"), {
        filename: "evidence.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      ticketId: ticketRes.body.id,
      originalFilename: "evidence.pdf",
      mimeType: "application/pdf",
      sizeBytes: expect.any(Number),
      removedAt: null,
    });

    const attachment = await getPrisma().attachment.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(attachment.ticketId).toBe(ticketRes.body.id);
  });

  it("rejects invalid create-time attachments without creating an active Attachment", async () => {
    const { category, relatedSystem, requester } = await getReferenceData();
    const ticketRes = await request(app).post("/api/tickets").send({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Invalid attachment ticket",
      description: "Ticket for invalid attachment upload.",
      requestedPriority: "HIGH",
    });
    if (ticketRes.body.ticketNumber) createdTicketNumbers.push(ticketRes.body.ticketNumber);

    const before = await getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } });
    const res = await request(app)
      .post(`/api/tickets/${ticketRes.body.id}/attachments`)
      .field("requesterId", String(requester.id))
      .attach("file", Buffer.from("bad"), {
        filename: "malware.exe",
        contentType: "application/octet-stream",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed." });
    await expect(
      getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } }),
    ).resolves.toBe(before);
  });
});
