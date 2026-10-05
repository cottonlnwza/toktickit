import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("Lab 4 Staff Dashboard", () => {
  it("UI-03 renders operational metrics, status summary, urgent Tickets and current-user Actions", async () => {
    window.location.hash = "#dashboard";
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: { id: 71, name: "Staff", email: "staff@example.test", role: "IT_STAFF", mustChangePassword: false }, csrfToken: "csrf" });
      if (url.endsWith("/api/dashboards/staff")) return jsonResponse(200, {
        generatedAt: "2026-10-05T12:00:00.000Z",
        metrics: {
          unassignedTickets: 2,
          myTickets: 4,
          myOpenActions: 3,
          byStatus: { NEW: 1, OPEN: 2, IN_PROGRESS: 3, WAITING_FOR_REQUESTER: 0, RESOLVED: 1, CLOSED: 0, REOPENED: 0, CANCELLED: 0 },
          byItPriority: { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 1 },
        },
        recentUrgentTickets: [{ id: 42, ticketNumber: "TTK-42", summary: "Urgent VPN", itPriority: "URGENT", status: "IN_PROGRESS", owner: { id: 71, name: "Staff" }, updatedAt: "2026-10-05T11:00:00.000Z", drillDown: "/staff/tickets/42" }],
        myRecentActions: [{ id: 9, ticketId: 42, ticketNumber: "TTK-42", actionDescription: "Reset VPN profile", status: "IN_PROGRESS", assignee: { id: 71, name: "Staff" }, performedBy: null, updatedAt: "2026-10-05T11:30:00.000Z", drillDown: "/staff/tickets/42" }],
        drillDown: { unassignedTickets: "/staff/tickets?owner=unassigned", myTickets: "/staff/tickets?owner=71", myOpenActions: "/dashboard#my-actions" },
      });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "IT Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByLabelText("Unassigned Tickets 2")).toBeInTheDocument();
    expect(screen.getByLabelText("My Tickets 4")).toBeInTheDocument();
    expect(screen.getByLabelText("My Open Actions 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Unassigned Tickets 2")).toHaveAttribute("href", "#ticket-queue?owner=unassigned");
    expect(screen.getByText("Urgent VPN")).toBeInTheDocument();
    expect(screen.getByText("Reset VPN profile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("UI-03 Administrator reuses the Staff dashboard contract", async () => {
    window.location.hash = "#dashboard";
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: { id: 81, name: "Admin", email: "admin@example.test", role: "ADMINISTRATOR", mustChangePassword: false }, csrfToken: "csrf" });
      if (url.endsWith("/api/dashboards/staff")) return jsonResponse(200, { generatedAt: "2026-10-05T12:00:00.000Z", metrics: { unassignedTickets: 0, myTickets: 0, myOpenActions: 0, byStatus: { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 }, byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 } }, recentUrgentTickets: [], myRecentActions: [], drillDown: { unassignedTickets: "/staff/tickets?owner=unassigned", myTickets: "/staff/tickets?owner=81", myOpenActions: "/dashboard#my-actions" } });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "IT Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
  });
});
