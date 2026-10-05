import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const staff = { id: 71, name: "Lab 4 Staff", email: "lab4.staff@example.test", role: "IT_STAFF", mustChangePassword: false } as const;
const ownerB = { id: 72, name: "Lab 4 Staff B", role: "IT_STAFF" } as const;
const detail = {
  id: 901,
  ticketNumber: "TTK-L4-0901",
  summary: "Aggregate version fixture",
  description: "Ticket version must protect owner and priority mutations.",
  requester: { id: 11, name: "Requester", email: "requester@example.test" },
  category: { id: 1, name: "Network" },
  relatedSystem: { id: 10, name: "VPN" },
  requestedPriority: "HIGH",
  itPriority: "MEDIUM",
  currentStatus: "OPEN",
  currentStatusLabel: "Open",
  version: 4,
  workflowCycle: 1,
  owner: null,
  ownerOptions: [{ id: staff.id, name: staff.name, role: "IT_STAFF" }, ownerB],
  problemAppearsResolvedAt: null,
  createdAt: "2026-10-05T08:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  attachments: [],
  publicComments: [],
  internalNotes: [],
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function urlOf(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("Lab 4 Ticket aggregate version UI", () => {
  it("sends the current Ticket version and refreshes it after priority then owner mutations", async () => {
    const mutationBodies: Array<{ path: string; body: Record<string, unknown> }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: staff, csrfToken: "csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`) && method === "GET") return jsonResponse(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`) && method === "GET") return jsonResponse(200, { items: [] });
      if (url.endsWith(`/api/staff/tickets/${detail.id}/it-priority`) && method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        mutationBodies.push({ path: "priority", body });
        return jsonResponse(200, { itPriority: "URGENT", requestedPriority: "HIGH", version: 5 });
      }
      if (url.endsWith(`/api/staff/tickets/${detail.id}/owner`) && method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        mutationBodies.push({ path: "owner", body });
        return jsonResponse(200, { owner: ownerB, version: 6 });
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });

    const user = userEvent.setup();
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    await screen.findByRole("heading", { name: /Ticket Detail/i });

    await user.selectOptions(screen.getByLabelText(/IT Priority/i), "URGENT");
    await waitFor(() => expect(mutationBodies).toContainEqual({ path: "priority", body: { itPriority: "URGENT", expectedTicketVersion: 4 } }));

    await user.selectOptions(screen.getByLabelText(/^Owner$/i), String(ownerB.id));
    await waitFor(() => expect(mutationBodies).toContainEqual({ path: "owner", body: { ownerId: ownerB.id, expectedTicketVersion: 5 } }));
  });
});
