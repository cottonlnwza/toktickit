import { afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { getPrisma } from "../../src/prisma.js";

const FRONTEND_ORIGIN = "http://localhost:5173";
const TEST_EMAIL = "lab1.categories@example.test";
const TEST_PASSWORD = "Lab3-Categories-Test-2026";

// Issue 4 — write this test yourself, using health.test.ts as the pattern.
// Requires the DB to be migrated and seeded first.
// It should assert: GET /api/categories returns 200 and the four seeded
// category names in id order.
describe("GET /api/categories", () => {
  afterAll(async () => {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } });
    if (user) {
      await prisma.authSession.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  it("returns the four seeded categories in id order", async () => {
    const prisma = getPrisma();
    await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: {
        name: "Lab 1 Categories Test",
        role: "REQUESTER",
        isActive: true,
        passwordHash: await hashPassword(TEST_PASSWORD),
        mustChangePassword: false,
      },
      create: {
        name: "Lab 1 Categories Test",
        email: TEST_EMAIL,
        role: "REQUESTER",
        isActive: true,
        passwordHash: await hashPassword(TEST_PASSWORD),
        mustChangePassword: false,
      },
    });

    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .set("Origin", FRONTEND_ORIGIN)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(login.status).toBe(200);

    const res = await agent.get("/api/categories").set("Origin", FRONTEND_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((category: { name: string }) => category.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number), name: "Account and Access" }),
        expect.objectContaining({ id: expect.any(Number), name: "Hardware" }),
        expect.objectContaining({ id: expect.any(Number), name: "Software" }),
        expect.objectContaining({ id: expect.any(Number), name: "Network" }),
      ]),
    );
  });
});
