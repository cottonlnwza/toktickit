import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const staff = { id: 71, name: "Lab 4 Staff", email: "l4.staff@example.test", role: "IT_STAFF", mustChangePassword: false } as const;
const admin = { id: 72, name: "Lab 4 Admin", email: "l4.admin@example.test", role: "ADMINISTRATOR", mustChangePassword: false } as const;
const detail = {
  id: 902,
  ticketNumber: "TTK-L4-0902",
  summary: "Workflow verification",
  description: "Verify final Ticket lifecycle.",
  requester: { id: 51, name: "Requester", email: "requester@example.test" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "Laptop" },
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  currentStatus: "OPEN",
  currentStatusLabel: "Open",
  owner: { id: staff.id, name: staff.name, role: "IT_STAFF" },
  ownerOptions: [{ id: staff.id, name: staff.name, role: "IT_STAFF" }, { id: admin.id, name: admin.name, role: "ADMINISTRATOR" }],
  problemAppearsResolvedAt: null,
  version: 4,
  workflowCycle: 1,
  createdAt: "2026-10-05T01:00:00.000Z",
  updatedAt: "2026-10-05T02:00:00.000Z",
  attachments: [], publicComments: [], internalNotes: [],
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}
function urlOf(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}
function mockWorkflow(user: typeof staff | typeof admin, statusResponse?: { status: number; body: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user, csrfToken: "workflow-csrf" });
    if (url.endsWith(`/api/staff/tickets/${detail.id}`) && method === "GET") return jsonResponse(200, detail);
    if (url.endsWith(`/api/tickets/${detail.id}/actions`) && method === "GET") return jsonResponse(200, { items: [] });
    if (url.endsWith(`/api/staff/tickets/${detail.id}/status`) && method === "PATCH") {
      return jsonResponse(statusResponse?.status ?? 200, statusResponse?.body ?? { currentStatus: "IN_PROGRESS", currentStatusLabel: "In Progress", version: 5, workflowCycle: 1, resolvedAt: null });
    }
    if (url.includes("/api/staff/tickets")) return jsonResponse(200, { items: [], ownerOptions: detail.ownerOptions, page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
    return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
  });
}

afterEach(() => { vi.restoreAllMocks(); window.location.hash = ""; });

describe("Lab 4 final Ticket workflow UI", () => {
  it.each([staff, admin])("UI-04 gives $role permitted transitions and sends expectedTicketVersion", async (authUser) => {
    const fetchSpy = mockWorkflow(authUser);
    window.location.hash = `#staff-ticket-${detail.id}`;
    const user = userEvent.setup();
    render(<App />);
    const select = await screen.findByLabelText("Status Transition");
    expect(select).toBeInTheDocument();
    await user.selectOptions(select, "IN_PROGRESS");
    await user.click(screen.getByRole("button", { name: "Apply Status" }));
    expect(await screen.findByText("Status updated.")).toBeInTheDocument();
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([input, init]) => urlOf(input).endsWith(`/api/staff/tickets/${detail.id}/status`) && init?.method === "PATCH");
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: "IN_PROGRESS", expectedTicketVersion: 4 });
    });
  });

  it("UI-04 explains a server-side resolution gate rejection", async () => {
    mockWorkflow(staff, { status: 409, body: { error: { code: "RESOLUTION_GATE_BLOCKED", message: "Blocked." } } });
    window.location.hash = `#staff-ticket-${detail.id}`;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(await screen.findByLabelText("Status Transition"), "RESOLVED");
    await user.click(screen.getByRole("button", { name: "Apply Status" }));
    expect(await screen.findByText(/Resolve is blocked until the current workflow cycle/i)).toBeInTheDocument();
  });
});
