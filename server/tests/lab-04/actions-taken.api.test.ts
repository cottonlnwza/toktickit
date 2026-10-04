import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  FRONTEND_ORIGIN,
  fixtureUsers,
  loginIssue36,
  provisionIssue36User,
} from "../lab-03/requester-test-helpers.js";

async function ensureReferenceData() {
  const prisma = getPrisma();
  const category = await prisma.category.upsert({ where: { name: "Hardware" }, update: { isActive: true }, create: { name: "Hardware", isActive: true } });
  const relatedSystem = await prisma.relatedSystem.upsert({ where: { name: "Corporate Laptop" }, update: { isActive: true }, create: { name: "Corporate Laptop", isActive: true } });
  return { category, relatedSystem };
}

async function createTicket(status: "NEW" | "OPEN" | "RESOLVED" = "OPEN") {
  const prisma = getPrisma();
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
  const { category, relatedSystem } = await ensureReferenceData();
  const token = randomUUID();
  return prisma.ticket.create({ data: {
    ticketNumber: `L4A-${token}`,
    clientRequestId: randomUUID(),
    requesterId: requester.id,
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    summary: "Lab 4 action fixture",
    description: "Lab 4 action API test fixture.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: status,
  } });
}

async function cleanup() {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(fixtureUsers).map((u) => u.email) } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (!ids.length) return;
  const tickets = await prisma.ticket.findMany({ where: { requesterId: { in: ids } }, select: { id: true } });
  const ticketIds = tickets.map((t) => t.id);
  if (ticketIds.length) {
    await prisma.actionTakenEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(async () => {
  await cleanup();
  await provisionIssue36User(fixtureUsers.requesterA);
  await provisionIssue36User(fixtureUsers.staff);
  await provisionIssue36User(fixtureUsers.staffB);
  await provisionIssue36User(fixtureUsers.admin);
  const inactive = await provisionIssue36User(fixtureUsers.inactiveStaff);
  await getPrisma().user.update({ where: { id: inactive.id }, data: { isActive: false } });
});

afterAll(async () => {
  await cleanup();
  await getPrisma().$disconnect();
});

describe("Lab 4 Actions Taken API foundation", () => {
  it("API-01/API-10 creates one current-cycle Action, increments Ticket version, and writes one CREATED event", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const clientRequestId = randomUUID();

    const response = await agent.post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ expectedTicketVersion: 0, clientRequestId, actionDescription: " Replace cable ", assigneeId: staff.id, result: null, followUpRequired: false, followUpNote: "ignored", attachmentNotes: " Port photo " });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ replayed: false, ticketVersion: 1, action: { ticketId: ticket.id, workflowCycle: 1, status: "PLANNED", version: 0, actionDescription: "Replace cable", assignee: { id: staff.id }, performedBy: null, followUpRequired: false, followUpNote: null, attachmentNotes: "Port photo" } });
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: response.body.action.id } })).toBe(1);
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ version: 1, workflowCycle: 1 });
  });

  it("API-02 replays original create after edit without extra row/version/event", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const clientRequestId = randomUUID();
    const body = { expectedTicketVersion: 0, clientRequestId, actionDescription: "Initial intent", assigneeId: staff.id, result: null, followUpRequired: false, attachmentNotes: null };
    const first = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send(body);
    expect(first.status).toBe(201);
    const edited = await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${first.body.action.id}`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 1, expectedActionVersion: 0, actionDescription: "Edited later" });
    expect(edited.status).toBe(200);

    const replay = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.action.id).toBe(first.body.action.id);
    expect(await prisma.actionTaken.count({ where: { clientRequestId } })).toBe(1);
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: first.body.action.id } })).toBe(2);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(2);

    const conflict = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ ...body, actionDescription: "Different original intent" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe("ACTION_REPLAY_CONFLICT");
  });

  it("API-04 rejects inactive assignee and leaves aggregate unchanged", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const inactive = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.inactiveStaff.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const response = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Test", assigneeId: inactive.id, followUpRequired: false });
    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe("INACTIVE_ASSIGNEE");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(0);

    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const requesterAssignee = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Test requester", assigneeId: requester.id, followUpRequired: false });
    expect(requesterAssignee.status).toBe(409);
    expect(requesterAssignee.body.error?.code).toBe("INACTIVE_ASSIGNEE");
  });

  it("API-05 rejects stale parent or child versions without event", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const created = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Test", followUpRequired: false });
    const beforeEvents = await prisma.actionTakenEvent.count({ where: { actionTakenId: created.body.action.id } });
    const stale = await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${created.body.action.id}`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 0, expectedActionVersion: 0, actionDescription: "stale" });
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe("STALE_UPDATE");
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: created.body.action.id } })).toBe(beforeEvents);

    const staleChild = await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${created.body.action.id}`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 1, expectedActionVersion: 99, actionDescription: "stale child" });
    expect(staleChild.status).toBe(409);
    expect(staleChild.body.error?.code).toBe("STALE_UPDATE");
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: created.body.action.id } })).toBe(beforeEvents);
  });

  it("API-06/API-07 permits direct completion only by current assignee and records performer", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const created = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "One step", assigneeId: staff.id, followUpRequired: false });
    const complete = await agent.post(`/api/staff/tickets/${ticket.id}/actions/${created.body.action.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ toStatus: "COMPLETED", expectedTicketVersion: 1, expectedActionVersion: 0, result: "Done" });
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({ ticketVersion: 2, action: { status: "COMPLETED", result: "Done", performedBy: { id: staff.id }, version: 1 } });
    expect((await prisma.actionTakenEvent.findMany({ where: { actionTakenId: created.body.action.id }, orderBy: { actionVersion: "asc" } })).map((event) => event.eventType)).toEqual(["CREATED", "COMPLETED"]);
  });

  it("API-03 lets Requester read owned Actions but forbids writes", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const { agent: staffAgent, response: staffLogin } = await loginIssue36(fixtureUsers.staff);
    await staffAgent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", staffLogin.body.csrfToken).send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Visible work", followUpRequired: false });
    const { agent: requesterAgent, response: requesterLogin } = await loginIssue36(fixtureUsers.requesterA);
    const list = await requesterAgent.get(`/api/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const write = await requesterAgent.post(`/api/staff/tickets/${ticket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", requesterLogin.body.csrfToken).send({ expectedTicketVersion: 1, clientRequestId: randomUUID(), actionDescription: "No", followUpRequired: false });
    expect(write.status).toBe(403);
  });

  it("API-08 rejects missing follow-up note deterministically", async () => {
    const ticket = await createTicket();
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const response = await agent.post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Needs follow-up", followUpRequired: true, followUpNote: "   " });
    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    expect(response.body.error?.fields?.followUpNote).toEqual(expect.any(String));

    const valid = await agent.post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Completion validation", followUpRequired: false });
    const missingResult = await agent.post(`/api/staff/tickets/${ticket.id}/actions/${valid.body.action.id}/status`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ toStatus: "COMPLETED", expectedTicketVersion: 1, expectedActionVersion: 0 });
    expect(missingResult.status).toBe(400);
    expect(missingResult.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("API-09 blocks Action creation on a terminal parent Ticket", async () => {
    const ticket = await createTicket("RESOLVED");
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const response = await agent.post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Too late", followUpRequired: false });
    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe("PARENT_TICKET_NOT_ACTIVE");
  });

  it("API-07 rejects completion by a non-assignee without mutating the Action", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const { agent: creator, response: creatorLogin } = await loginIssue36(fixtureUsers.staff);
    const created = await creator.post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", creatorLogin.body.csrfToken)
      .send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Assigned work", assigneeId: staff.id, followUpRequired: false });
    const { agent: other, response: otherLogin } = await loginIssue36(fixtureUsers.staffB);
    const response = await other.post(`/api/staff/tickets/${ticket.id}/actions/${created.body.action.id}/status`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", otherLogin.body.csrfToken)
      .send({ toStatus: "COMPLETED", expectedTicketVersion: 1, expectedActionVersion: 0, result: "Attempt" });
    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe("ACTION_ASSIGNEE_MISMATCH");
    expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.body.action.id } })).toMatchObject({ status: "PLANNED", version: 0 });
  });

  it("API-11 allows Administrator Lab 4 staff behavior", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.admin.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);
    const response = await agent.post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Admin support action", assigneeId: admin.id, followUpRequired: false });
    expect(response.status).toBe(201);
    expect(response.body.action.assignee.id).toBe(admin.id);
  });

  it("API-10/API-10A keeps canonical one-event-per-version history through edit, start, and cancel", async () => {
    const prisma = getPrisma();
    const ticket = await createTicket();
    const staffB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staffB.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const created = await agent.post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Original", followUpRequired: false });
    const edited = await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${created.body.action.id}`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ expectedTicketVersion: 1, expectedActionVersion: 0, actionDescription: "Edited and reassigned", assigneeId: staffB.id });
    expect(edited.status).toBe(200);
    const started = await agent.post(`/api/staff/tickets/${ticket.id}/actions/${created.body.action.id}/status`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ toStatus: "IN_PROGRESS", expectedTicketVersion: 2, expectedActionVersion: 1 });
    expect(started.status).toBe(200);
    const cancelled = await agent.post(`/api/staff/tickets/${ticket.id}/actions/${created.body.action.id}/status`)
      .set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken)
      .send({ toStatus: "CANCELLED", expectedTicketVersion: 3, expectedActionVersion: 2 });
    expect(cancelled.status).toBe(200);

    const events = await prisma.actionTakenEvent.findMany({ where: { actionTakenId: created.body.action.id }, orderBy: [{ actionVersion: "asc" }, { id: "asc" }] });
    expect(events.map((event) => [event.actionVersion, event.eventType])).toEqual([[0, "CREATED"], [1, "UPDATED"], [2, "STARTED"], [3, "CANCELLED"]]);
    expect(events[1].changedFields).toEqual(expect.arrayContaining(["actionDescription", "assigneeId"]));
    expect(new Set(events.map((event) => event.actionVersion)).size).toBe(events.length);
  });

  it("API-06 covers the remaining approved transition edges and rejects terminal transition attempts", async () => {
    const prisma = getPrisma();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);

    const directCancelTicket = await createTicket();
    const directCancelAction = await agent.post(`/api/staff/tickets/${directCancelTicket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Cancel directly", assigneeId: staff.id, followUpRequired: false });
    const directCancel = await agent.post(`/api/staff/tickets/${directCancelTicket.id}/actions/${directCancelAction.body.action.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ toStatus: "CANCELLED", expectedTicketVersion: 1, expectedActionVersion: 0 });
    expect(directCancel.status).toBe(200);

    const terminalAttempt = await agent.post(`/api/staff/tickets/${directCancelTicket.id}/actions/${directCancelAction.body.action.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ toStatus: "IN_PROGRESS", expectedTicketVersion: 2, expectedActionVersion: 1 });
    expect(terminalAttempt.status).toBe(409);
    expect(terminalAttempt.body.error?.code).toBe("ACTION_TERMINAL");

    const startThenCompleteTicket = await createTicket();
    const startThenCompleteAction = await agent.post(`/api/staff/tickets/${startThenCompleteTicket.id}/actions`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ expectedTicketVersion: 0, clientRequestId: randomUUID(), actionDescription: "Start then complete", assigneeId: staff.id, followUpRequired: false });
    const started = await agent.post(`/api/staff/tickets/${startThenCompleteTicket.id}/actions/${startThenCompleteAction.body.action.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ toStatus: "IN_PROGRESS", expectedTicketVersion: 1, expectedActionVersion: 0 });
    expect(started.status).toBe(200);
    const completed = await agent.post(`/api/staff/tickets/${startThenCompleteTicket.id}/actions/${startThenCompleteAction.body.action.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ toStatus: "COMPLETED", expectedTicketVersion: 2, expectedActionVersion: 1, result: "Finished" });
    expect(completed.status).toBe(200);
    expect(completed.body.action.status).toBe("COMPLETED");
  });
});
