import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupIssue36Fixtures, createIssue36Ticket, fixtureUsers, loginIssue36, provisionIssue36User } from "../lab-03/requester-test-helpers.js";

async function cleanup() {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(fixtureUsers).map((u) => u.email) } }, select: { id: true } });
  const ticketIds = (await prisma.ticket.findMany({ where: { requesterId: { in: users.map((u) => u.id) } }, select: { id: true } })).map((t) => t.id);
  if (ticketIds.length) {
    await prisma.actionTakenEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
  }
  await cleanupIssue36Fixtures();
}

beforeEach(async () => {
  await cleanup();
  await provisionIssue36User(fixtureUsers.requesterA);
  await provisionIssue36User(fixtureUsers.staff);
  await provisionIssue36User(fixtureUsers.staffB);
  await provisionIssue36User(fixtureUsers.admin);
});

afterAll(async () => {
  await cleanup();
  await getPrisma().$disconnect();
});

describe("Lab 4 Staff dashboard", () => {
  it("API-20/API-21 computes active Ticket and current-cycle Action metrics with explicit enum zeros", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const staffB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staffB.email } });
    const mine = await createIssue36Ticket(requester.id, { summary: "Mine urgent", status: "IN_PROGRESS" });
    const unassigned = await createIssue36Ticket(requester.id, { summary: "Unassigned", status: "OPEN" });
    const terminal = await createIssue36Ticket(requester.id, { summary: "Resolved old", status: "RESOLVED" });
    await prisma.ticket.update({ where: { id: mine.id }, data: { ownerId: staff.id, itPriority: "URGENT" } });
    await prisma.ticket.update({ where: { id: terminal.id }, data: { ownerId: staff.id } });
    await prisma.actionTaken.create({ data: {
      ticketId: mine.id, workflowCycle: 1, clientRequestId: randomUUID(), createFingerprint: randomUUID(), createdById: staff.id,
      actionDescription: "Current work", status: "PLANNED", assigneeId: staff.id, followUpRequired: false,
    } });
    await prisma.actionTaken.create({ data: {
      ticketId: terminal.id, workflowCycle: 1, clientRequestId: randomUUID(), createFingerprint: randomUUID(), createdById: staff.id,
      actionDescription: "Historical work", status: "IN_PROGRESS", assigneeId: staff.id, followUpRequired: false,
    } });
    await prisma.actionTaken.create({ data: {
      ticketId: unassigned.id, workflowCycle: 1, clientRequestId: randomUUID(), createFingerprint: randomUUID(), createdById: staff.id,
      actionDescription: "Creator only", status: "PLANNED", assigneeId: staffB.id, followUpRequired: false,
    } });
    await prisma.actionTaken.create({ data: {
      ticketId: unassigned.id, workflowCycle: 1, clientRequestId: randomUUID(), createFingerprint: randomUUID(), createdById: staffB.id,
      actionDescription: "Performed earlier", result: "Done", status: "COMPLETED", assigneeId: staffB.id, performedById: staff.id, followUpRequired: false, completedAt: new Date(),
    } });

    const { agent } = await loginIssue36(fixtureUsers.staff);
    const response = await agent.get("/api/dashboards/staff");

    const activeStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
    const expectedUnassigned = await prisma.ticket.count({ where: { currentStatus: { in: [...activeStatuses] }, ownerId: null } });
    const expectedMine = await prisma.ticket.count({ where: { currentStatus: { in: [...activeStatuses] }, ownerId: staff.id } });
    const expectedMedium = await prisma.ticket.count({ where: { currentStatus: { in: [...activeStatuses] }, itPriority: "MEDIUM" } });
    const expectedUrgent = await prisma.ticket.count({ where: { currentStatus: { in: [...activeStatuses] }, itPriority: "URGENT" } });

    expect(response.status).toBe(200);
    expect(response.body.metrics.unassignedTickets).toBe(expectedUnassigned);
    expect(response.body.metrics.myTickets).toBe(expectedMine);
    expect(response.body.metrics.myOpenActions).toBe(1);
    expect(Object.keys(response.body.metrics.byStatus)).toEqual(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]);
    expect(response.body.metrics.byItPriority.MEDIUM).toBe(expectedMedium);
    expect(response.body.metrics.byItPriority.URGENT).toBe(expectedUrgent);
    expect(response.body.metrics.byItPriority).toMatchObject({ LOW: expect.any(Number), HIGH: expect.any(Number) });
    expect(response.body.drillDown).toMatchObject({ unassignedTickets: "/staff/tickets?owner=unassigned", myTickets: `/staff/tickets?owner=${staff.id}`, myOpenActions: "/dashboard#my-actions" });
    expect(response.body.myRecentActions.map((item: { actionDescription: string }) => item.actionDescription)).toContain("Current work");
    expect(response.body.myRecentActions.map((item: { actionDescription: string }) => item.actionDescription)).toContain("Performed earlier");
    expect(response.body.myRecentActions.map((item: { actionDescription: string }) => item.actionDescription)).not.toContain("Creator only");
    expect(response.body.myRecentActions.map((item: { actionDescription: string }) => item.actionDescription)).not.toContain("Historical work");
  });

  it("API-21 lets Administrator reuse the Staff dashboard and rejects Requesters", async () => {
    const admin = await loginIssue36(fixtureUsers.admin);
    expect((await admin.agent.get("/api/dashboards/staff")).status).toBe(200);
    expect((await admin.agent.get("/api/staff/tickets?owner=unassigned")).status).toBe(200);
    const requester = await loginIssue36(fixtureUsers.requesterA);
    const denied = await requester.agent.get("/api/dashboards/staff");
    expect(denied.status).toBe(403);
    expect(denied.body.error?.code).toBe("FORBIDDEN");
  });
});
