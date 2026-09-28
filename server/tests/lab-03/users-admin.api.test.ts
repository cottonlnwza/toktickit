import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword, isVersionedScryptHash, verifyPassword } from "../../src/auth/password.js";
import { getPrisma } from "../../src/prisma.js";
import {
  FRONTEND_ORIGIN,
  TEST_PASSWORD,
  cleanupIssue36Fixtures,
  createIssue36Ticket,
  fixtureUsers,
  loginIssue36,
  provisionIssue36User,
} from "./requester-test-helpers.js";

const ADMIN_B_EMAIL = "issue39.admin.b@example.test";
const CREATE_EMAIL = "issue39.created@example.test";
const EDIT_EMAIL = "issue39.edited@example.test";
const INITIAL_PASSWORD = "Issue39-Initial-2026";
const RESET_PASSWORD = "Issue39-Reset-2026";

async function cleanupIssue39Users() {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_B_EMAIL, CREATE_EMAIL, EDIT_EMAIL] } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length > 0) {
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function provisionAdminB() {
  return getPrisma().user.create({
    data: {
      name: "Issue 39 Administrator B",
      email: ADMIN_B_EMAIL,
      role: UserRole.ADMINISTRATOR,
      isActive: true,
      passwordHash: await hashPassword(TEST_PASSWORD),
      mustChangePassword: false,
    },
  });
}

describe("Lab 3 Issue 7 Administrator User Management API", () => {
  beforeEach(async () => {
    await cleanupIssue39Users();
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
    await provisionIssue36User(fixtureUsers.staff);
    await provisionIssue36User(fixtureUsers.admin);
  });

  afterAll(async () => {
    await cleanupIssue39Users();
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("API-26 lists only safe User fields and supports name/email search plus one role filter", async () => {
    const { agent } = await loginIssue36(fixtureUsers.admin);

    const list = await agent.get("/api/admin/users").set("Origin", FRONTEND_ORIGIN);
    expect(list.status).toBe(200);
    expect(list.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: fixtureUsers.requesterA.name, email: fixtureUsers.requesterA.email, role: "REQUESTER", isActive: true }),
      expect.objectContaining({ name: fixtureUsers.staff.name, email: fixtureUsers.staff.email, role: "IT_STAFF", isActive: true }),
      expect.objectContaining({ name: fixtureUsers.admin.name, email: fixtureUsers.admin.email, role: "ADMINISTRATOR", isActive: true }),
    ]));
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash/i);

    const byName = await agent.get("/api/admin/users").query({ search: "requester a" }).set("Origin", FRONTEND_ORIGIN);
    expect(byName.status).toBe(200);
    expect(byName.body.map((user: { email: string }) => user.email)).toEqual([fixtureUsers.requesterA.email]);

    const byEmail = await agent.get("/api/admin/users").query({ search: "ISSUE36.STAFF@" }).set("Origin", FRONTEND_ORIGIN);
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.map((user: { email: string }) => user.email)).toEqual([fixtureUsers.staff.email]);

    const role = await agent.get("/api/admin/users").query({ role: "ADMINISTRATOR" }).set("Origin", FRONTEND_ORIGIN);
    expect(role.status).toBe(200);
    expect(role.body.every((user: { role: string }) => user.role === "ADMINISTRATOR")).toBe(true);
  });

  it("API-26 rejects unknown, repeated, over-limit, and invalid-role query values safely", async () => {
    const { agent } = await loginIssue36(fixtureUsers.admin);
    for (const path of [
      "/api/admin/users?unknown=1",
      "/api/admin/users?search=a&search=b",
      `/api/admin/users?search=${"x".repeat(101)}`,
      "/api/admin/users?role=OWNER",
    ]) {
      const response = await agent.get(path).set("Origin", FRONTEND_ORIGIN);
      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe("INVALID_QUERY");
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash/i);
    }
  });

  it("API-27 creates one normalized-role User with a salted hash and mustChangePassword=true", async () => {
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);
    const response = await agent
      .post("/api/admin/users")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({
        name: "  New User  ",
        email: "  ISSUE39.CREATED@EXAMPLE.TEST  ",
        role: "REQUESTER",
        isActive: true,
        initialPassword: INITIAL_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "New User",
      email: CREATE_EMAIL,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: true,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|initialPassword/i);
    const stored = await getPrisma().user.findUniqueOrThrow({ where: { email: CREATE_EMAIL } });
    expect(stored.passwordHash).not.toBe(INITIAL_PASSWORD);
    expect(isVersionedScryptHash(stored.passwordHash)).toBe(true);
    await expect(verifyPassword(INITIAL_PASSWORD, stored.passwordHash)).resolves.toBe(true);
  });

  it("API-28 rejects duplicate normalized email, invalid role, and invalid input without partial Users", async () => {
    const prisma = getPrisma();
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);
    const before = await prisma.user.count();

    const duplicate = await agent
      .post("/api/admin/users")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ name: "Duplicate", email: `  ${fixtureUsers.requesterA.email.toUpperCase()}  `, role: "REQUESTER", isActive: true, initialPassword: INITIAL_PASSWORD });
    expect(duplicate.status).toBe(409);

    const invalidRole = await agent
      .post("/api/admin/users")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ name: "Invalid Role", email: CREATE_EMAIL, role: "OWNER", isActive: true, initialPassword: INITIAL_PASSWORD });
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error?.code).toBe("VALIDATION_ERROR");

    const invalidInput = await agent
      .post("/api/admin/users")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ name: " ", email: "not-an-email", role: "REQUESTER", isActive: true, initialPassword: "short" });
    expect(invalidInput.status).toBe(400);
    expect(await prisma.user.count()).toBe(before);
  });

  it("API-29 rejects self-deactivation and protects the last active Administrator atomically", async () => {
    const prisma = getPrisma();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.admin.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);

    const self = await agent
      .patch(`/api/admin/users/${admin.id}`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ isActive: false });
    expect(self.status).toBe(409);
    expect(self.body.error?.code).toBe("SELF_DEACTIVATION_FORBIDDEN");

    const otherActiveAdmins = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, id: { not: admin.id } },
      select: { id: true },
    });
    try {
      if (otherActiveAdmins.length > 0) {
        await prisma.user.updateMany({ where: { id: { in: otherActiveAdmins.map((user) => user.id) } }, data: { isActive: false } });
      }
      const lastRole = await agent
        .patch(`/api/admin/users/${admin.id}`)
        .set("Origin", FRONTEND_ORIGIN)
        .set("X-CSRF-Token", login.body.csrfToken)
        .send({ role: "IT_STAFF" });
      expect(lastRole.status).toBe(409);
      expect(lastRole.body.error?.code).toBe("LAST_ACTIVE_ADMIN_REQUIRED");
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
      expect(stored.isActive).toBe(true);
      expect(stored.role).toBe("ADMINISTRATOR");
    } finally {
      if (otherActiveAdmins.length > 0) {
        await prisma.user.updateMany({ where: { id: { in: otherActiveAdmins.map((user) => user.id) } }, data: { isActive: true } });
      }
    }
  });

  it("API-30 edits only allowed fields and revokes target sessions on role or activation change", async () => {
    const prisma = getPrisma();
    const target = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const { agent: targetAgent } = await loginIssue36(fixtureUsers.staff);
    expect((await targetAgent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(200);
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);

    const response = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ name: "Edited Staff", email: EDIT_EMAIL, role: "REQUESTER", isActive: true });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: target.id, name: "Edited Staff", email: EDIT_EMAIL, role: "REQUESTER", isActive: true });
    expect((await targetAgent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(401);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.email).toBe(EDIT_EMAIL);
    expect(stored.role).toBe("REQUESTER");
  });

  it("API-30 deactivation revokes sessions and unassigns owned Tickets to preserve BR-18", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const target = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const ticket = await createIssue36Ticket(requester.id);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { ownerId: target.id } });
    const { agent: targetAgent } = await loginIssue36(fixtureUsers.staff);
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);

    const response = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);
    expect((await targetAgent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(401);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBeNull();
  });

  it("API-30 rejects password fields in ordinary edit and exposes no delete endpoint", async () => {
    const prisma = getPrisma();
    const target = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });

    const passwordInPatch = await agent
      .patch(`/api/admin/users/${target.id}`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ initialPassword: RESET_PASSWORD });
    expect(passwordInPatch.status).toBe(400);
    expect(passwordInPatch.body.error?.code).toBe("VALIDATION_ERROR");

    const deletion = await agent
      .delete(`/api/admin/users/${target.id}`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken);
    expect(deletion.status).toBe(404);
    expect(await prisma.user.findUnique({ where: { id: target.id } })).toMatchObject({ id: before.id, email: before.email });
  });

  it("API-30 sets a new initial password, requires next-login change, and revokes active target sessions", async () => {
    const prisma = getPrisma();
    const target = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    await prisma.user.update({ where: { id: target.id }, data: { mustChangePassword: false } });
    const { agent: targetAgent } = await loginIssue36(fixtureUsers.requesterA);
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);

    const response = await agent
      .post(`/api/admin/users/${target.id}/initial-password`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ initialPassword: RESET_PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: target.id, mustChangePassword: true });
    expect((await targetAgent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(401);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.mustChangePassword).toBe(true);
    await expect(verifyPassword(RESET_PASSWORD, stored.passwordHash)).resolves.toBe(true);
  });

  it("API-30 rejects setting the Administrator's own initial password and rejects reusing the target's current password", async () => {
    const prisma = getPrisma();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.admin.email } });
    const target = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);

    const self = await agent
      .post(`/api/admin/users/${admin.id}/initial-password`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ initialPassword: RESET_PASSWORD });
    expect(self.status).toBe(403);

    const same = await agent
      .post(`/api/admin/users/${target.id}/initial-password`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ initialPassword: TEST_PASSWORD });
    expect(same.status).toBe(400);
    expect(same.body.error?.fields?.initialPassword).toMatch(/differ/i);
  });

  it.each([fixtureUsers.requesterA, fixtureUsers.staff])("API-31 forbids $role User Management without leaking protected User data", async (fixture) => {
    const { agent, response: login } = await loginIssue36(fixture);
    const list = await agent.get("/api/admin/users").set("Origin", FRONTEND_ORIGIN);
    expect(list.status).toBe(403);
    expect(JSON.stringify(list.body)).not.toContain(fixtureUsers.admin.email);

    const create = await agent
      .post("/api/admin/users")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ name: "Nope", email: CREATE_EMAIL, role: "REQUESTER", isActive: true, initialPassword: INITIAL_PASSWORD });
    expect(create.status).toBe(403);
    expect(JSON.stringify(create.body)).not.toContain(fixtureUsers.admin.email);
  });

  it("API-29 allows editing another Administrator when a second active Administrator preserves the safety floor", async () => {
    const prisma = getPrisma();
    const second = await provisionAdminB();
    const { agent, response: login } = await loginIssue36(fixtureUsers.admin);

    const response = await agent
      .patch(`/api/admin/users/${second.id}`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ role: "IT_STAFF" });
    expect(response.status).toBe(200);
    expect(response.body.role).toBe("IT_STAFF");
    expect((await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.admin.email } })).role).toBe("ADMINISTRATOR");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: second.id } })).role).toBe("IT_STAFF");
  });

  it("API-29 serializes concurrent Administrator demotions so exactly one active Administrator remains", async () => {
    const prisma = getPrisma();
    const first = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.admin.email } });
    const second = await provisionAdminB();
    const { agent: firstAgent, response: firstLogin } = await loginIssue36(fixtureUsers.admin);
    const secondAgent = request.agent(app);
    const secondLogin = await secondAgent.post("/api/auth/login").set("Origin", FRONTEND_ORIGIN).send({ email: ADMIN_B_EMAIL, password: TEST_PASSWORD });
    expect(secondLogin.status).toBe(200);

    const otherActiveAdmins = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, id: { notIn: [first.id, second.id] } },
      select: { id: true },
    });
    try {
      if (otherActiveAdmins.length > 0) {
        await prisma.user.updateMany({ where: { id: { in: otherActiveAdmins.map((user) => user.id) } }, data: { isActive: false } });
      }

      const [firstResponse, secondResponse] = await Promise.all([
        firstAgent
          .patch(`/api/admin/users/${first.id}`)
          .set("Origin", FRONTEND_ORIGIN)
          .set("X-CSRF-Token", firstLogin.body.csrfToken)
          .send({ role: "IT_STAFF" }),
        secondAgent
          .patch(`/api/admin/users/${second.id}`)
          .set("Origin", FRONTEND_ORIGIN)
          .set("X-CSRF-Token", secondLogin.body.csrfToken)
          .send({ role: "IT_STAFF" }),
      ]);

      expect([firstResponse.status, secondResponse.status].sort()).toEqual([200, 409]);
      const conflict = firstResponse.status === 409 ? firstResponse : secondResponse;
      expect(conflict.body.error?.code).toBe("LAST_ACTIVE_ADMIN_REQUIRED");
      expect(await prisma.user.count({ where: { id: { in: [first.id, second.id] }, role: "ADMINISTRATOR", isActive: true } })).toBe(1);
    } finally {
      await prisma.user.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { role: "ADMINISTRATOR", isActive: true } });
      if (otherActiveAdmins.length > 0) {
        await prisma.user.updateMany({ where: { id: { in: otherActiveAdmins.map((user) => user.id) } }, data: { isActive: true } });
      }
    }
  });
});
