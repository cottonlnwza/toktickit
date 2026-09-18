import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TicketStatus, type RequestedPriority } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import {
  FRONTEND_ORIGIN,
  cleanupIssue36Fixtures,
  fixtureUsers,
  loginIssue36,
  provisionIssue36User,
} from "./requester-test-helpers.js";

type QueueFixtureInput = {
  requesterId: number;
  summary: string;
  status: TicketStatus;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  ownerId?: number | null;
  categoryId: number;
  relatedSystemId: number;
  createdAt: Date;
  updatedAt: Date;
};

async function createQueueTicket(input: QueueFixtureInput) {
  const token = randomUUID();
  return getPrisma().ticket.create({
    data: {
      ticketNumber: `I37-${token}`,
      clientRequestId: randomUUID(),
      requesterId: input.requesterId,
      categoryId: input.categoryId,
      relatedSystemId: input.relatedSystemId,
      summary: input.summary,
      description: `Issue 37 queue fixture for ${input.summary}.`,
      requestedPriority: input.requestedPriority,
      itPriority: input.itPriority,
      currentStatus: input.status,
      ownerId: input.ownerId ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    },
  });
}

async function seedQueueFixtures() {
  const prisma = getPrisma();
  const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
  const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
  const staff = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.staff.email } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.admin.email } });
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, take: 2 });
  const systems = await prisma.relatedSystem.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, take: 2 });
  if (categories.length < 2 || systems.length < 2) throw new Error("Issue 37 tests require two active Categories and Related Systems.");

  const older = await createQueueTicket({
    requesterId: requesterB.id,
    summary: "Printer toner replacement beta",
    status: TicketStatus.WAITING_FOR_REQUESTER,
    requestedPriority: "LOW",
    itPriority: "MEDIUM",
    ownerId: null,
    categoryId: categories[1].id,
    relatedSystemId: systems[1].id,
    createdAt: new Date("2099-09-10T08:00:00.000Z"),
    updatedAt: new Date("2099-09-10T09:00:00.000Z"),
  });
  const newest = await createQueueTicket({
    requesterId: requesterA.id,
    summary: "VPN outage alpha",
    status: TicketStatus.OPEN,
    requestedPriority: "HIGH",
    itPriority: "URGENT",
    ownerId: staff.id,
    categoryId: categories[0].id,
    relatedSystemId: systems[0].id,
    createdAt: new Date("2099-09-12T08:00:00.000Z"),
    updatedAt: new Date("2099-09-18T09:30:00.000Z"),
  });
  const middle = await createQueueTicket({
    requesterId: requesterA.id,
    summary: "Email sync gamma",
    status: TicketStatus.RESOLVED,
    requestedPriority: "MEDIUM",
    itPriority: "LOW",
    ownerId: admin.id,
    categoryId: categories[1].id,
    relatedSystemId: systems[0].id,
    createdAt: new Date("2099-09-11T08:00:00.000Z"),
    updatedAt: new Date("2099-09-15T12:00:00.000Z"),
  });

  return { requesterA, requesterB, staff, admin, categories, systems, newest, middle, older };
}

describe("Lab 3 Issue 5 IT Staff Ticket Queue API", () => {
  beforeEach(async () => {
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
    await provisionIssue36User(fixtureUsers.requesterB);
    await provisionIssue36User(fixtureUsers.staff);
    const inactiveStaff = await provisionIssue36User(fixtureUsers.inactiveStaff);
    await getPrisma().user.update({ where: { id: inactiveStaff.id }, data: { isActive: false } });
    await provisionIssue36User(fixtureUsers.admin);
  });

  afterAll(async () => {
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("API-15 returns the shared Queue in default updatedAt desc order with safe pagination and assigned/unassigned ownership", async () => {
    const fixture = await seedQueueFixtures();
    const { agent, response: login } = await loginIssue36(fixtureUsers.staff);
    expect(login.status).toBe(200);

    const response = await agent.get("/api/staff/tickets").set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
    expect(response.body.pageSize).toBe(10);
    expect(response.body.totalItems).toBeGreaterThanOrEqual(3);
    expect(response.body.totalPages).toBe(Math.ceil(response.body.totalItems / 10));
    expect(response.body.items.slice(0, 3).map((item: { id: number }) => item.id)).toEqual([
      fixture.newest.id,
      fixture.middle.id,
      fixture.older.id,
    ]);
    expect(response.body.items[0]).toMatchObject({
      id: fixture.newest.id,
      ticketNumber: fixture.newest.ticketNumber,
      summary: "VPN outage alpha",
      requester: { id: fixture.requesterA.id, name: fixture.requesterA.name, email: fixture.requesterA.email },
      requestedPriority: "HIGH",
      itPriority: "URGENT",
      currentStatus: "OPEN",
      owner: { id: fixture.staff.id, name: fixture.staff.name },
    });
    expect(response.body.items[2]).toMatchObject({ id: fixture.older.id, owner: null });
    expect(response.body.ownerOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.staff.id, name: fixture.staff.name, role: "IT_STAFF" }),
      expect.objectContaining({ id: fixture.admin.id, name: fixture.admin.name, role: "ADMINISTRATOR" }),
    ]));
    expect(response.body.ownerOptions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: fixtureUsers.inactiveStaff.name }),
    ]));
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|storagePath/i);
  });

  it.each([
    ["Ticket Number", (fixture: Awaited<ReturnType<typeof seedQueueFixtures>>) => fixture.newest.ticketNumber.slice(4, 14)],
    ["Summary", () => "VPN outage"],
    ["Requester Name", () => "Issue 36 Requester A"],
    ["Requester Email", () => "issue36.requester.a@example.test"],
  ])("API-15 searches %s using the documented shared search field", async (_label, searchValue) => {
    const fixture = await seedQueueFixtures();
    const { agent } = await loginIssue36(fixtureUsers.staff);

    const response = await agent
      .get("/api/staff/tickets")
      .query({ search: searchValue(fixture) })
      .set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: number }) => item.id)).toContain(fixture.newest.id);
    expect(response.body.items.map((item: { id: number }) => item.id)).not.toContain(fixture.older.id);
    expect(response.body.ownerOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.admin.id, name: fixture.admin.name, role: "ADMINISTRATOR" }),
    ]));
  });

  it("API-15 applies status, Requested Priority, IT Priority, owner, Category, and Related System filters together", async () => {
    const fixture = await seedQueueFixtures();
    const { agent } = await loginIssue36(fixtureUsers.staff);

    const response = await agent
      .get("/api/staff/tickets")
      .query({
        status: "OPEN",
        requestedPriority: "HIGH",
        itPriority: "URGENT",
        owner: String(fixture.staff.id),
        categoryId: String(fixture.categories[0].id),
        relatedSystemId: String(fixture.systems[0].id),
      })
      .set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(fixture.newest.id);
  });

  it("API-15 supports the explicit unassigned owner filter", async () => {
    const fixture = await seedQueueFixtures();
    const { agent } = await loginIssue36(fixtureUsers.staff);

    const response = await agent
      .get("/api/staff/tickets")
      .query({ owner: "unassigned", search: "Printer toner replacement beta" })
      .set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([expect.objectContaining({ id: fixture.older.id, owner: null })]);
  });

  it("API-15 applies documented sort and deterministic pagination metadata", async () => {
    const fixture = await seedQueueFixtures();
    const prisma = getPrisma();
    for (let index = 0; index < 11; index += 1) {
      await createQueueTicket({
        requesterId: fixture.requesterA.id,
        summary: `Issue37 pagination ${String(index).padStart(2, "0")}`,
        status: TicketStatus.OPEN,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        ownerId: fixture.staff.id,
        categoryId: fixture.categories[0].id,
        relatedSystemId: fixture.systems[0].id,
        createdAt: new Date(Date.UTC(2099, 9, 1, 0, index, 0)),
        updatedAt: new Date(Date.UTC(2099, 9, 1, 1, index, 0)),
      });
    }
    const { agent } = await loginIssue36(fixtureUsers.staff);

    const response = await agent
      .get("/api/staff/tickets")
      .query({ search: "Issue37 pagination", sortBy: "createdAt", sortOrder: "asc", page: 2, pageSize: 10 })
      .set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 2, pageSize: 10, totalItems: 11, totalPages: 2 });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].summary).toBe("Issue37 pagination 10");
    expect(fixture.older.createdAt.getTime()).toBeLessThan(fixture.middle.createdAt.getTime());
    expect(await prisma.ticket.count({ where: { requesterId: fixture.requesterA.id, summary: { contains: "Issue37 pagination" } } })).toBe(11);
  });

  it.each([
    ["unknown query", "mystery=value"],
    ["search too long", `search=${"x".repeat(101)}`],
    ["bad status", "status=PENDING"],
    ["bad requested priority", "requestedPriority=CRITICAL"],
    ["bad IT priority", "itPriority=CRITICAL"],
    ["bad owner", "owner=abc"],
    ["bad category", "categoryId=0"],
    ["bad related system", "relatedSystemId=-1"],
    ["bad sort field", "sortBy=requester"],
    ["bad sort order", "sortOrder=sideways"],
    ["bad page", "page=0"],
    ["bad page size", "pageSize=20"],
  ])("API-16 rejects %s with 400 INVALID_QUERY", async (_label, query) => {
    await seedQueueFixtures();
    const { agent } = await loginIssue36(fixtureUsers.staff);

    const response = await agent.get(`/api/staff/tickets?${query}`).set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_QUERY");
    expect(response.body).not.toHaveProperty("items");
  });

  it.each([fixtureUsers.requesterA, fixtureUsers.admin])("API-17 denies $role from the normal Staff Queue", async (fixture) => {
    await seedQueueFixtures();
    const { agent, response: login } = await loginIssue36(fixture);
    expect(login.status).toBe(200);

    const response = await agent.get("/api/staff/tickets").set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN");
    expect(response.body).not.toHaveProperty("items");
  });

  it("API-17 requires authentication before exposing Queue data", async () => {
    await seedQueueFixtures();
    const { app } = await import("../../src/app.js");
    const request = (await import("supertest")).default;

    const response = await request(app).get("/api/staff/tickets").set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe("AUTH_REQUIRED");
    expect(response.body).not.toHaveProperty("items");
  });
});
