import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
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

describe("Lab 3 authenticated Requester regression API", () => {
  beforeEach(async () => {
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
    await provisionIssue36User(fixtureUsers.requesterB);
  });

  afterAll(async () => {
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("API-11 creates a Ticket from authenticated Requester identity without requesterId", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const { category, relatedSystem } = await issue36ReferenceData();
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);
    const clientRequestId = randomUUID();

    const response = await agent
      .post("/api/tickets")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({
        clientRequestId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Authenticated Requester create",
        description: "This Ticket must derive Requester ownership from the authenticated User.",
        requestedPriority: "HIGH",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      clientRequestId,
      requesterId: requester.id,
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "NEW",
      replayed: false,
    });
    expect(response.body.owner).toBeNull();
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { clientRequestId } });
    expect(stored.requesterId).toBe(requester.id);
  });

  it("API-11 returns only the authenticated Requester's Tickets from /api/tickets/mine", async () => {
    const prisma = getPrisma();
    const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const own = await createIssue36Ticket(requesterA.id, { summary: "Visible own Ticket" });
    const other = await createIssue36Ticket(requesterB.id, { summary: "Hidden other Ticket" });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent
      .get("/api/tickets/mine?page=1&pageSize=10&sortBy=updatedAt&sortDirection=desc")
      .set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: own.id })]));
    expect(response.body.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: other.id })]));
    expect(JSON.stringify(response.body)).not.toContain(other.ticketNumber);
  });

  it("API-11 returns owned Ticket Detail through the canonical authenticated route without Internal Notes", async () => {
    const prisma = getPrisma();
    const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requesterA.id, { summary: "Owned detail Ticket" });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent.get(`/api/tickets/${ticket.id}`).set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requester: { id: requesterA.id, name: requesterA.name, email: requesterA.email },
      requestedPriority: "MEDIUM",
      currentStatus: "NEW",
      problemAppearsResolvedAt: null,
    });
    expect(response.body).not.toHaveProperty("internalNotes");
    expect(response.body).not.toHaveProperty("ownerId");
  });

  it("API-32 replays an identical clientRequestId exactly once for the same Requester", async () => {
    const prisma = getPrisma();
    const { category, relatedSystem } = await issue36ReferenceData();
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);
    const clientRequestId = randomUUID();
    const payload = {
      clientRequestId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Retry safe Ticket create",
      description: "Submitting the same normalized payload again must return the original Ticket.",
      requestedPriority: "MEDIUM",
    };

    const first = await agent.post("/api/tickets").set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send(payload);
    const replay = await agent.post("/api/tickets").set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send(payload);

    expect(first.status).toBe(201);
    expect(first.body.replayed).toBe(false);
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.ticketNumber).toBe(first.body.ticketNumber);
    expect(await prisma.ticket.count({ where: { clientRequestId } })).toBe(1);
  });

  it("API-32 rejects conflicting or cross-Requester reuse of a clientRequestId without disclosing the original Ticket", async () => {
    const prisma = getPrisma();
    const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const original = await createIssue36Ticket(requesterA.id, { clientRequestId: randomUUID(), summary: "Original replay owner" });
    const { category, relatedSystem } = await issue36ReferenceData();

    const { agent: sameOwnerAgent, response: sameOwnerLogin } = await loginIssue36(fixtureUsers.requesterA);
    const conflicting = await sameOwnerAgent
      .post("/api/tickets")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", sameOwnerLogin.body.csrfToken)
      .send({
        clientRequestId: original.clientRequestId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Different normalized payload",
        description: "This payload intentionally differs from the original Ticket payload.",
        requestedPriority: "URGENT",
      });
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.error?.code).toBe("IDEMPOTENCY_CONFLICT");

    const { agent: otherOwnerAgent, response: otherOwnerLogin } = await loginIssue36(fixtureUsers.requesterB);
    const crossOwner = await otherOwnerAgent
      .post("/api/tickets")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", otherOwnerLogin.body.csrfToken)
      .send({
        clientRequestId: original.clientRequestId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: original.summary,
        description: original.description,
        requestedPriority: original.requestedPriority,
      });
    expect(crossOwner.status).toBe(409);
    expect(crossOwner.body.error?.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(JSON.stringify(crossOwner.body)).not.toContain(original.ticketNumber);
    expect(await prisma.ticket.count({ where: { clientRequestId: original.clientRequestId } })).toBe(1);
  });
});
