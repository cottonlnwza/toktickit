import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

import { app } from "../../src/app.js";

const mockGetPrisma = vi.mocked(getPrisma);

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: "TTK-20260904-0001",
    summary: "Laptop battery drains quickly",
    category: { id: 1, name: "Hardware" },
    relatedSystem: { id: 2, name: "Corporate Laptop" },
    requestedPriority: "MEDIUM",
    currentStatus: "NEW",
    updatedAt: new Date("2026-09-04T08:00:00.000Z"),
    ...overrides,
  };
}

function prismaMock(options: {
  requester?: { id: number } | null;
  count?: number;
  countError?: Error;
  tickets?: ReturnType<typeof ticket>[];
} = {}) {
  const findFirst = vi.fn().mockResolvedValue(options.requester === undefined ? { id: 7 } : options.requester);
  const count = options.countError
    ? vi.fn().mockRejectedValueOnce(options.countError)
    : vi.fn().mockResolvedValue(options.count ?? 0);
  const findMany = vi.fn().mockResolvedValue(options.tickets ?? []);
  mockGetPrisma.mockReturnValue({
    requesterUser: { findFirst },
    ticket: { count, findMany },
  } as unknown as ReturnType<typeof getPrisma>);
  return { findFirst, count, findMany };
}

describe("GET /api/requesters/:requesterId/tickets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockGetPrisma.mockReset();
  });

  it("returns only the selected Requester's Tickets with pagination metadata", async () => {
    const row = ticket();
    const { findFirst, count, findMany } = prismaMock({ count: 6, tickets: [row] });

    const res = await request(app).get("/api/requesters/7/tickets?page=2&pageSize=5");

    expect(res.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 7, isActive: true }, select: { id: true } });
    expect(count).toHaveBeenCalledWith({ where: { requesterId: 7 } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requesterId: 7 },
      skip: 5,
      take: 5,
    }));
    expect(res.body).toMatchObject({ page: 2, pageSize: 5, totalItems: 6, totalPages: 2 });
    expect(res.body.items).toEqual([{
      ...row,
      updatedAt: "2026-09-04T08:00:00.000Z",
      currentStatusLabel: "New",
    }]);
  });

  it("combines ownership with search and all supported filters before query execution", async () => {
    const { count, findMany } = prismaMock({ count: 1, tickets: [ticket({ requestedPriority: "HIGH" })] });
    const query = new URLSearchParams({
      search: "laptop",
      categoryId: "1",
      relatedSystemId: "2",
      requestedPriority: "HIGH",
      currentStatus: "NEW",
    });

    const res = await request(app).get(`/api/requesters/7/tickets?${query}`);

    expect(res.status).toBe(200);
    const expectedWhere = expect.objectContaining({
      requesterId: 7,
      categoryId: 1,
      relatedSystemId: 2,
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      OR: expect.arrayContaining([
        { ticketNumber: { contains: "laptop", mode: "insensitive" } },
        { summary: { contains: "laptop", mode: "insensitive" } },
        { category: { name: { contains: "laptop", mode: "insensitive" } } },
        { relatedSystem: { name: { contains: "laptop", mode: "insensitive" } } },
      ]),
    });
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
  });

  it("sorts Requested Priority by business order in both directions", async () => {
    const rows = [
      ticket({ id: 1, ticketNumber: "TTK-4", requestedPriority: "URGENT" }),
      ticket({ id: 2, ticketNumber: "TTK-1", requestedPriority: "LOW" }),
      ticket({ id: 3, ticketNumber: "TTK-3", requestedPriority: "HIGH" }),
      ticket({ id: 4, ticketNumber: "TTK-2", requestedPriority: "MEDIUM" }),
    ];
    prismaMock({ count: 4, tickets: rows });

    const ascending = await request(app).get(
      "/api/requesters/7/tickets?sortBy=requestedPriority&sortDirection=asc&pageSize=10",
    );
    const descending = await request(app).get(
      "/api/requesters/7/tickets?sortBy=requestedPriority&sortDirection=desc&pageSize=10",
    );

    expect(ascending.status).toBe(200);
    expect(ascending.body.items.map((item: { requestedPriority: string }) => item.requestedPriority)).toEqual([
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ]);
    expect(descending.body.items.map((item: { requestedPriority: string }) => item.requestedPriority)).toEqual([
      "URGENT",
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
  });

  it("returns an empty result for both empty-list and no-results queries", async () => {
    const { count, findMany } = prismaMock({ count: 0, tickets: [] });

    const empty = await request(app).get("/api/requesters/7/tickets");
    const noResults = await request(app).get("/api/requesters/7/tickets?search=no-match");

    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
    expect(noResults.status).toBe(200);
    expect(noResults.body).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
    expect(count).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid requester and query parameters with safe errors", async () => {
    const invalidRequester = await request(app).get("/api/requesters/not-a-number/tickets");
    const invalidQuery = await request(app).get(
      "/api/requesters/1/tickets?page=0&pageSize=7&sortBy=unknown&requestedPriority=CRITICAL",
    );

    expect(invalidRequester.status).toBe(400);
    expect(invalidRequester.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Requester ID must be a positive integer." },
    });
    expect(invalidQuery.status).toBe(400);
    expect(invalidQuery.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Please correct the invalid query parameters.",
      fields: expect.objectContaining({ page: expect.any(String), pageSize: expect.any(String), sortBy: expect.any(String) }),
    });
    expect(mockGetPrisma).not.toHaveBeenCalled();
    expect(JSON.stringify(invalidQuery.body)).not.toMatch(/SQL|stack|DATABASE_URL|\/Users|Prisma/i);
  });

  it("returns a safe not-found response for a missing or inactive Requester", async () => {
    prismaMock({ requester: null });

    const res = await request(app).get("/api/requesters/2147483647/tickets");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Requester was not found." } });
  });

  it("returns a safe error when the Ticket query fails unexpectedly", async () => {
    prismaMock({ countError: new Error("SQL failed at /secret/path with DATABASE_URL") });

    const res = await request(app).get("/api/requesters/7/tickets");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "MY_TICKETS_ERROR", message: "Unable to load Tickets." } });
    expect(JSON.stringify(res.body)).not.toMatch(/SQL|stack|DATABASE_URL|secret|\/secret\/path|Prisma/i);
  });
});
