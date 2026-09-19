import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeFile } from "node:fs/promises";
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

  it.each(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const)(
    "API-14 records Problem Appears Resolved in eligible %s status without changing Ticket status",
    async (status) => {
      const prisma = getPrisma();
      const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
      const ticket = await createIssue36Ticket(requester.id, { status });
      const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

      const response = await agent
        .post(`/api/tickets/${ticket.id}/problem-appears-resolved`)
        .set("Origin", FRONTEND_ORIGIN)
        .set("X-CSRF-Token", login.body.csrfToken)
        .send({ currentStatus: "RESOLVED" });

      expect(response.status).toBe(200);
      expect(response.body.problemAppearsResolvedAt).toEqual(expect.any(String));
      expect(response.body.currentStatus).toBe(status);
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(stored.currentStatus).toBe(status);
      expect(stored.problemAppearsResolvedById).toBe(requester.id);
    },
  );

  it("API-14 repeats Problem Appears Resolved idempotently while the Ticket remains eligible", async () => {
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

  it.each(["NEW", "RESOLVED", "CLOSED", "CANCELLED"] as const)(
    "API-14 rejects Problem Appears Resolved in ineligible %s status without writing an indication",
    async (status) => {
      const prisma = getPrisma();
      const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
      const ticket = await createIssue36Ticket(requester.id, { status });
      const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

      const response = await agent
        .post(`/api/tickets/${ticket.id}/problem-appears-resolved`)
        .set("Origin", FRONTEND_ORIGIN)
        .set("X-CSRF-Token", login.body.csrfToken)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.error?.code).toBe("RESOLUTION_INDICATION_NOT_ALLOWED");
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(stored.currentStatus).toBe(status);
      expect(stored.problemAppearsResolvedAt).toBeNull();
      expect(stored.problemAppearsResolvedById).toBeNull();
    },
  );

  it("API-14 keeps eligibility atomic when Staff changes an eligible Ticket to an ineligible status before the indication write", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id, { status: "OPEN" });
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

    let signalStatusLocked!: () => void;
    let releaseStatusCommit!: () => void;
    const statusLocked = new Promise<void>((resolve) => { signalStatusLocked = resolve; });
    const allowStatusCommit = new Promise<void>((resolve) => { releaseStatusCommit = resolve; });

    const staffTransition = prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { currentStatus: "RESOLVED" },
      });
      signalStatusLocked();
      await allowStatusCommit;
    });

    await statusLocked;
    let indicationSettled = false;
    const indicationPromise = agent
      .post(`/api/tickets/${ticket.id}/problem-appears-resolved`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({})
      .then((response) => {
        indicationSettled = true;
        return response;
      });

    // Calling .then() starts the Supertest HTTP request immediately. While the Staff
    // transaction still owns the Ticket row lock, the Requester request must remain pending.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(indicationSettled).toBe(false);

    releaseStatusCommit();
    await staffTransition;
    const response = await indicationPromise;

    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe("RESOLUTION_INDICATION_NOT_ALLOWED");
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.currentStatus).toBe("RESOLVED");
    expect(stored.problemAppearsResolvedAt).toBeNull();
    expect(stored.problemAppearsResolvedById).toBeNull();
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

describe("Lab 3 Issue 6 IT Staff Ticket Detail operations", () => {
  beforeEach(async () => {
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
    await provisionIssue36User(fixtureUsers.staff);
    await provisionIssue36User(fixtureUsers.staffB);
    await provisionIssue36User(fixtureUsers.admin);
    const inactive = await provisionIssue36User(fixtureUsers.inactiveStaff);
    await getPrisma().user.update({ where: { id: inactive.id }, data: { isActive: false } });
  });

  afterAll(async () => {
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("API-18/25 returns grouped safe Staff Detail with Attachment continuity and owner choices", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id, { status: "OPEN" });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { ownerId: staff.id, requestedPriority: "HIGH", itPriority: "URGENT" } });
    const filePath = path.join(tmpdir(), `issue38-${randomUUID()}.pdf`);
    await writeFile(filePath, Buffer.from("issue38 attachment"));
    const attachment = await prisma.attachment.create({ data: {
      ticketId: ticket.id,
      originalFilename: "issue38.pdf",
      storedFilename: `${randomUUID()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 18,
      storagePath: filePath,
    } });
    const { agent } = await loginIssue36(fixtureUsers.staff);

    const response = await agent.get(`/api/staff/tickets/${ticket.id}`).set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: ticket.id,
      requester: { id: requester.id, name: requester.name, email: requester.email },
      requestedPriority: "HIGH",
      itPriority: "URGENT",
      currentStatus: "OPEN",
      owner: { id: staff.id, role: "IT_STAFF" },
      attachments: [expect.objectContaining({ id: attachment.id, originalFilename: "issue38.pdf", state: "active" })],
    });
    expect(response.body.ownerOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: fixtureUsers.staffB.name, role: "IT_STAFF" }),
      expect.objectContaining({ name: fixtureUsers.admin.name, role: "ADMINISTRATOR" }),
    ]));
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|storagePath/i);

    const download = await agent.get(`/api/staff/tickets/${ticket.id}/attachments/${attachment.id}/download`).set("Origin", FRONTEND_ORIGIN);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
  });

  it("API-18 claims only an unassigned Ticket for the current active IT Staff", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const other = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staffB.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);

    const claim = await agent.post(`/api/staff/tickets/${ticket.id}/claim`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({});
    expect(claim.status).toBe(200);
    expect(claim.body.owner).toMatchObject({ id: staff.id, role: "IT_STAFF" });

    await prisma.ticket.update({ where: { id: ticket.id }, data: { ownerId: other.id } });
    const conflict = await agent.post(`/api/staff/tickets/${ticket.id}/claim`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({});
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe("OWNER_CONFLICT");
  });

  it.each([
    ["deactivation", { isActive: false }],
    ["demotion", { role: "REQUESTER" as const }],
  ])("API-18 serializes claim against concurrent claimant %s and never persists an ineligible owner", async (_label, mutation) => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);

    let signalUserLocked!: () => void;
    let releaseUserCommit!: () => void;
    const userLocked = new Promise<void>((resolve) => { signalUserLocked = resolve; });
    const allowUserCommit = new Promise<void>((resolve) => { releaseUserCommit = resolve; });

    const concurrentUserChange = prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: staff.id }, data: mutation });
      signalUserLocked();
      await allowUserCommit;
    });

    await userLocked;
    let claimSettled = false;
    const claimPromise = agent
      .post(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({})
      .then((response) => {
        claimSettled = true;
        return response;
      });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(claimSettled).toBe(false);

    releaseUserCommit();
    await concurrentUserChange;
    const claim = await claimPromise;

    expect(claim.status).toBe(403);
    expect(claim.body.error?.code).toBe("FORBIDDEN");
    const storedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(storedTicket.ownerId).toBeNull();
  });

  it("API-19 assigns/reassigns/unassigns only active IT Staff or Administrator owners", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const target = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staffB.email } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.admin.email } });
    const requesterTarget = requester;
    const inactive = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.inactiveStaff.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const patchOwner = (ownerId: number | null) => agent.patch(`/api/staff/tickets/${ticket.id}/owner`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ ownerId });

    expect((await patchOwner(target.id)).body.owner).toMatchObject({ id: target.id, role: "IT_STAFF" });
    expect((await patchOwner(admin.id)).body.owner).toMatchObject({ id: admin.id, role: "ADMINISTRATOR" });
    expect((await patchOwner(null)).body.owner).toBeNull();
    for (const invalidId of [requesterTarget.id, inactive.id, 99999999]) {
      const response = await patchOwner(invalidId);
      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe("INVALID_OWNER");
    }
  });

  it.each([
    ["deactivation", { isActive: false }],
    ["demotion", { role: "REQUESTER" as const }],
  ])("API-19 serializes owner assignment against concurrent target %s and never persists an ineligible owner", async (_label, mutation) => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const target = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staffB.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);

    let signalTargetLocked!: () => void;
    let releaseTargetCommit!: () => void;
    const targetLocked = new Promise<void>((resolve) => { signalTargetLocked = resolve; });
    const allowTargetCommit = new Promise<void>((resolve) => { releaseTargetCommit = resolve; });

    const concurrentTargetChange = prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: mutation });
      signalTargetLocked();
      await allowTargetCommit;
    });

    await targetLocked;
    let assignmentSettled = false;
    const assignmentPromise = agent
      .patch(`/api/staff/tickets/${ticket.id}/owner`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ ownerId: target.id })
      .then((response) => {
        assignmentSettled = true;
        return response;
      });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(assignmentSettled).toBe(false);

    releaseTargetCommit();
    await concurrentTargetChange;
    const assignment = await assignmentPromise;

    expect(assignment.status).toBe(400);
    expect(assignment.body.error?.code).toBe("INVALID_OWNER");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBeNull();
  });

  it("API-20 lets IT Staff and Administrator change IT Priority while Requested Priority stays immutable", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { requestedPriority: "HIGH", itPriority: "HIGH" } });

    for (const fixture of [fixtureUsers.staff, fixtureUsers.admin]) {
      const { agent, response: login } = await loginIssue36(fixture);
      const response = await agent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ itPriority: "URGENT", requestedPriority: "LOW" });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ itPriority: "URGENT", requestedPriority: "HIGH" });
    }
    const { agent: requesterAgent, response: requesterLogin } = await loginIssue36(fixtureUsers.requesterA);
    const denied = await requesterAgent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", requesterLogin.body.csrfToken).send({ itPriority: "LOW" });
    expect(denied.status).toBe(403);
  });

  it.each([
    ["NEW", "OPEN"], ["OPEN", "IN_PROGRESS"], ["IN_PROGRESS", "WAITING_FOR_REQUESTER"],
    ["WAITING_FOR_REQUESTER", "RESOLVED"], ["RESOLVED", "CLOSED"], ["CLOSED", "REOPENED"],
    ["REOPENED", "CANCELLED"], ["CANCELLED", "REOPENED"],
  ] as const)("API-21 allows IT Staff transition %s -> %s", async (from, to) => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id, { status: from });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const response = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ status: to });
    expect(response.status).toBe(200);
    expect(response.body.currentStatus).toBe(to);
  });

  it("API-21 rejects known invalid transitions and wrong roles without mutation", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id, { status: "NEW" });
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const invalid = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ status: "RESOLVED" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error?.code).toBe("INVALID_TRANSITION");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("NEW");
    for (const fixture of [fixtureUsers.requesterA, fixtureUsers.admin]) {
      const { agent: wrongAgent, response: wrongLogin } = await loginIssue36(fixture);
      const denied = await wrongAgent.patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", wrongLogin.body.csrfToken).send({ status: "OPEN" });
      expect(denied.status).toBe(403);
    }
  });

  it("SEC-01 keeps Staff Detail mutations behind the role matrix while Administrator retains read oversight", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);

    const { agent: requesterAgent, response: requesterLogin } = await loginIssue36(fixtureUsers.requesterA);
    const requesterDetail = await requesterAgent.get(`/api/staff/tickets/${ticket.id}`).set("Origin", FRONTEND_ORIGIN);
    expect(requesterDetail.status).toBe(403);
    const requesterClaim = await requesterAgent.post(`/api/staff/tickets/${ticket.id}/claim`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", requesterLogin.body.csrfToken).send({});
    expect(requesterClaim.status).toBe(403);

    const { agent: adminAgent, response: adminLogin } = await loginIssue36(fixtureUsers.admin);
    const adminDetail = await adminAgent.get(`/api/staff/tickets/${ticket.id}`).set("Origin", FRONTEND_ORIGIN);
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.internalNotes).toBeDefined();
    const adminOwner = await adminAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", adminLogin.body.csrfToken).send({ ownerId: null });
    expect(adminOwner.status).toBe(403);
    const adminClaim = await adminAgent.post(`/api/staff/tickets/${ticket.id}/claim`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", adminLogin.body.csrfToken).send({});
    expect(adminClaim.status).toBe(403);
  });
});
