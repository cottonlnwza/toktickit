import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  cleanupIssue36Fixtures,
  createIssue36Ticket,
  fixtureUsers,
  loginIssue36,
  provisionIssue36User,
} from "../lab-03/requester-test-helpers.js";

async function cleanup() {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(fixtureUsers).map((user) => user.email) } }, select: { id: true } });
  const ticketIds = (await prisma.ticket.findMany({ where: { requesterId: { in: users.map((user) => user.id) } }, select: { id: true } })).map((ticket) => ticket.id);
  if (ticketIds.length) {
    await prisma.actionTakenEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
  }
  await cleanupIssue36Fixtures();
}

beforeAll(async () => {
  await cleanup();
  await provisionIssue36User(fixtureUsers.requesterA);
  await provisionIssue36User(fixtureUsers.staff);
  const prisma = getPrisma();
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
  const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });

  for (let index = 0; index < 30; index += 1) {
    const ticket = await createIssue36Ticket(requester.id, { summary: `Performance smoke ${index}`, status: index % 2 === 0 ? "OPEN" : "IN_PROGRESS" });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { ownerId: index % 3 === 0 ? staff.id : null, itPriority: index % 5 === 0 ? "URGENT" : "MEDIUM" },
    });
    if (index < 12) {
      await prisma.actionTaken.create({ data: {
        ticketId: ticket.id,
        workflowCycle: 1,
        clientRequestId: randomUUID(),
        createFingerprint: randomUUID(),
        createdById: staff.id,
        actionDescription: `Performance Action ${index}`,
        status: "PLANNED",
        assigneeId: staff.id,
        followUpRequired: false,
      } });
    }
  }
});

afterAll(async () => {
  await cleanup();
  await getPrisma().$disconnect();
});

describe("Lab 4 performance smoke", () => {
  it("PERF-01 returns concise dashboard payloads within a local smoke budget", async () => {
    const requester = await loginIssue36(fixtureUsers.requesterA);
    const requesterStart = performance.now();
    const requesterResponse = await requester.agent.get("/api/dashboards/requester");
    const requesterElapsed = performance.now() - requesterStart;
    expect(requesterResponse.status).toBe(200);
    expect(requesterResponse.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
    expect(requesterResponse.body.recentlyResolved.length).toBeLessThanOrEqual(5);
    expect(requesterElapsed).toBeLessThan(3000);

    const staff = await loginIssue36(fixtureUsers.staff);
    const staffStart = performance.now();
    const staffResponse = await staff.agent.get("/api/dashboards/staff");
    const staffElapsed = performance.now() - staffStart;
    expect(staffResponse.status).toBe(200);
    expect(staffResponse.body.recentUrgentTickets.length).toBeLessThanOrEqual(5);
    expect(staffResponse.body.myRecentActions.length).toBeLessThanOrEqual(5);
    expect(staffElapsed).toBeLessThan(3000);
  });
});
