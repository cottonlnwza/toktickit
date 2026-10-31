import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const staff = { id: 71, name: "Lab 4 Staff", email: "l4.staff@example.test", role: "IT_STAFF", mustChangePassword: false } as const;
const requester = { id: 51, name: "Lab 4 Requester", email: "l4.requester@example.test", role: "REQUESTER", mustChangePassword: false } as const;
const detail = {
  id: 901,
  ticketNumber: "TTK-L4-0901",
  summary: "VPN instability",
  description: "VPN disconnects repeatedly.",
  requester: { id: requester.id, name: requester.name, email: requester.email },
  category: { id: 1, name: "Network" },
  relatedSystem: { id: 10, name: "VPN" },
  requestedPriority: "HIGH",
  itPriority: "URGENT",
  currentStatus: "OPEN",
  currentStatusLabel: "Open",
  owner: { id: staff.id, name: staff.name, role: "IT_STAFF" },
  ownerOptions: [{ id: staff.id, name: staff.name, role: "IT_STAFF" }],
  problemAppearsResolvedAt: null,
  version: 4,
  workflowCycle: 2,
  createdAt: "2026-10-05T01:00:00.000Z",
  updatedAt: "2026-10-05T02:00:00.000Z",
  attachments: [],
  publicComments: [],
  internalNotes: [],
};
const action = {
  id: 10,
  ticketId: detail.id,
  workflowCycle: 2,
  clientRequestId: "00000000-0000-4000-8000-000000000010",
  actionDateTime: "2026-10-05T02:30:00.000Z",
  actionDescription: "Inspect VPN client logs",
  result: null,
  status: "PLANNED",
  statusLabel: "Planned",
  assignee: { id: staff.id, name: staff.name },
  performedBy: null,
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: "See log attachment",
  completedAt: null,
  cancelledAt: null,
  version: 0,
  createdAt: "2026-10-05T02:30:00.000Z",
  updatedAt: "2026-10-05T02:30:00.000Z",
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}
function urlOf(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function mockStaff() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: staff, csrfToken: "l4-csrf" });
    if (url.endsWith(`/api/staff/tickets/${detail.id}`) && method === "GET") return jsonResponse(200, detail);
    if (url.endsWith(`/api/tickets/${detail.id}/actions`) && method === "GET") return jsonResponse(200, { items: [action] });
    if (url.endsWith(`/api/staff/tickets/${detail.id}/actions`) && method === "POST") {
      const body = JSON.parse(String(init?.body));
      return jsonResponse(201, { action: { ...action, id: 11, clientRequestId: body.clientRequestId, actionDescription: body.actionDescription, followUpRequired: body.followUpRequired, followUpNote: body.followUpNote, attachmentNotes: body.attachmentNotes, assignee: { id: staff.id, name: staff.name } }, ticketVersion: 5, replayed: false });
    }
    if (url.includes("/api/staff/tickets")) return jsonResponse(200, { items: [], ownerOptions: detail.ownerOptions, page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
    return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("Lab 4 Actions Taken Ticket Detail UI", () => {
  it("UI-01 lists current-cycle work and creates an Action with conditional follow-up validation", async () => {
    const fetchSpy = mockStaff();
    window.location.hash = `#staff-ticket-${detail.id}`;
    const user = userEvent.setup();
    render(<App />);

    const section = await screen.findByRole("heading", { name: "Actions Taken" });
    expect(section).toBeInTheDocument();
    expect(await screen.findByText("Inspect VPN client logs")).toBeInTheDocument();
    expect(screen.getByText(/Current workflow cycle: 2/)).toBeInTheDocument();
    expect(screen.getByText("See log attachment")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Action Description/), "Replace VPN profile");
    await user.selectOptions(screen.getByLabelText(/^Assignee/), String(staff.id));
    await user.selectOptions(screen.getByLabelText(/Follow-Up Required/), "yes");
    await user.click(screen.getByRole("button", { name: "Create Action" }));
    expect(await screen.findByText(/Follow-up Note is required/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Follow-up Note/), "Retest tomorrow");
    await user.type(screen.getByLabelText(/Attachment Notes/), "Use profile screenshot");
    await user.click(screen.getByRole("button", { name: "Create Action" }));

    expect(await screen.findByText("Replace VPN profile")).toBeInTheDocument();
    await waitFor(() => {
      const create = fetchSpy.mock.calls.find(([input, init]) => urlOf(input).endsWith(`/api/staff/tickets/${detail.id}/actions`) && init?.method === "POST");
      expect(create).toBeDefined();
      expect(new Headers(create?.[1]?.headers).get("X-CSRF-Token")).toBe("l4-csrf");
      expect(JSON.parse(String(create?.[1]?.body))).toMatchObject({ expectedTicketVersion: 4, assigneeId: staff.id, followUpRequired: true, followUpNote: "Retest tomorrow" });
    });
  });

  it("UI-01 exposes edit/start/complete/cancel only for non-terminal staff Actions", async () => {
    mockStaff();
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    const article = (await screen.findByText("Inspect VPN client logs")).closest("article");
    expect(article).not.toBeNull();
    const card = within(article!);
    expect(card.getByRole("button", { name: /Edit \/ Reassign/ })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("UI-01 keeps completed, cancelled, and historical-cycle Actions read-only", async () => {
    const completed = { ...action, id: 20, actionDescription: "Completed work", status: "COMPLETED", statusLabel: "Completed", result: "Done", version: 1 };
    const cancelled = { ...action, id: 21, actionDescription: "Cancelled work", status: "CANCELLED", statusLabel: "Cancelled", version: 1 };
    const historical = { ...action, id: 22, workflowCycle: 1, actionDescription: "Historical planned work" };
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: staff, csrfToken: "l4-csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`) && method === "GET") return jsonResponse(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`) && method === "GET") return jsonResponse(200, { items: [completed, cancelled, historical] });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);

    for (const description of ["Completed work", "Cancelled work", "Historical planned work"]) {
      const article = (await screen.findByText(description)).closest("article");
      expect(article).not.toBeNull();
      const card = within(article!);
      expect(card.queryByRole("button", { name: /Edit \/ Reassign/ })).not.toBeInTheDocument();
      expect(card.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
      expect(card.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
      expect(card.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    }
    expect(screen.getByText(/Cycle 1 - Historical/)).toBeInTheDocument();
  });

  it("UI-01 immediately rerenders a successfully completed Action without mutation controls", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Resolved by profile reset");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: staff, csrfToken: "l4-csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`) && method === "GET") return jsonResponse(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`) && method === "GET") return jsonResponse(200, { items: [action] });
      if (url.endsWith(`/api/staff/tickets/${detail.id}/actions/${action.id}/status`) && method === "POST") {
        return jsonResponse(200, {
          action: { ...action, status: "COMPLETED", statusLabel: "Completed", result: "Resolved by profile reset", version: 1 },
          ticketVersion: 5,
        });
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    const article = (await screen.findByText("Inspect VPN client logs")).closest("article");
    expect(article).not.toBeNull();
    await user.click(within(article!).getByRole("button", { name: "Complete" }));
    await waitFor(() => expect(within(article!).getByText("Completed")).toBeInTheDocument());
    expect(within(article!).queryByRole("button", { name: /Edit \/ Reassign/ })).not.toBeInTheDocument();
    expect(within(article!).queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    expect(within(article!).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("UI-01 immediately rerenders a successfully cancelled Action without mutation controls", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: staff, csrfToken: "l4-csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`) && method === "GET") return jsonResponse(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`) && method === "GET") return jsonResponse(200, { items: [action] });
      if (url.endsWith(`/api/staff/tickets/${detail.id}/actions/${action.id}/status`) && method === "POST") {
        return jsonResponse(200, {
          action: { ...action, status: "CANCELLED", statusLabel: "Cancelled", version: 1 },
          ticketVersion: 5,
        });
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    const article = (await screen.findByText("Inspect VPN client logs")).closest("article");
    expect(article).not.toBeNull();
    await user.click(within(article!).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(within(article!).getByText("Cancelled")).toBeInTheDocument());
    expect(within(article!).queryByRole("button", { name: /Edit \/ Reassign/ })).not.toBeInTheDocument();
    expect(within(article!).queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    expect(within(article!).queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    expect(within(article!).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("UI-01 renders Requester Actions as read-only on an owned Ticket", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: requester, csrfToken: "requester-csrf" });
      if (url.endsWith("/api/categories")) return jsonResponse(200, [detail.category]);
      if (url.endsWith("/api/related-systems")) return jsonResponse(200, [detail.relatedSystem]);
      if (url.includes("/api/tickets/mine")) return jsonResponse(200, { items: [{ ...detail }], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
      if (url.endsWith(`/api/tickets/${detail.id}`) && (!init?.method || init.method === "GET")) return jsonResponse(200, { ...detail, attachments: [] });
      if (url.endsWith(`/api/tickets/${detail.id}/comments`)) return jsonResponse(200, []);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`)) return jsonResponse(200, { items: [action] });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("link", { name: /My Tickets/i }));
    await user.click((await screen.findAllByRole("button", { name: `Open Ticket ${detail.ticketNumber}` }))[0]);
    expect(await screen.findByText("Inspect VPN client logs")).toBeInTheDocument();
    expect(screen.getByText(/Recorded service-desk work for this Ticket\. This information is read-only\./i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit \/ Reassign/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
  });
});
