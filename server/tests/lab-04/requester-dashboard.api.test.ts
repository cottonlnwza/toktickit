import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupIssue36Fixtures, createIssue36Ticket, fixtureUsers, loginIssue36, provisionIssue36User } from "../lab-03/requester-test-helpers.js";

beforeEach(async () => {
  await cleanupIssue36Fixtures();
  await provisionIssue36User(fixtureUsers.requesterA);
  await provisionIssue36User(fixtureUsers.requesterB);
  await provisionIssue36User(fixtureUsers.staff);
});

afterAll(async () => {
  await cleanupIssue36Fixtures();
  await getPrisma().$disconnect();
});

afterEach(() => vi.useRealTimers());

describe("Lab 4 Requester dashboard", () => {
  it("API-19 returns only authenticated Requester metrics with explicit zero-safe recent sections", async () => {
    const prisma = getPrisma();
    const requesterA = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const requesterB = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterB.email } });
    const open = await createIssue36Ticket(requesterA.id, { summary: "Owned open", status: "OPEN", clientRequestId: randomUUID() });
    await createIssue36Ticket(requesterA.id, { summary: "Owned waiting", status: "WAITING_FOR_REQUESTER", clientRequestId: randomUUID() });
    await createIssue36Ticket(requesterB.id, { summary: "Other requester", status: "OPEN", clientRequestId: randomUUID() });
    await prisma.ticket.update({ where: { id: open.id }, data: { updatedAt: new Date() } });

    const { agent } = await loginIssue36(fixtureUsers.requesterA);
    const response = await agent.get("/api/dashboards/requester");

    expect(response.status).toBe(200);
    expect(response.body.metrics).toEqual({ openTickets: 2, waitingForRequester: 1 });
    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(response.body.recentlyUpdated.map((item: { summary: string }) => item.summary)).not.toContain("Other requester");
    expect(response.body.recentlyResolved).toEqual([]);
    expect(response.body.drillDown).toMatchObject({ openTickets: "/tickets?scope=open", waitingForRequester: "/tickets?currentStatus=WAITING_FOR_REQUESTER" });
  });

  it("API-19A uses inclusive 7-day and 30-day windows and excludes future rows", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);
    const fixedNow = new Date("2026-10-05T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const recent = await createIssue36Ticket(requester.id, { summary: "Recent boundary", status: "OPEN" });
    const resolved = await createIssue36Ticket(requester.id, { summary: "Resolved boundary", status: "RESOLVED" });
    const future = await createIssue36Ticket(requester.id, { summary: "Future row", status: "OPEN" });
    await prisma.ticket.update({ where: { id: recent.id }, data: { updatedAt: new Date(fixedNow.getTime() - 7 * 24 * 60 * 60 * 1000) } });
    await prisma.ticket.update({ where: { id: resolved.id }, data: { resolvedAt: new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000), updatedAt: new Date(fixedNow.getTime() - 31 * 24 * 60 * 60 * 1000) } });
    await prisma.ticket.update({ where: { id: future.id }, data: { updatedAt: new Date(fixedNow.getTime() + 1) } });

    const response = await agent.get("/api/dashboards/requester");
    expect(response.status).toBe(200);
    expect(response.body.generatedAt).toBe(fixedNow.toISOString());
    expect(response.body.recentlyUpdated.map((item: { id: number }) => item.id)).toContain(recent.id);
    expect(response.body.recentlyUpdated.map((item: { id: number }) => item.id)).not.toContain(future.id);
    expect(response.body.recentlyResolved.map((item: { id: number }) => item.id)).toContain(resolved.id);
  });

  it("API-19 rejects non-Requester roles", async () => {
    const { agent } = await loginIssue36(fixtureUsers.staff);
    const response = await agent.get("/api/dashboards/requester");
    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN");
  });

  it("API-22 applies the Requester open-ticket drill-down scope to active statuses", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const open = await createIssue36Ticket(requester.id, { summary: "Open scoped", status: "OPEN" });
    const reopened = await createIssue36Ticket(requester.id, { summary: "Reopened scoped", status: "REOPENED" });
    await createIssue36Ticket(requester.id, { summary: "Resolved excluded", status: "RESOLVED" });
    await createIssue36Ticket(requester.id, { summary: "Cancelled excluded", status: "CANCELLED" });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent.get("/api/tickets/mine?scope=open&pageSize=20");
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: number }) => item.id)).toEqual(expect.arrayContaining([open.id, reopened.id]));
    expect(response.body.items.every((item: { currentStatus: string }) => ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(item.currentStatus))).toBe(true);
  });
});
