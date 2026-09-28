import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const requester = {
  id: 51,
  name: "Requester Detail User",
  email: "requester.detail@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
} as const;

const ticket = {
  id: 601,
  ticketNumber: "TTK-20260918-0601",
  summary: "VPN disconnects during class",
  description: "VPN disconnects repeatedly while the Requester is using the campus network.",
  requester: { id: requester.id, name: requester.name, email: requester.email },
  category: { id: 1, name: "Network" },
  relatedSystem: { id: 2, name: "VPN" },
  requestedPriority: "MEDIUM",
  currentStatus: "WAITING_FOR_REQUESTER",
  currentStatusLabel: "Waiting for Requester",
  problemAppearsResolvedAt: null,
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedAt: "2026-09-18T09:00:00.000Z",
  attachments: [],
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

describe("Lab 3 Requester Ticket Detail additions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("UI-05 shows Public Comments and Problem Appears Resolved without staff status/Internal Note controls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: requester, csrfToken: "detail-csrf" });
      if (url.endsWith("/api/categories")) return jsonResponse(200, [ticket.category]);
      if (url.endsWith("/api/related-systems")) return jsonResponse(200, [ticket.relatedSystem]);
      if (url.includes("/api/tickets/mine") || url.includes(`/api/requesters/${requester.id}/tickets?`)) {
        return jsonResponse(200, {
          items: [{
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            summary: ticket.summary,
            category: ticket.category,
            relatedSystem: ticket.relatedSystem,
            requestedPriority: ticket.requestedPriority,
            currentStatus: ticket.currentStatus,
            currentStatusLabel: ticket.currentStatusLabel,
            updatedAt: ticket.updatedAt,
          }],
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        });
      }
      if ((url.endsWith(`/api/tickets/${ticket.id}`) || url.endsWith(`/api/requesters/${requester.id}/tickets/${ticket.id}`)) && (!init?.method || init.method === "GET")) {
        return jsonResponse(200, ticket);
      }
      if (url.endsWith(`/api/tickets/${ticket.id}/comments`) && (!init?.method || init.method === "GET")) {
        return jsonResponse(200, [{ id: 1, content: "Still intermittent.", author: { id: requester.id, name: requester.name, role: "REQUESTER" }, createdAt: ticket.updatedAt }]);
      }
      if (url.endsWith(`/api/tickets/${ticket.id}/comments`) && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { content: string };
        return jsonResponse(201, { id: 2, content: body.content, author: { id: requester.id, name: requester.name, role: "REQUESTER" }, createdAt: "2026-09-18T10:00:00.000Z" });
      }
      if (url.endsWith(`/api/tickets/${ticket.id}/problem-appears-resolved`) && init?.method === "POST") {
        return jsonResponse(200, { problemAppearsResolvedAt: "2026-09-18T10:05:00.000Z", currentStatus: ticket.currentStatus });
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("link", { name: /My Tickets/i }));
    await user.click((await screen.findAllByRole("button", { name: `Open Ticket ${ticket.ticketNumber}` }))[0]);
    expect(await screen.findByRole("heading", { name: /Ticket Detail/i })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /Public Comments/i })).toBeInTheDocument();
    expect(await screen.findByText("Still intermittent.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Public Comment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Post Comment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Problem Appears Resolved/i })).toBeInTheDocument();
    expect(screen.queryByText(/Internal Notes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set.*Resolved|Close Ticket|Change Status/i })).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /Public Comment/i }), "Restart did not fully solve it.");
    await user.click(screen.getByRole("button", { name: /Post Comment/i }));
    expect(await screen.findByText("Restart did not fully solve it.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Problem Appears Resolved/i }));
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([input, init]) => requestUrl(input).endsWith(`/api/tickets/${ticket.id}/problem-appears-resolved`) && init?.method === "POST")).toBe(true);
    });
    expect(screen.getAllByText(/Waiting for Requester/i).length).toBeGreaterThan(0);
  });

  it("UI-05 disables Problem Appears Resolved when the Ticket lifecycle state is ineligible", async () => {
    const newTicket = { ...ticket, currentStatus: "NEW", currentStatusLabel: "New" };
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: requester, csrfToken: "detail-csrf" });
      if (url.endsWith("/api/categories")) return jsonResponse(200, [newTicket.category]);
      if (url.endsWith("/api/related-systems")) return jsonResponse(200, [newTicket.relatedSystem]);
      if (url.includes("/api/tickets/mine")) {
        return jsonResponse(200, {
          items: [{
            id: newTicket.id,
            ticketNumber: newTicket.ticketNumber,
            summary: newTicket.summary,
            category: newTicket.category,
            relatedSystem: newTicket.relatedSystem,
            requestedPriority: newTicket.requestedPriority,
            currentStatus: newTicket.currentStatus,
            currentStatusLabel: newTicket.currentStatusLabel,
            updatedAt: newTicket.updatedAt,
          }],
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        });
      }
      if (url.endsWith(`/api/tickets/${newTicket.id}`)) return jsonResponse(200, newTicket);
      if (url.endsWith(`/api/tickets/${newTicket.id}/comments`)) return jsonResponse(200, []);
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("link", { name: /My Tickets/i }));
    await user.click((await screen.findAllByRole("button", { name: `Open Ticket ${newTicket.ticketNumber}` }))[0]);
    expect(await screen.findByRole("heading", { name: /Ticket Detail/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Problem Appears Resolved/i })).toBeDisabled();
    expect(screen.getByText(/available only while this Ticket is Open, In Progress, Waiting for Requester, or Reopened/i)).toBeInTheDocument();
  });
});
