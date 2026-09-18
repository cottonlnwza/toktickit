import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  FRONTEND_ORIGIN,
  cleanupIssue36Fixtures,
  createIssue36Ticket,
  fixtureUsers,
  loginIssue36,
  provisionIssue36User,
} from "./requester-test-helpers.js";

describe("Lab 3 Issue 4 Requester resolution indication", () => {
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

  it("API-14 records Problem Appears Resolved idempotently without changing Ticket status", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id, { status: "WAITING_FOR_REQUESTER" });
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

    const first = await agent
      .post(`/api/tickets/${ticket.id}/problem-appears-resolved`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ currentStatus: "RESOLVED" });
    expect(first.status).toBe(200);
    expect(first.body.problemAppearsResolvedAt).toEqual(expect.any(String));
    expect(first.body.currentStatus).toBe("WAITING_FOR_REQUESTER");

    const storedAfterFirst = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(storedAfterFirst.currentStatus).toBe("WAITING_FOR_REQUESTER");
    expect(storedAfterFirst.problemAppearsResolvedById).toBe(requester.id);

    const second = await agent
      .post(`/api/tickets/${ticket.id}/problem-appears-resolved`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.problemAppearsResolvedAt).toBe(first.body.problemAppearsResolvedAt);
    expect(second.body.currentStatus).toBe("WAITING_FOR_REQUESTER");
  });

  it("API-14 returns safe not-found for another Requester's Ticket", async () => {
    const prisma = getPrisma();
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const ticket = await createIssue36Ticket(requesterB.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent
      .post(`/api/tickets/${ticket.id}/problem-appears-resolved`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.error?.code).toBe("NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain(ticket.ticketNumber);
  });

  it.each([fixtureUsers.staff, fixtureUsers.admin])("API-14 denies $role from the Requester-only indication action", async (fixture) => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixture);

    const response = await agent
      .post(`/api/tickets/${ticket.id}/problem-appears-resolved`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN");
  });
});
