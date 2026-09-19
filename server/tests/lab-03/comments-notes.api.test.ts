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

describe("Lab 3 Requester Public Comments and note protection", () => {
  beforeEach(async () => {
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
    await provisionIssue36User(fixtureUsers.requesterB);
    await provisionIssue36User(fixtureUsers.staff);
    await provisionIssue36User(fixtureUsers.staffB);
    await provisionIssue36User(fixtureUsers.admin);
  });

  afterAll(async () => {
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("API-13 stores a Requester Public Comment with backend author/time and returns oldest-to-newest safe data", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

    const create = await agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ content: "  The issue still occurs after restart.  ", authorId: 999999, createdAt: "2000-01-01T00:00:00.000Z" });

    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({
      content: "The issue still occurs after restart.",
      author: { id: requester.id, name: requester.name, role: "REQUESTER" },
      createdAt: expect.any(String),
    });
    expect(create.body.author.id).not.toBe(999999);
    expect(create.body.createdAt).not.toBe("2000-01-01T00:00:00.000Z");

    const list = await agent.get(`/api/tickets/${ticket.id}/comments`).set("Origin", FRONTEND_ORIGIN);
    expect(list.status).toBe(200);
    expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: create.body.id })]));
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|storagePath/i);
  });

  it.each(["", "   ", "x".repeat(2001)])("API-13 rejects invalid Public Comment content without creating a row", async (content) => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const before = await prisma.publicComment.count({ where: { ticketId: ticket.id } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ content });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    expect(await prisma.publicComment.count({ where: { ticketId: ticket.id } })).toBe(before);
  });

  it("API-22 preserves comment markup as inert plain-text content instead of interpreting author-supplied HTML", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);
    const content = '<script>alert("issue36")</script> Still plain text.';

    const create = await agent
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ content });

    expect(create.status).toBe(201);
    expect(create.body.content).toBe(content);
    const stored = await prisma.publicComment.findUniqueOrThrow({ where: { id: create.body.id } });
    expect(stored.content).toBe(content);
  });

  it("API-13 hides another Requester's Public Comments behind the same safe ownership response", async () => {
    const prisma = getPrisma();
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const ticket = await createIssue36Ticket(requesterB.id);
    await prisma.publicComment.create({ data: { ticketId: ticket.id, authorId: requesterB.id, content: "Private Requester B comment" } });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent.get(`/api/tickets/${ticket.id}/comments`).set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(404);
    expect(response.body.error?.code).toBe("NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain("Private Requester B comment");
  });

  it("API-23 denies Requester Internal Note access without leaking note content/count/existence", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const secret = "Staff-only root cause analysis";
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, content: secret } });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent.get(`/api/tickets/${ticket.id}/notes`).set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN");
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(JSON.stringify(response.body)).not.toMatch(/count|exists|internal/i);
  });

  it("API-22 lets IT Staff post Public Comments with backend author/time and plain-text markup preservation", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const content = '  <b>Public</b> update from IT Staff.  ';
    const response = await agent.post(`/api/tickets/${ticket.id}/comments`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ content, authorId: requester.id });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ content: "<b>Public</b> update from IT Staff.", author: { id: staff.id, role: "IT_STAFF" }, createdAt: expect.any(String) });
  });

  it.each(["", "   ", "x".repeat(2001)])("API-24 rejects invalid Internal Note content without creating a row", async (content) => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const before = await prisma.internalNote.count({ where: { ticketId: ticket.id } });
    const response = await agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ content });
    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    expect(await prisma.internalNote.count({ where: { ticketId: ticket.id } })).toBe(before);
  });

  it("API-24 lets IT Staff create/read Internal Notes, lets Admin read only, and keeps backend author/time", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    const create = await agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ content: "  <script>not executable</script> internal  ", authorId: requester.id });
    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({ content: "<script>not executable</script> internal", author: { id: staff.id, role: "IT_STAFF" }, createdAt: expect.any(String) });

    const list = await agent.get(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", FRONTEND_ORIGIN);
    expect(list.status).toBe(200);
    expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: create.body.id })]));

    const { agent: adminAgent, response: adminLogin } = await loginIssue36(fixtureUsers.admin);
    expect((await adminAgent.get(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", FRONTEND_ORIGIN)).status).toBe(200);
    const adminPost = await adminAgent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", adminLogin.body.csrfToken).send({ content: "Admin should not post" });
    expect(adminPost.status).toBe(403);
  });

  it("API-24 keeps Requester out of canonical Staff Internal Note endpoints without leaking note content", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const secret = "canonical internal secret";
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, content: secret } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);
    const read = await agent.get(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", FRONTEND_ORIGIN);
    expect(read.status).toBe(403);
    expect(JSON.stringify(read.body)).not.toContain(secret);
    const post = await agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", FRONTEND_ORIGIN).set("X-CSRF-Token", login.body.csrfToken).send({ content: "nope" });
    expect(post.status).toBe(403);
  });
});
