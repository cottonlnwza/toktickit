import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const mockGetPrisma = vi.mocked(getPrisma);

describe("GET /api/requesters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns active Development Requesters only", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 1, name: "Anong Student", email: "anong.student@example.test" },
      { id: 2, name: "Burin Lecturer", email: "burin.lecturer@example.test" },
      { id: 3, name: "Chalida Staff", email: "chalida.staff@example.test" },
      { id: 4, name: "Darin Researcher", email: "darin.researcher@example.test" },
    ]);
    mockGetPrisma.mockReturnValue({ requesterUser: { findMany } } as unknown as ReturnType<typeof getPrisma>);

    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });
    expect(res.body).toEqual(
      [
        { id: 1, name: "Anong Student", email: "anong.student@example.test" },
        { id: 2, name: "Burin Lecturer", email: "burin.lecturer@example.test" },
        { id: 3, name: "Chalida Staff", email: "chalida.staff@example.test" },
        { id: 4, name: "Darin Researcher", email: "darin.researcher@example.test" },
      ],
    );
  });

  it("returns a safe 500 response when requester lookup fails", async () => {
    const findMany = vi.fn().mockRejectedValue(new Error("SQL failed at /secret/path with DATABASE_URL"));
    mockGetPrisma.mockReturnValue({ requesterUser: { findMany } } as unknown as ReturnType<typeof getPrisma>);

    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Unable to load Development Requesters." });
    expect(JSON.stringify(res.body)).not.toMatch(/SQL|stack|DATABASE_URL|secret|\/secret\/path/i);
  });
});
