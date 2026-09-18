import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createHash } from "node:crypto";
import { app } from "../../src/app.js";
import { hashPassword, isVersionedScryptHash, verifyPassword } from "../../src/auth/password.js";
import { getPrisma } from "../../src/prisma.js";

const FRONTEND_ORIGIN = "http://localhost:5173";
const INITIAL_PASSWORD = "Lab3-ChangeMe-2026";
const CHANGED_PASSWORD = "Changed-Lab3-Password-2026";

const users = {
  active: { email: "auth.active@example.test", name: "Auth Active", isActive: true, mustChangePassword: false },
  inactive: { email: "auth.inactive@example.test", name: "Auth Inactive", isActive: false, mustChangePassword: false },
  change: { email: "auth.change@example.test", name: "Auth Change", isActive: true, mustChangePassword: true },
  throttle: { email: "auth.throttle@example.test", name: "Auth Throttle", isActive: true, mustChangePassword: false },
  throttleWindow: { email: "auth.throttle.window@example.test", name: "Auth Throttle Window", isActive: true, mustChangePassword: false },
} as const;

function cookieFrom(response: request.Response) {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((value) => value.startsWith("tt_session="));
}

async function provisionAuthUser(
  fixture: (typeof users)[keyof typeof users],
  password = INITIAL_PASSWORD,
) {
  const prisma = getPrisma();
  const user = await prisma.user.upsert({
    where: { email: fixture.email },
    update: {
      name: fixture.name,
      role: UserRole.REQUESTER,
      isActive: fixture.isActive,
      passwordHash: await hashPassword(password),
      mustChangePassword: fixture.mustChangePassword,
    },
    create: {
      name: fixture.name,
      email: fixture.email,
      role: UserRole.REQUESTER,
      isActive: fixture.isActive,
      passwordHash: await hashPassword(password),
      mustChangePassword: fixture.mustChangePassword,
    },
  });
  await prisma.authSession.deleteMany({ where: { userId: user.id } });
  return user;
}

async function login(agent: ReturnType<typeof request.agent>, email: string, password = INITIAL_PASSWORD) {
  return agent
    .post("/api/auth/login")
    .set("Origin", FRONTEND_ORIGIN)
    .send({ email, password });
}

describe("Lab 3 authentication API", () => {
  beforeEach(async () => {
    process.env.FRONTEND_ORIGIN = FRONTEND_ORIGIN;
    await provisionAuthUser(users.active);
    await provisionAuthUser(users.inactive);
    await provisionAuthUser(users.change);
    await provisionAuthUser(users.throttle);
    await provisionAuthUser(users.throttleWindow);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const emails = Object.values(users).map((user) => user.email);
    const ids = (await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((user) => user.id);
    if (ids.length > 0) await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it("API-01 authenticates an active user, returns safe identity/CSRF data, and sets only an HttpOnly session cookie", async () => {
    const agent = request.agent(app);
    const response = await login(agent, `  ${users.active.email.toUpperCase()}  `);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: expect.any(Number),
      name: users.active.name,
      email: users.active.email,
      role: "REQUESTER",
      mustChangePassword: false,
    });
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect(response.body.csrfToken.length).toBeGreaterThan(20);
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(response.body).not.toHaveProperty("sessionToken");
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const sessionCookie = cookieFrom(response);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookie).toMatch(/Path=\//i);
    expect(response.headers["access-control-allow-origin"]).toBe(FRONTEND_ORIGIN);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");

    const rawSessionToken = sessionCookie!.split(";")[0].split("=")[1];
    const storedSession = await getPrisma().authSession.findFirstOrThrow({
      where: { userId: response.body.user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(storedSession.tokenHash).toBe(createHash("sha256").update(rawSessionToken).digest("hex"));
    expect(storedSession.tokenHash).not.toBe(rawSessionToken);
    expect(storedSession.csrfTokenHash).toBe(createHash("sha256").update(response.body.csrfToken).digest("hex"));
    expect(storedSession.csrfTokenHash).not.toBe(response.body.csrfToken);
    expect(storedSession.expiresAt.getTime() - storedSession.createdAt.getTime()).toBeGreaterThanOrEqual(8 * 60 * 60 * 1000 - 5_000);
    expect(storedSession.expiresAt.getTime() - storedSession.createdAt.getTime()).toBeLessThanOrEqual(8 * 60 * 60 * 1000 + 5_000);
  });

  it("API-02 rejects malformed or invalid credentials without leaking account/profile/credential details", async () => {
    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: "", password: "" });
    expect(malformed.status).toBe(400);
    expect(JSON.stringify(malformed.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|stack/i);

    const invalid = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: users.active.email, password: "Wrong-Lab3-Password" });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error?.code).toBe("INVALID_CREDENTIALS");
    expect(JSON.stringify(invalid.body)).not.toContain(users.active.name);
    expect(JSON.stringify(invalid.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|stack/i);

    const unknown = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: "missing.user@example.test", password: "Wrong-Lab3-Password" });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(invalid.body);

    const inactiveWrongPassword = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: users.inactive.email, password: "Wrong-Lab3-Password" });
    expect(inactiveWrongPassword.status).toBe(401);
    expect(inactiveWrongPassword.body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it("API-03 rejects an inactive account with the documented safe inactive response", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: users.inactive.email, password: INITIAL_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("ACCOUNT_INACTIVE");
    expect(JSON.stringify(response.body)).not.toContain(users.inactive.name);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|stack/i);
  });

  it("API-04 throttles the sixth failed login for the same normalized email/client address after five failures", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", FRONTEND_ORIGIN)
        .set("X-Forwarded-For", "203.0.113.45")
        .send({ email: ` ${users.throttle.email.toUpperCase()} `, password: "Wrong-Lab3-Password" });
      expect(response.status).toBe(401);
    }

    const throttled = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-Forwarded-For", "203.0.113.45")
      .send({ email: users.throttle.email, password: INITIAL_PASSWORD });
    expect(throttled.status).toBe(429);
    expect(throttled.body.error?.code).toBe("LOGIN_THROTTLED");
  });

  it("API-04 keeps failures inside the 15-minute window even when a successful login occurs between failures", async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", FRONTEND_ORIGIN)
        .send({ email: users.throttleWindow.email, password: "Wrong-Lab3-Password" });
      expect(response.status).toBe(401);
    }

    const successfulLogin = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: users.throttleWindow.email, password: INITIAL_PASSWORD });
    expect(successfulLogin.status).toBe(200);

    const fifthFailure = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: users.throttleWindow.email, password: "Wrong-Lab3-Password" });
    expect(fifthFailure.status).toBe(401);

    const throttled = await request(app)
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: users.throttleWindow.email, password: INITIAL_PASSWORD });
    expect(throttled.status).toBe(429);
    expect(throttled.body.error?.code).toBe("LOGIN_THROTTLED");
  });

  it("API-05 returns only safe current-user data and rotates the CSRF token", async () => {
    const agent = request.agent(app);
    const signedIn = await login(agent, users.active.email);
    expect(signedIn.status).toBe(200);

    const response = await agent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN);
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      name: users.active.name,
      email: users.active.email,
      role: "REQUESTER",
      mustChangePassword: false,
    });
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect(response.body.csrfToken).not.toBe(signedIn.body.csrfToken);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash/i);
  });

  it("API-05 re-checks current activation state and role instead of trusting stale session/browser role data", async () => {
    const agent = request.agent(app);
    const signedIn = await login(agent, users.active.email);
    expect(signedIn.status).toBe(200);

    await getPrisma().user.update({
      where: { email: users.active.email },
      data: { role: UserRole.IT_STAFF },
    });
    const roleRefresh = await agent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN);
    expect(roleRefresh.status).toBe(200);
    expect(roleRefresh.body.user.role).toBe("IT_STAFF");

    await getPrisma().user.update({
      where: { email: users.active.email },
      data: { isActive: false },
    });
    const deactivated = await agent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN);
    expect(deactivated.status).toBe(401);
    expect(deactivated.body.error?.code).toBe("AUTH_REQUIRED");
    expect(JSON.stringify(deactivated.body)).not.toContain(users.active.name);
  });

  it("API-06 blocks normal protected access while mustChangePassword is true", async () => {
    const agent = request.agent(app);
    const signedIn = await login(agent, users.change.email);
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.user.mustChangePassword).toBe(true);

    const blocked = await agent.get("/api/categories").set("Origin", FRONTEND_ORIGIN);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error?.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const changed = await agent
      .post("/api/auth/change-password")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", signedIn.body.csrfToken)
      .send({
        currentPassword: INITIAL_PASSWORD,
        newPassword: CHANGED_PASSWORD,
        confirmPassword: CHANGED_PASSWORD,
      });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);

    const allowed = await agent.get("/api/categories").set("Origin", FRONTEND_ORIGIN);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toHaveLength(4);
  });

  it("API-07 changes the password, clears the gate, rotates the current session/CSRF, and revokes other sessions", async () => {
    const firstAgent = request.agent(app);
    const secondAgent = request.agent(app);
    const firstLogin = await login(firstAgent, users.change.email);
    const secondLogin = await login(secondAgent, users.change.email);
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);

    const oldCookie = cookieFrom(firstLogin)!.split(";")[0];
    const changed = await firstAgent
      .post("/api/auth/change-password")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", firstLogin.body.csrfToken)
      .send({
        currentPassword: INITIAL_PASSWORD,
        newPassword: CHANGED_PASSWORD,
        confirmPassword: CHANGED_PASSWORD,
      });

    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(changed.body.csrfToken).toEqual(expect.any(String));
    expect(changed.body.csrfToken).not.toBe(firstLogin.body.csrfToken);
    expect(cookieFrom(changed)).toBeDefined();

    const oldSession = await request(app).get("/api/auth/me").set("Cookie", oldCookie).set("Origin", FRONTEND_ORIGIN);
    expect(oldSession.status).toBe(401);
    expect((await secondAgent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(401);
    expect((await firstAgent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(200);

    const updatedUser = await getPrisma().user.findUniqueOrThrow({ where: { email: users.change.email } });
    expect(updatedUser.mustChangePassword).toBe(false);
    expect(updatedUser.passwordHash).not.toBe(CHANGED_PASSWORD);
    expect(isVersionedScryptHash(updatedUser.passwordHash)).toBe(true);
    await expect(verifyPassword(CHANGED_PASSWORD, updatedUser.passwordHash)).resolves.toBe(true);

    const relogin = await login(request.agent(app), users.change.email, CHANGED_PASSWORD);
    expect(relogin.status).toBe(200);
    expect(relogin.body.user.mustChangePassword).toBe(false);
  });

  it("API-07 serializes concurrent password changes so only one request wins and its fresh session remains valid", async () => {
    await provisionAuthUser(users.change);
    const firstAgent = request.agent(app);
    const secondAgent = request.agent(app);
    const firstLogin = await login(firstAgent, users.change.email);
    const secondLogin = await login(secondAgent, users.change.email);
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);

    const firstOldCookie = cookieFrom(firstLogin)!.split(";")[0];
    const secondOldCookie = cookieFrom(secondLogin)!.split(";")[0];
    const firstNewPassword = "Concurrent-Winner-A-2026";
    const secondNewPassword = "Concurrent-Winner-B-2026";

    const attempts = [
      {
        agent: firstAgent,
        login: firstLogin,
        newPassword: firstNewPassword,
      },
      {
        agent: secondAgent,
        login: secondLogin,
        newPassword: secondNewPassword,
      },
    ];

    const responses = await Promise.all(
      attempts.map(({ agent, login: signedIn, newPassword }) =>
        agent
          .post("/api/auth/change-password")
          .set("Origin", FRONTEND_ORIGIN)
          .set("X-CSRF-Token", signedIn.body.csrfToken)
          .send({
            currentPassword: INITIAL_PASSWORD,
            newPassword,
            confirmPassword: newPassword,
          }),
      ),
    );

    const winners = responses
      .map((response, index) => ({ response, attempt: attempts[index] }))
      .filter(({ response }) => response.status === 200);
    const losers = responses
      .map((response, index) => ({ response, attempt: attempts[index] }))
      .filter(({ response }) => response.status !== 200);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].response.status).toBe(401);
    expect(losers[0].response.body.error?.code).toBe("INVALID_CURRENT_PASSWORD");

    const winner = winners[0];
    const loser = losers[0];
    const storedUser = await getPrisma().user.findUniqueOrThrow({ where: { email: users.change.email } });
    await expect(verifyPassword(winner.attempt.newPassword, storedUser.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword(loser.attempt.newPassword, storedUser.passwordHash)).resolves.toBe(false);

    const winnerSession = await winner.attempt.agent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN);
    expect(winnerSession.status).toBe(200);
    expect(winnerSession.body.user.email).toBe(users.change.email);

    const loserSession = await loser.attempt.agent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN);
    expect(loserSession.status).toBe(401);

    expect((await request(app).get("/api/auth/me").set("Cookie", firstOldCookie).set("Origin", FRONTEND_ORIGIN)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie", secondOldCookie).set("Origin", FRONTEND_ORIGIN)).status).toBe(401);
  });

  it("API-07 rejects an incorrect exact current password without changing credentials or the first-login gate", async () => {
    await provisionAuthUser(users.change);
    const agent = request.agent(app);
    const signedIn = await login(agent, users.change.email);
    expect(signedIn.status).toBe(200);

    const response = await agent
      .post("/api/auth/change-password")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", signedIn.body.csrfToken)
      .send({
        currentPassword: ` ${INITIAL_PASSWORD} `,
        newPassword: CHANGED_PASSWORD,
        confirmPassword: CHANGED_PASSWORD,
      });

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe("INVALID_CURRENT_PASSWORD");
    const unchanged = await getPrisma().user.findUniqueOrThrow({ where: { email: users.change.email } });
    expect(unchanged.mustChangePassword).toBe(true);
    await expect(verifyPassword(INITIAL_PASSWORD, unchanged.passwordHash)).resolves.toBe(true);
  });

  it.each([
    ["too short", "Short-123", "Short-123"],
    ["all whitespace", "            ", "            "],
    ["same as current", INITIAL_PASSWORD, INITIAL_PASSWORD],
    ["confirmation mismatch", CHANGED_PASSWORD, "Different-Lab3-Password-2026"],
  ])("API-07 rejects %s password-change input without changing credentials", async (_caseName, newPassword, confirmPassword) => {
    await provisionAuthUser(users.change);
    const agent = request.agent(app);
    const signedIn = await login(agent, users.change.email);
    expect(signedIn.status).toBe(200);
    const response = await agent
      .post("/api/auth/change-password")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", signedIn.body.csrfToken)
      .send({ currentPassword: INITIAL_PASSWORD, newPassword, confirmPassword });

    expect(response.status).toBe(400);
    const stillWorks = await login(request.agent(app), users.change.email, INITIAL_PASSWORD);
    expect(stillWorks.status).toBe(200);
  });

  it("API-08 revokes logout access, clears the cookie, and rejects expired sessions", async () => {
    const agent = request.agent(app);
    const signedIn = await login(agent, users.active.email);
    expect(signedIn.status).toBe(200);
    const logout = await agent
      .post("/api/auth/logout")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", signedIn.body.csrfToken);
    expect(logout.status).toBe(204);
    expect(cookieFrom(logout)).toMatch(/tt_session=;/);
    expect((await agent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(401);

    const expiringAgent = request.agent(app);
    const expiringLogin = await login(expiringAgent, users.active.email);
    expect(expiringLogin.status).toBe(200);
    const user = await getPrisma().user.findUniqueOrThrow({ where: { email: users.active.email } });
    await getPrisma().authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect((await expiringAgent.get("/api/auth/me").set("Origin", FRONTEND_ORIGIN)).status).toBe(401);
  });

  it("SEC-03 rejects missing/invalid CSRF and unapproved origins on state-changing authenticated requests", async () => {
    const agent = request.agent(app);
    const signedIn = await login(agent, users.active.email);
    expect(signedIn.status).toBe(200);

    const missingCsrf = await agent.post("/api/auth/logout").set("Origin", FRONTEND_ORIGIN);
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error?.code).toBe("CSRF_INVALID");

    const wrongCsrf = await agent
      .post("/api/auth/logout")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", "not-the-session-token");
    expect(wrongCsrf.status).toBe(403);

    const wrongOrigin = await agent
      .post("/api/auth/logout")
      .set("Origin", "https://evil.example.test")
      .set("X-CSRF-Token", signedIn.body.csrfToken);
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", signedIn.body.csrfToken);
    expect(missingOrigin.status).toBe(403);
    expect(missingOrigin.body.error?.code).toBe("ORIGIN_FORBIDDEN");

    const loginWrongOrigin = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://evil.example.test")
      .send({ email: users.active.email, password: INITIAL_PASSWORD });
    expect(loginWrongOrigin.status).toBe(403);
    expect(loginWrongOrigin.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
