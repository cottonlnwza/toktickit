import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

import { app } from "../../src/app.js";

const mockGetPrisma = vi.mocked(getPrisma);

function ticketDetail() {
  return {
    id: 42,
    ticketNumber: "TTK-20260904-0042",
    summary: "Laptop battery drains quickly",
    description: "The battery drops during one class session.",
    requestedPriority: "MEDIUM",
    currentStatus: "NEW",
    createdAt: new Date("2026-09-04T08:00:00.000Z"),
    updatedAt: new Date("2026-09-04T09:00:00.000Z"),
    requester: { id: 7, name: "Anong Student", email: "anong@example.test" },
    category: { id: 1, name: "Hardware" },
    relatedSystem: { id: 2, name: "Corporate Laptop" },
    attachments: [
      {
        id: 9,
        originalFilename: "battery-report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        uploadedAt: new Date("2026-09-04T08:30:00.000Z"),
        removedAt: null,
        removalReason: null,
      },
    ],
  };
}

function prismaMock(result: ReturnType<typeof ticketDetail> | null | Error) {
  const findFirst = result instanceof Error
    ? vi.fn().mockRejectedValue(result)
    : vi.fn().mockResolvedValue(result);
  mockGetPrisma.mockReturnValue({
    ticket: { findFirst },
  } as unknown as ReturnType<typeof getPrisma>);
  return { findFirst };
}

describe("GET /api/requesters/:requesterId/tickets/:ticketId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockGetPrisma.mockReset();
  });

  it("returns the selected Requester's owned Ticket Detail with safe attachment metadata", async () => {
    const detail = ticketDetail();
    const { findFirst } = prismaMock(detail);

    const res = await request(app).get("/api/requesters/7/tickets/42");

    expect(res.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 42, requesterId: 7 },
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        description: true,
        requestedPriority: true,
        currentStatus: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
            removedAt: true,
            removalReason: true,
          },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });
    expect(res.body).toEqual({
      ...detail,
      currentStatusLabel: "New",
      createdAt: "2026-09-04T08:00:00.000Z",
      updatedAt: "2026-09-04T09:00:00.000Z",
      attachments: [{
        ...detail.attachments[0],
        uploadedAt: "2026-09-04T08:30:00.000Z",
        state: "active",
        downloadUrl: "/api/requesters/7/tickets/42/attachments/9/download",
      }],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/storagePath|storedFilename|removedByRequesterId|editPermissions|comments|statusActions/i);
  });

  it("rejects invalid Requester or Ticket IDs without querying the database", async () => {
    const invalidRequester = await request(app).get("/api/requesters/not-a-number/tickets/42");
    const invalidTicket = await request(app).get("/api/requesters/7/tickets/zero");

    expect(invalidRequester.status).toBe(400);
    expect(invalidRequester.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Requester ID must be a positive integer." },
    });
    expect(invalidTicket.status).toBe(400);
    expect(invalidTicket.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Ticket ID must be a positive integer." },
    });
    expect(mockGetPrisma).not.toHaveBeenCalled();
  });

  it("returns the same safe not-found response for missing and cross-requester Tickets", async () => {
    const { findFirst } = prismaMock(null);

    const res = await request(app).get("/api/requesters/8/tickets/42");

    expect(res.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42, requesterId: 8 },
    }));
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Ticket was not found." },
    });
  });

  it("returns a safe error when Ticket Detail retrieval fails unexpectedly", async () => {
    prismaMock(new Error("SQL failed at /secret/path with DATABASE_URL"));

    const res = await request(app).get("/api/requesters/7/tickets/42");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "TICKET_DETAIL_ERROR", message: "Unable to load Ticket Detail." },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SQL|stack|DATABASE_URL|secret|\/secret\/path|Prisma/i);
  });
});
