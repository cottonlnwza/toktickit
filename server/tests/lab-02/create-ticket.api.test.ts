import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { access, unlink } from "fs/promises";
import { randomUUID } from "node:crypto";
import path from "path";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { getPrisma } from "../../src/prisma.js";

const FRONTEND_ORIGIN = "http://localhost:5173";
const AUTH_EMAIL = "lab2.create-ticket-auth@example.test";
const AUTH_PASSWORD = "Lab3-Create-Ticket-Auth-2026";

async function getReferenceData() {
  const prisma = getPrisma();
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: AUTH_EMAIL } });
  const category = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  return { category, relatedSystem, requester };
}

async function cleanupTickets(ticketNumbers: string[]) {
  const knownTicketNumbers = ticketNumbers.filter((ticketNumber): ticketNumber is string => Boolean(ticketNumber));
  if (knownTicketNumbers.length === 0) return;

  const prisma = getPrisma();
  const attachments = await prisma.attachment.findMany({
    where: { ticket: { ticketNumber: { in: knownTicketNumbers } } },
    select: { storagePath: true },
  });
  await prisma.attachment.deleteMany({ where: { ticket: { ticketNumber: { in: knownTicketNumbers } } } });
  await prisma.ticket.deleteMany({ where: { ticketNumber: { in: knownTicketNumbers } } });
  await Promise.all(attachments.map((attachment) => unlink(attachment.storagePath).catch(() => undefined)));
}

describe("Lab 2 Create Ticket API", () => {
  const createdTicketNumbers: string[] = [];
  let agent: ReturnType<typeof request.agent>;
  let csrfToken = "";

  beforeEach(async () => {
    const prisma = getPrisma();
    const authUser = await prisma.user.upsert({
      where: { email: AUTH_EMAIL },
      update: {
        name: "Lab 2 Create Ticket Auth",
        role: "REQUESTER",
        isActive: true,
        passwordHash: await hashPassword(AUTH_PASSWORD),
        mustChangePassword: false,
      },
      create: {
        name: "Lab 2 Create Ticket Auth",
        email: AUTH_EMAIL,
        role: "REQUESTER",
        isActive: true,
        passwordHash: await hashPassword(AUTH_PASSWORD),
        mustChangePassword: false,
      },
    });
    await prisma.authSession.deleteMany({ where: { userId: authUser.id } });
    agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
    expect(login.status).toBe(200);
    csrfToken = login.body.csrfToken;
  });

  afterEach(async () => {
    await cleanupTickets(createdTicketNumbers);
    createdTicketNumbers.length = 0;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const authUser = await prisma.user.findUnique({ where: { email: AUTH_EMAIL }, select: { id: true } });
    if (authUser) {
      await prisma.authSession.deleteMany({ where: { userId: authUser.id } });
      await prisma.user.delete({ where: { id: authUser.id } });
    }
  });

  it("returns active Related Systems with a safe shape", async () => {
    const res = await agent.get("/api/related-systems").set("Origin", FRONTEND_ORIGIN);

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

    const res = await agent
      .post("/api/tickets")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .send({
        clientRequestId: randomUUID(),
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

    const res = await agent.post("/api/tickets").set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: "not-a-uuid",
      categoryId: null,
      relatedSystemId: null,
      summary: "",
      description: " ",
      requestedPriority: "CRITICAL",
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted fields.",
        fields: expect.objectContaining({
          clientRequestId: "clientRequestId must be a valid UUID.",
          categoryId: "Category is required.",
          relatedSystemId: "Related System is required.",
          summary: "Summary is required.",
          description: "Description is required.",
          requestedPriority: "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.",
        }),
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SQL|stack|DATABASE_URL|\/Users|Prisma/i);
    await expect(getPrisma().ticket.count()).resolves.toBe(before);
  });

  it("uploads a valid create-time attachment to an existing Ticket", async () => {
    const { category, relatedSystem, requester } = await getReferenceData();
    const ticketRes = await agent.post("/api/tickets").set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: randomUUID(),
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Attachment ticket",
      description: "Ticket for attachment upload.",
      requestedPriority: "LOW",
    });
    if (ticketRes.body.ticketNumber) createdTicketNumbers.push(ticketRes.body.ticketNumber);

    const res = await agent
      .post(`/api/tickets/${ticketRes.body.id}/attachments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .attach("file", Buffer.from("fake pdf content"), {
        filename: "evidence.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      ticketId: ticketRes.body.id,
      originalFilename: "evidence.pdf",
      storedFilename: expect.stringMatching(/^[0-9a-f-]{36}\.pdf$/),
      mimeType: "application/pdf",
      sizeBytes: expect.any(Number),
      removedAt: null,
    });

    const attachment = await getPrisma().attachment.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(attachment.ticketId).toBe(ticketRes.body.id);
    expect(attachment.storagePath).toContain(`${path.sep}server${path.sep}uploads${path.sep}lab-02${path.sep}`);
    await expect(access(attachment.storagePath)).resolves.toBeUndefined();
  });

  it("rejects an attachment larger than 5 MB with a safe documented response", async () => {
    const { category, relatedSystem, requester } = await getReferenceData();
    const ticketRes = await agent.post("/api/tickets").set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: randomUUID(),
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Oversized attachment ticket",
      description: "Ticket for oversized attachment upload.",
      requestedPriority: "MEDIUM",
    });
    if (ticketRes.body.ticketNumber) createdTicketNumbers.push(ticketRes.body.ticketNumber);

    const before = await getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } });
    const res = await agent
      .post(`/api/tickets/${ticketRes.body.id}/attachments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "large-evidence.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: {
        code: "FILE_TOO_LARGE",
        message: "Attachment must be 5 MB or smaller.",
      },
    });
    await expect(
      getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } }),
    ).resolves.toBe(before);
  });

  it("rejects a sixth active attachment with the documented attachment-limit response", async () => {
    const { category, relatedSystem, requester } = await getReferenceData();
    const ticketRes = await agent.post("/api/tickets").set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: randomUUID(),
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Attachment limit ticket",
      description: "Ticket for attachment limit enforcement.",
      requestedPriority: "LOW",
    });
    if (ticketRes.body.ticketNumber) createdTicketNumbers.push(ticketRes.body.ticketNumber);

    await getPrisma().attachment.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        ticketId: ticketRes.body.id,
        originalFilename: `existing-${index + 1}.pdf`,
        storedFilename: `existing-${Date.now()}-${index + 1}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 10,
        storagePath: path.join("server", "uploads", "lab-02", `existing-${index + 1}.pdf`),
      })),
    });
    const before = await getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } });

    const res = await agent
      .post(`/api/tickets/${ticketRes.body.id}/attachments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .attach("file", Buffer.from("sixth"), {
        filename: "sixth.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "A Ticket may have at most five active attachments.",
      },
    });
    await expect(
      getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } }),
    ).resolves.toBe(before);
  });

  it("rejects invalid create-time attachments without creating an active Attachment", async () => {
    const { category, relatedSystem, requester } = await getReferenceData();
    const ticketRes = await agent.post("/api/tickets").set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", csrfToken).send({
      clientRequestId: randomUUID(),
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Invalid attachment ticket",
      description: "Ticket for invalid attachment upload.",
      requestedPriority: "HIGH",
    });
    if (ticketRes.body.ticketNumber) createdTicketNumbers.push(ticketRes.body.ticketNumber);

    const before = await getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } });
    const res = await agent
      .post(`/api/tickets/${ticketRes.body.id}/attachments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .attach("file", Buffer.from("bad"), {
        filename: "malware.exe",
        contentType: "application/octet-stream",
      });

    expect(res.status).toBe(415);
    expect(res.body).toEqual({
      error: {
        code: "UNSUPPORTED_FILE_TYPE",
        message: "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.",
      },
    });
    await expect(
      getPrisma().attachment.count({ where: { ticketId: ticketRes.body.id, removedAt: null } }),
    ).resolves.toBe(before);
  });
});
