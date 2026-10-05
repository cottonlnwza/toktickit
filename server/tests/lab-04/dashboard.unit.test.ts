import { describe, expect, it } from "vitest";
import { activeDashboardTicketStatuses, dashboardPriorityKeys, dashboardTicketStatusKeys, dashboardWindowSnapshot, inInclusiveDashboardWindow } from "../../src/dashboard-operations.js";

describe("Lab 4 dashboard calculation helpers", () => {
  it("UNIT-04 defines active statuses, explicit enum keys, and inclusive 7/30-day UTC windows", () => {
    const generatedAt = new Date("2026-10-05T12:00:00.000Z");
    const snapshot = dashboardWindowSnapshot(generatedAt);
    expect(activeDashboardTicketStatuses).toEqual(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]);
    expect(dashboardTicketStatusKeys).toHaveLength(8);
    expect(dashboardPriorityKeys).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
    expect(snapshot.updatedCutoff.toISOString()).toBe("2026-09-28T12:00:00.000Z");
    expect(snapshot.resolvedCutoff.toISOString()).toBe("2026-09-05T12:00:00.000Z");
    expect(inInclusiveDashboardWindow(snapshot.updatedCutoff, snapshot.updatedCutoff, generatedAt)).toBe(true);
    expect(inInclusiveDashboardWindow(generatedAt, snapshot.updatedCutoff, generatedAt)).toBe(true);
    expect(inInclusiveDashboardWindow(new Date(generatedAt.getTime() + 1), snapshot.updatedCutoff, generatedAt)).toBe(false);
  });
});
