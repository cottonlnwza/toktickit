import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(() => {
    throw new Error("Retired Development Requester endpoint must not query user data.");
  }),
}));

vi.mock("../../src/auth/session.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/auth/session.js")>("../../src/auth/session.js");
  return { ...actual, requireNormalAccess: (_req: unknown, _res: unknown, next: () => void) => next() };
});

import { app } from "../../src/app.js";

describe("GET /api/requesters retirement under Lab 3 authenticated identity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a safe not-found response instead of exposing the Development Requester selector data source", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "This endpoint is not available in the authenticated Requester workflow.",
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/email|requesterId|passwordHash|tokenHash|DATABASE_URL/i);
  });

  it("does not consult requester/user storage for the retired selector endpoint", async () => {
    const res = await request(app).get("/api/requesters");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/SQL|stack|secret|Prisma/i);
  });
});
