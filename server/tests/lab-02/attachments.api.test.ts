import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));
vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

import { app } from "../../src/app.js";

const mockGetPrisma = vi.mocked(getPrisma);
const mockMkdir = vi.mocked(mkdir);
const mockReadFile = vi.mocked(readFile);
const mockUnlink = vi.mocked(unlink);
const mockWriteFile = vi.mocked(writeFile);

const activeAttachment = {
  id: 9,
  ticketId: 42,
  originalFilename: "evidence.pdf",
  storedFilename: "123e4567-e89b-12d3-a456-426614174000.pdf",
  mimeType: "application/pdf",
  sizeBytes: 12,
  storagePath: "/server/uploads/lab-02/123e4567-e89b-12d3-a456-426614174000.pdf",
  uploadedAt: new Date("2026-09-04T08:30:00.000Z"),
  removedAt: null,
  removedByRequesterId: null,
  removalReason: null,
};

function prismaMock(overrides: Record<string, unknown> = {}) {
  const ticketFindFirst = vi.fn().mockResolvedValue({ id: 42 });
  const attachmentFindMany = vi.fn().mockResolvedValue([activeAttachment]);
  const attachmentFindFirst = vi.fn().mockResolvedValue(activeAttachment);
  const attachmentCount = vi.fn().mockResolvedValue(0);
  const attachmentCreate = vi.fn().mockResolvedValue(activeAttachment);
  const attachmentUpdate = vi.fn().mockResolvedValue({
    ...activeAttachment,
    removedAt: new Date("2026-09-04T10:00:00.000Z"),
    removedByRequesterId: 7,
    removalReason: "Uploaded the wrong file",
  });

  mockGetPrisma.mockReturnValue({
    ticket: { findFirst: ticketFindFirst },
    attachment: {
      findMany: attachmentFindMany,
      findFirst: attachmentFindFirst,
      count: attachmentCount,
      create: attachmentCreate,
      update: attachmentUpdate,
    },
    ...overrides,
  } as unknown as ReturnType<typeof getPrisma>);

  return {
    ticketFindFirst,
    attachmentFindMany,
    attachmentFindFirst,
    attachmentCount,
    attachmentCreate,
    attachmentUpdate,
  };
}

describe("Requester Attachment lifecycle API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockGetPrisma.mockReset();
    mockMkdir.mockReset();
    mockReadFile.mockReset();
    mockUnlink.mockReset();
    mockWriteFile.mockReset();
  });

  it("lists active and removed metadata for an owned Ticket without exposing storage paths", async () => {
    const removed = {
      ...activeAttachment,
      id: 10,
      removedAt: new Date("2026-09-04T09:00:00.000Z"),
      removedByRequesterId: 7,
      removalReason: "Duplicate evidence",
    };
    const mocks = prismaMock();
    mocks.attachmentFindMany.mockResolvedValue([activeAttachment, removed]);

    const res = await request(app).get("/api/requesters/7/tickets/42/attachments");

    expect(res.status).toBe(200);
    expect(mocks.ticketFindFirst).toHaveBeenCalledWith({ where: { id: 42, requesterId: 7 }, select: { id: true } });
    expect(res.body).toEqual([
      expect.objectContaining({ id: 9, state: "active", downloadUrl: "/api/requesters/7/tickets/42/attachments/9/download" }),
      expect.objectContaining({ id: 10, state: "removed", removalReason: "Duplicate evidence" }),
    ]);
    expect(res.body[1]).not.toHaveProperty("downloadUrl");
    expect(JSON.stringify(res.body)).not.toMatch(/storagePath|storedFilename/);
  });

  it("uploads one valid file to an existing owned Ticket", async () => {
    const mocks = prismaMock();

    const res = await request(app)
      .post("/api/requesters/7/tickets/42/attachments")
      .attach("file", Buffer.from("pdf content"), { filename: "evidence.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(mocks.ticketFindFirst).toHaveBeenCalledWith({ where: { id: 42, requesterId: 7 } });
    expect(mockWriteFile).toHaveBeenCalledOnce();
    expect(mocks.attachmentCreate).toHaveBeenCalledOnce();
    expect(JSON.stringify(res.body)).not.toMatch(/storagePath/);
  });

  it("downloads an active owned Attachment without exposing its storage path", async () => {
    const mocks = prismaMock();
    mockReadFile.mockResolvedValue(Buffer.from("downloaded evidence"));

    const res = await request(app).get("/api/requesters/7/tickets/42/attachments/9/download");

    expect(res.status).toBe(200);
    expect(mocks.attachmentFindFirst).toHaveBeenCalledWith({
      where: { id: 9, ticketId: 42, ticket: { requesterId: 7 }, removedAt: null },
    });
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("evidence.pdf");
    expect(Buffer.from(res.body).toString()).toBe("downloaded evidence");
    expect(JSON.stringify(res.headers)).not.toMatch(/storagePath|uploads\/lab-02/);
  });

  it("returns the same safe response for cross-requester, missing, and removed downloads", async () => {
    const mocks = prismaMock();
    mocks.attachmentFindFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/requesters/8/tickets/42/attachments/9/download");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Attachment was not found." } });
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("soft-removes an active owned Attachment with a trimmed reason and retains metadata", async () => {
    const mocks = prismaMock();

    const res = await request(app)
      .delete("/api/requesters/7/tickets/42/attachments/9")
      .send({ reason: "  Uploaded the wrong file  " });

    expect(res.status).toBe(200);
    expect(mocks.attachmentUpdate).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        removedAt: expect.any(Date),
        removedByRequesterId: 7,
        removalReason: "Uploaded the wrong file",
      },
    });
    expect(res.body).toMatchObject({
      id: 9,
      state: "removed",
      removalReason: "Uploaded the wrong file",
    });
    expect(res.body).not.toHaveProperty("downloadUrl");
    expect(JSON.stringify(res.body)).not.toMatch(/storagePath|storedFilename/);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("rejects a blank removal reason without changing the Attachment", async () => {
    const mocks = prismaMock();

    const res = await request(app)
      .delete("/api/requesters/7/tickets/42/attachments/9")
      .send({ reason: "   " });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Removal reason is required.",
        fields: { reason: "Removal reason is required." },
      },
    });
    expect(mocks.attachmentUpdate).not.toHaveBeenCalled();
  });

  it("returns a safe conflict when an Attachment has already been removed", async () => {
    const mocks = prismaMock();
    mocks.attachmentFindFirst.mockResolvedValue({ ...activeAttachment, removedAt: new Date() });

    const res = await request(app)
      .delete("/api/requesters/7/tickets/42/attachments/9")
      .send({ reason: "Remove again" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "ATTACHMENT_REMOVED", message: "Attachment has already been removed." } });
    expect(mocks.attachmentUpdate).not.toHaveBeenCalled();
  });

  it("validates route IDs and returns safe unexpected errors", async () => {
    const invalid = await request(app).get("/api/requesters/7/tickets/nope/attachments");
    expect(invalid.status).toBe(400);
    expect(mockGetPrisma).not.toHaveBeenCalled();

    const mocks = prismaMock();
    mocks.ticketFindFirst.mockRejectedValue(new Error("SQL /secret/path DATABASE_URL"));
    const failed = await request(app).get("/api/requesters/7/tickets/42/attachments");

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ error: { code: "ATTACHMENTS_ERROR", message: "Unable to load Attachments." } });
    expect(JSON.stringify(failed.body)).not.toMatch(/SQL|stack|DATABASE_URL|secret|\/secret\/path|Prisma/i);
  });
});
