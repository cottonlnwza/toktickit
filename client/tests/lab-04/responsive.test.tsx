import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

function res(status: number, body: unknown) { return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })); }
afterEach(() => { vi.restoreAllMocks(); window.location.hash = ""; });

describe("Lab 4 responsive component structure", () => {
  it("RESP-01 renders dashboard content in responsive grid/list containers without table-only dependence", async () => {
    window.location.hash = "#dashboard";
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return res(200, { user: { id: 71, name: "Staff", email: "staff@example.test", role: "IT_STAFF", mustChangePassword: false }, csrfToken: "csrf" });
      if (url.endsWith("/api/dashboards/staff")) return res(200, {
        generatedAt: "2026-10-05T12:00:00Z",
        metrics: { unassignedTickets: 1, myTickets: 1, myOpenActions: 1, byStatus: { NEW: 1, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 }, byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 1, URGENT: 0 } },
        recentUrgentTickets: [{ id: 4, ticketNumber: "TTK-4", summary: "Long responsive ticket summary that must wrap safely", itPriority: "HIGH", status: "NEW", owner: null, updatedAt: "2026-10-05T11:00:00Z", drillDown: "/staff/tickets/4" }],
        myRecentActions: [{ id: 8, ticketId: 4, ticketNumber: "TTK-4", actionDescription: "Long responsive Action description that must wrap safely", status: "PLANNED", assignee: { id: 71, name: "Staff" }, performedBy: null, updatedAt: "2026-10-05T11:30:00Z", drillDown: "/staff/tickets/4" }],
        drillDown: { unassignedTickets: "/staff/tickets?owner=unassigned", myTickets: "/staff/tickets?owner=71", myOpenActions: "/dashboard#my-actions" },
      });
      return res(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    render(<App />);
    const heading = await screen.findByRole("heading", { name: "IT Staff Dashboard" });
    expect(heading.closest("main")).toHaveClass("dashboard-page");
    expect(document.querySelector(".dashboard-metrics")).not.toBeNull();
    expect(document.querySelector(".dashboard-columns")).not.toBeNull();
    expect(document.querySelectorAll(".dashboard-row").length).toBeGreaterThan(0);
    expect(screen.getByText(/Long responsive Action description/)).toBeInTheDocument();
  });

  it("RESP-01 uses wrapping Action/card/form containers rather than fixed-width tables", async () => {
    window.location.hash = "#staff-ticket-901";
    const detail = { id: 901, ticketNumber: "TTK-901", summary: "Responsive Action", description: "Long detail", requester: { id: 1, name: "Requester", email: "r@example.test" }, category: { id: 1, name: "Hardware" }, relatedSystem: { id: 1, name: "Laptop" }, requestedPriority: "HIGH", itPriority: "HIGH", currentStatus: "OPEN", currentStatusLabel: "Open", owner: { id: 71, name: "Staff", role: "IT_STAFF" }, ownerOptions: [{ id: 71, name: "Staff", role: "IT_STAFF" }], problemAppearsResolvedAt: null, version: 1, workflowCycle: 1, createdAt: "2026-10-05T01:00:00Z", updatedAt: "2026-10-05T02:00:00Z", attachments: [], publicComments: [], internalNotes: [] };
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return res(200, { user: { id: 71, name: "Staff", email: "staff@example.test", role: "IT_STAFF", mustChangePassword: false }, csrfToken: "csrf" });
      if (url.endsWith("/api/staff/tickets/901")) return res(200, detail);
      if (url.endsWith("/api/tickets/901/actions")) return res(200, { items: [] });
      return res(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Actions Taken" });
    expect(document.querySelector(".actions-taken-section")).not.toBeNull();
    expect(document.querySelector(".action-form-grid")).not.toBeNull();
    expect(document.querySelector(".actions-heading")).not.toBeNull();
  });
});
