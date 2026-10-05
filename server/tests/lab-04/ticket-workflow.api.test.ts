import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { FRONTEND_ORIGIN, fixtureUsers, loginIssue36, provisionIssue36User } from "../lab-03/requester-test-helpers.js";

async function cleanup() {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(fixtureUsers).map((user) => user.email) } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;
  const tickets = await prisma.ticket.findMany({ where: { requesterId: { in: userIds } }, select: { id: true } });
  const ticketIds = tickets.map((ticket) => ticket.id);
  if (ticketIds.length) {
    await prisma.actionTakenEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createTicket(status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED" = "OPEN") {
  const prisma = getPrisma();
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
  const category = await prisma.category.upsert({ where: { name: "Hardware" }, update: { isActive: true }, create: { name: "Hardware", isActive: true } });
  const system = await prisma.relatedSystem.upsert({ where: { name: "Corporate Laptop" }, update: { isActive: true }, create: { name: "Corporate Laptop", isActive: true } });
  return prisma.ticket.create({ data: {
    ticketNumber: `L4W-${randomUUID()}`,
    clientRequestId: randomUUID(), requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id,
    summary: "Workflow fixture", description: "Lab 4 final workflow fixture", requestedPriority: "MEDIUM", itPriority: "MEDIUM", currentStatus: status,
  } });
}

async function addAction(ticketId: number, status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED", workflowCycle = 1) {
  const prisma = getPrisma();
  const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
  return prisma.actionTaken.create({ data: {
    ticketId, workflowCycle, clientRequestId: randomUUID(), createFingerprint: randomUUID(), createdById: staff.id,
    actionDescription: `${status} work`, result: status === "COMPLETED" ? "Done" : null, status, assigneeId: staff.id,
    performedById: status === "COMPLETED" ? staff.id : null, followUpRequired: false,
    completedAt: status === "COMPLETED" ? new Date() : null, cancelledAt: status === "CANCELLED" ? new Date() : null,
  } });
}

async function transition(ticketId: number, fixture: Parameters<typeof loginIssue36>[0], status: string, expectedTicketVersion: number) {
  const { agent, response: login } = await loginIssue36(fixture);
  return agent.patch(`/api/staff/tickets/${ticketId}/status`)
    .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
    .send({ status, expectedTicketVersion });
}

beforeEach(async () => {
  await cleanup();
  await provisionIssue36User(fixtureUsers.requesterA);
  await provisionIssue36User(fixtureUsers.staff);
  await provisionIssue36User(fixtureUsers.admin);
});

afterAll(async () => { await cleanup(); await getPrisma().$disconnect(); });

describe("Lab 4 final Ticket workflow", () => {
  it.each([
    ["NEW", "OPEN"], ["NEW", "CANCELLED"],
    ["OPEN", "IN_PROGRESS"], ["OPEN", "WAITING_FOR_REQUESTER"], ["OPEN", "RESOLVED"], ["OPEN", "CANCELLED"],
    ["IN_PROGRESS", "WAITING_FOR_REQUESTER"], ["IN_PROGRESS", "RESOLVED"], ["IN_PROGRESS", "CANCELLED"],
    ["WAITING_FOR_REQUESTER", "IN_PROGRESS"], ["WAITING_FOR_REQUESTER", "RESOLVED"], ["WAITING_FOR_REQUESTER", "CANCELLED"],
    ["RESOLVED", "CLOSED"], ["RESOLVED", "REOPENED"],
    ["CLOSED", "REOPENED"],
    ["REOPENED", "IN_PROGRESS"], ["REOPENED", "WAITING_FOR_REQUESTER"], ["REOPENED", "RESOLVED"], ["REOPENED", "CANCELLED"],
    ["CANCELLED", "REOPENED"],
  ] as const)("API-16 permits final matrix edge %s -> %s", async (from, to) => {
    const ticket = await createTicket(from);
    if (to === "RESOLVED") await addAction(ticket.id, "COMPLETED", ticket.workflowCycle);
    const response = await transition(ticket.id, fixtureUsers.staff, to, 0);
    expect(response.status).toBe(200);
    expect(response.body.currentStatus).toBe(to);
    expect(response.body.version).toBe(1);
    expect(response.body.workflowCycle).toBe(to === "REOPENED" ? 2 : 1);
  });

  it("API-12/API-13 blocks resolution without completed current-cycle evidence or with active work", async () => {
    const noWork = await createTicket();
    const empty = await transition(noWork.id, fixtureUsers.staff, "RESOLVED", 0);
    expect(empty.status).toBe(409);
    expect(empty.body.error?.code).toBe("RESOLUTION_GATE_BLOCKED");

    const active = await createTicket();
    await addAction(active.id, "COMPLETED");
    await addAction(active.id, "PLANNED");
    const blocked = await transition(active.id, fixtureUsers.staff, "RESOLVED", 0);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.code).toBe("RESOLUTION_GATE_BLOCKED");
    expect((await getPrisma().ticket.findUniqueOrThrow({ where: { id: active.id } })).version).toBe(0);
  });

  it("API-14/API-16 lets Staff and Administrator resolve valid current-cycle work with CAS", async () => {
    for (const fixture of [fixtureUsers.staff, fixtureUsers.admin]) {
      const ticket = await createTicket();
      await addAction(ticket.id, "COMPLETED");
      const response = await transition(ticket.id, fixture, "RESOLVED", 0);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ currentStatus: "RESOLVED", version: 1, workflowCycle: 1 });
      expect(response.body.resolvedAt).toEqual(expect.any(String));
    }
  });

  it("API-14A treats follow-up metadata as advisory but a separate active follow-up Action blocks resolution", async () => {
    const prisma = getPrisma();
    const metadataOnly = await createTicket();
    const completed = await addAction(metadataOnly.id, "COMPLETED");
    await prisma.actionTaken.update({ where: { id: completed.id }, data: { followUpRequired: true, followUpNote: "Check tomorrow" } });
    const allowed = await transition(metadataOnly.id, fixtureUsers.staff, "RESOLVED", 0);
    expect(allowed.status).toBe(200);

    const realFollowUp = await createTicket();
    const completedAgain = await addAction(realFollowUp.id, "COMPLETED");
    await prisma.actionTaken.update({ where: { id: completedAgain.id }, data: { followUpRequired: true, followUpNote: "Separate follow-up created" } });
    await addAction(realFollowUp.id, "PLANNED");
    const blocked = await transition(realFollowUp.id, fixtureUsers.staff, "RESOLVED", 0);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.code).toBe("RESOLUTION_GATE_BLOCKED");
  });

  it("API-15 reopens into a new cycle and old completed work cannot satisfy resolution", async () => {
    const ticket = await createTicket("RESOLVED");
    await addAction(ticket.id, "COMPLETED", 1);
    const reopened = await transition(ticket.id, fixtureUsers.staff, "REOPENED", 0);
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({ currentStatus: "REOPENED", version: 1, workflowCycle: 2, resolvedAt: null });
    const resolveAgain = await transition(ticket.id, fixtureUsers.staff, "RESOLVED", 1);
    expect(resolveAgain.status).toBe(409);
    expect(resolveAgain.body.error?.code).toBe("RESOLUTION_GATE_BLOCKED");
  });

  it("API-18 rejects stale and invalid transitions without mutation", async () => {
    const ticket = await createTicket();
    const stale = await transition(ticket.id, fixtureUsers.staff, "IN_PROGRESS", 99);
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe("STALE_UPDATE");
    const invalid = await transition(ticket.id, fixtureUsers.staff, "CLOSED", 0);
    expect(invalid.status).toBe(409);
    expect(invalid.body.error?.code).toBe("TICKET_TRANSITION_NOT_ALLOWED");
    expect(await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ currentStatus: "OPEN", version: 0, workflowCycle: 1 });
  });
});
