import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupIssue36Fixtures, createIssue36Ticket, fixtureUsers, loginIssue36, provisionIssue36User, FRONTEND_ORIGIN } from "../lab-03/requester-test-helpers.js";

beforeEach(async () => {
  await cleanupIssue36Fixtures();
  await provisionIssue36User(fixtureUsers.requesterA);
  await provisionIssue36User(fixtureUsers.staff);
  await provisionIssue36User(fixtureUsers.staffB);
  await provisionIssue36User(fixtureUsers.admin);
});

afterAll(async () => {
  await cleanupIssue36Fixtures();
  await getPrisma().$disconnect();
});

describe("Lab 4 Ticket aggregate version hardening", () => {
  it("increments version exactly once for claim and rejects a stale replay without partial write", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id, { status: "OPEN" });
    const login = await loginIssue36(fixtureUsers.staff);

    const success = await login.agent
      .post(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.response.body.csrfToken)
      .send({ expectedTicketVersion: ticket.version });
    expect(success.status).toBe(200);
    expect(success.body).toMatchObject({ owner: { id: staff.id }, version: ticket.version + 1 });

    await prisma.ticket.update({ where: { id: ticket.id }, data: { ownerId: null } });
    const stale = await login.agent
      .post(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.response.body.csrfToken)
      .send({ expectedTicketVersion: ticket.version });
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe("STALE_UPDATE");
    const persisted = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(persisted.ownerId).toBeNull();
    expect(persisted.version).toBe(ticket.version + 1);
  });

  it("owner reassignment and IT Priority each compare-and-increment the aggregate version", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staffB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staffB.email } });
    const ticket = await createIssue36Ticket(requester.id, { status: "OPEN" });
    const staffLogin = await loginIssue36(fixtureUsers.staff);

    const owner = await staffLogin.agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", staffLogin.response.body.csrfToken)
      .send({ ownerId: staffB.id, expectedTicketVersion: ticket.version });
    expect(owner.status).toBe(200);
    expect(owner.body).toMatchObject({ owner: { id: staffB.id }, version: ticket.version + 1 });

    const adminLogin = await loginIssue36(fixtureUsers.admin);
    const priority = await adminLogin.agent
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", adminLogin.response.body.csrfToken)
      .send({ itPriority: "URGENT", expectedTicketVersion: ticket.version + 1 });
    expect(priority.status).toBe(200);
    expect(priority.body).toMatchObject({ itPriority: "URGENT", version: ticket.version + 2 });

    const stale = await adminLogin.agent
      .patch(`/api/staff/tickets/${ticket.id}/it-priority`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", adminLogin.response.body.csrfToken)
      .send({ itPriority: "LOW", expectedTicketVersion: ticket.version + 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe("STALE_UPDATE");
    const persisted = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(persisted.itPriority).toBe("URGENT");
    expect(persisted.version).toBe(ticket.version + 2);
  });
});
