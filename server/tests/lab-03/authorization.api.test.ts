import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  FRONTEND_ORIGIN,
  cleanupIssue36Fixtures,
  createIssue36Ticket,
  fixtureUsers,
  issue36ReferenceData,
  loginIssue36,
  provisionIssue36User,
} from "./requester-test-helpers.js";

describe("Lab 3 Issue 4 authorization", () => {
  beforeEach(async () => {
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
    await provisionIssue36User(fixtureUsers.requesterB);
    await provisionIssue36User(fixtureUsers.staff);
    await provisionIssue36User(fixtureUsers.admin);
  });

  afterAll(async () => {
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("API-09 rejects a client-supplied requesterId and never lets it override authenticated Requester identity", async () => {
    const prisma = getPrisma();
    const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const { category, relatedSystem } = await issue36ReferenceData();
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);
    expect(login.status).toBe(200);
    const clientRequestId = randomUUID();

    const response = await agent
      .post("/api/tickets")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({
        clientRequestId,
        requesterId: requesterB.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Authenticated identity must win",
        description: "The backend must never trust a client-supplied Requester identity field.",
        requestedPriority: "MEDIUM",
      });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    expect(response.body.error?.fields?.requesterId).toEqual(expect.any(String));
    expect(await prisma.ticket.count({ where: { clientRequestId } })).toBe(0);
    expect(requesterA.id).not.toBe(requesterB.id);
  });

  it("API-10 returns the same safe not-found style response for another Requester's Ticket and a missing Ticket", async () => {
    const prisma = getPrisma();
    const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const ownedByB = await createIssue36Ticket(requesterB.id, { summary: "Requester B private Ticket" });
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);
    expect(login.status).toBe(200);

    const crossOwner = await agent.get(`/api/tickets/${ownedByB.id}`).set("Origin", FRONTEND_ORIGIN);
    const missing = await agent.get("/api/tickets/2147483000").set("Origin", FRONTEND_ORIGIN);

    expect(crossOwner.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(crossOwner.body.error?.code).toBe("NOT_FOUND");
    expect(missing.body.error?.code).toBe("NOT_FOUND");
    expect(crossOwner.body).toEqual(missing.body);
    expect(JSON.stringify(crossOwner.body)).not.toContain(ownedByB.ticketNumber);
    expect(JSON.stringify(crossOwner.body)).not.toContain(requesterB.email);
    expect(requesterA.id).not.toBe(requesterB.id);
  });

  it("API-10 does not disclose another Requester's Attachment existence or metadata", async () => {
    const prisma = getPrisma();
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const ownedByB = await createIssue36Ticket(requesterB.id);
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ownedByB.id,
        originalFilename: "private-proof.pdf",
        storedFilename: `${randomUUID()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 12,
        storagePath: "/tmp/issue36-private-proof.pdf",
      },
    });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent
      .get(`/api/tickets/${ownedByB.id}/attachments/${attachment.id}/download`)
      .set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(404);
    expect(response.body.error?.code).toBe("NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toMatch(/private-proof|storagePath|\/tmp\//i);
  });

  it("API-10 keeps legacy requesterId compatibility routes from bypassing authenticated ownership", async () => {
    const prisma = getPrisma();
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const ownedByB = await createIssue36Ticket(requesterB.id);
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ownedByB.id,
        originalFilename: "legacy-private.pdf",
        storedFilename: `${randomUUID()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 12,
        storagePath: "/tmp/issue36-legacy-private.pdf",
      },
    });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const list = await agent.get(`/api/requesters/${requesterB.id}/tickets`).set("Origin", FRONTEND_ORIGIN);
    const detail = await agent.get(`/api/requesters/${requesterB.id}/tickets/${ownedByB.id}`).set("Origin", FRONTEND_ORIGIN);
    const download = await agent
      .get(`/api/requesters/${requesterB.id}/tickets/${ownedByB.id}/attachments/${attachment.id}/download`)
      .set("Origin", FRONTEND_ORIGIN);

    for (const response of [list, detail, download]) {
      expect(response.status).toBe(404);
      expect(response.body.error?.code).toBe("NOT_FOUND");
      expect(JSON.stringify(response.body)).not.toContain(ownedByB.ticketNumber);
      expect(JSON.stringify(response.body)).not.toContain(requesterB.email);
      expect(JSON.stringify(response.body)).not.toContain("legacy-private.pdf");
    }
  });

  it.each([fixtureUsers.staff, fixtureUsers.admin])(
    "SEC-01 denies $role access through Requester-only APIs",
    async (fixture) => {
      const { agent, response: login } = await loginIssue36(fixture);
      expect(login.status).toBe(200);

      const response = await agent.get("/api/tickets/mine").set("Origin", FRONTEND_ORIGIN);
      expect(response.status).toBe(403);
      expect(response.body.error?.code).toBe("FORBIDDEN");
      expect(response.body).not.toHaveProperty("items");
    },
  );

  it("SEC-02 never returns Internal Note content to a Requester", async () => {
    const prisma = getPrisma();
    const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requesterA.id);
    const secretNote = "Internal diagnostic details must never reach the Requester.";
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, content: secretNote } });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent.get(`/api/tickets/${ticket.id}/notes`).set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN");
    expect(JSON.stringify(response.body)).not.toContain(secretNote);
    expect(JSON.stringify(response.body)).not.toMatch(/internalNotes|noteCount/i);
  });
});
