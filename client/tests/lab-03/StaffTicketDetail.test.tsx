import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const staff = { id: 71, name: "Issue 38 IT Staff", email: "issue38.staff@example.test", role: "IT_STAFF", mustChangePassword: false } as const;
const admin = { id: 88, name: "Issue 38 Admin", email: "issue38.admin@example.test", role: "ADMINISTRATOR", mustChangePassword: false } as const;
const ownerB = { id: 72, name: "Issue 38 Staff B", role: "IT_STAFF" } as const;

const detail = {
  id: 901,
  ticketNumber: "TTK-20260919-0901",
  summary: "VPN disconnects during class",
  description: "VPN drops every ten minutes.",
  requester: { id: 11, name: "Alice Requester", email: "alice@example.test" },
  category: { id: 1, name: "Network" },
  relatedSystem: { id: 10, name: "VPN" },
  requestedPriority: "HIGH",
  itPriority: "URGENT",
  currentStatus: "OPEN",
  currentStatusLabel: "Open",
  owner: null,
  ownerOptions: [
    { id: staff.id, name: staff.name, role: "IT_STAFF" },
    ownerB,
    { id: admin.id, name: admin.name, role: "ADMINISTRATOR" },
  ],
  problemAppearsResolvedAt: "2026-09-19T01:00:00.000Z",
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedAt: "2026-09-19T00:30:00.000Z",
  attachments: [{
    id: 5,
    originalFilename: "evidence.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    uploadedAt: "2026-09-18T09:00:00.000Z",
    removedAt: null,
    removalReason: null,
    state: "active",
    downloadUrl: "/api/staff/tickets/901/attachments/5/download",
  }],
  publicComments: [{ id: 1, content: "Requester comment", author: { id: 11, name: "Alice Requester", role: "REQUESTER" }, createdAt: "2026-09-18T10:00:00.000Z" }],
  internalNotes: [{ id: 2, content: "Private diagnostic note", author: { id: staff.id, name: staff.name, role: "IT_STAFF" }, createdAt: "2026-09-18T11:00:00.000Z" }],
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function urlOf(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function mockDetailFetch(
  role: "IT_STAFF" | "ADMINISTRATOR" = "IT_STAFF",
  statusMutation?: () => Promise<Response>,
) {
  const activeUser = role === "IT_STAFF" ? staff : admin;
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: activeUser, csrfToken: "issue38-csrf" });
    if (url.endsWith(`/api/staff/tickets/${detail.id}`) && method === "GET") return jsonResponse(200, detail);
    if (url.endsWith(`/api/staff/tickets/${detail.id}/claim`) && method === "POST") return jsonResponse(200, { owner: { id: staff.id, name: staff.name, role: "IT_STAFF" } });
    if (url.endsWith(`/api/staff/tickets/${detail.id}/owner`) && method === "PATCH") return jsonResponse(200, { owner: ownerB });
    if (url.endsWith(`/api/staff/tickets/${detail.id}/it-priority`) && method === "PATCH") return jsonResponse(200, { itPriority: "LOW", requestedPriority: "HIGH" });
    if (url.endsWith(`/api/staff/tickets/${detail.id}/status`) && method === "PATCH") {
      return statusMutation ? statusMutation() : jsonResponse(200, { currentStatus: "RESOLVED", currentStatusLabel: "Resolved" });
    }
    if (url.endsWith(`/api/tickets/${detail.id}/comments`) && method === "POST") return jsonResponse(201, { id: 9, content: "Public update", author: staff, createdAt: "2026-09-19T02:00:00.000Z" });
    if (url.endsWith(`/api/staff/tickets/${detail.id}/internal-notes`) && method === "POST") return jsonResponse(201, { id: 10, content: "Private update", author: staff, createdAt: "2026-09-19T02:05:00.000Z" });
    if (url.includes("/api/staff/tickets")) return jsonResponse(200, { items: [], ownerOptions: detail.ownerOptions, page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
    return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
  });
}

describe("Lab 3 Issue 6 Staff Ticket Detail UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("UI-07 groups Ticket information, operations, resolution indication, Public Comments, Internal Notes, and Attachments", async () => {
    mockDetailFetch();
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);

    expect(await screen.findByRole("heading", { name: /Ticket Detail/i })).toBeInTheDocument();
    expect(screen.getByText(detail.ticketNumber)).toBeInTheDocument();
    expect(screen.getByText(detail.summary)).toBeInTheDocument();
    expect(screen.getAllByText(/Alice Requester/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Problem Appears Resolved/i)).toBeInTheDocument();
    expect(screen.getByText("Requester comment")).toBeInTheDocument();
    expect(screen.getByText("Private diagnostic note")).toBeInTheDocument();
    expect(screen.getByText("evidence.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Internal - not visible to Requester/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Requested Priority/i)).toHaveValue("HIGH");
    expect(screen.getByLabelText(/Requested Priority/i)).toBeDisabled();
  });

  it("UI-07 performs claim, owner, IT Priority, status, Public Comment, and Internal Note actions with CSRF", async () => {
    const fetchSpy = mockDetailFetch();
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    await screen.findByRole("heading", { name: /Ticket Detail/i });

    await user.click(screen.getByRole("button", { name: /Claim Ticket/i }));
    await user.selectOptions(screen.getByLabelText(/^Owner$/i), String(ownerB.id));
    await user.selectOptions(screen.getByLabelText(/IT Priority/i), "LOW");
    await user.selectOptions(screen.getByLabelText(/Status Transition/i), "RESOLVED");
    await user.click(screen.getByRole("button", { name: /Apply Status/i }));
    await user.type(screen.getByLabelText(/Public Comment/i), "Public update");
    await user.click(screen.getByRole("button", { name: /Post Public Comment/i }));
    await user.type(screen.getByLabelText(/Internal Note/i), "Private update");
    await user.click(screen.getByRole("button", { name: /Add Internal Note/i }));

    await waitFor(() => {
      const mutationCalls = fetchSpy.mock.calls.filter(([, init]) => ["POST", "PATCH"].includes(init?.method ?? ""));
      expect(mutationCalls.length).toBeGreaterThanOrEqual(6);
      for (const [, init] of mutationCalls) {
        expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("issue38-csrf");
      }
    });
  });

  it("UI-07 asks confirmation for destructive/lifecycle transitions and does not submit when cancelled", async () => {
    const fetchSpy = mockDetailFetch();
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    await screen.findByRole("heading", { name: /Ticket Detail/i });
    await user.selectOptions(screen.getByLabelText(/Status Transition/i), "RESOLVED");
    await user.click(screen.getByRole("button", { name: /Apply Status/i }));
    expect(fetchSpy.mock.calls.some(([input, init]) => urlOf(input).endsWith(`/status`) && init?.method === "PATCH")).toBe(false);
  });

  it("UI-07 shows domain feedback when the backend rejects a stale status transition with 400 INVALID_TRANSITION", async () => {
    mockDetailFetch("IT_STAFF", () => jsonResponse(400, {
      error: { code: "INVALID_TRANSITION", message: "Ticket status transition is not allowed." },
    }));
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    await screen.findByRole("heading", { name: /Ticket Detail/i });

    await user.selectOptions(screen.getByLabelText(/Status Transition/i), "RESOLVED");
    await user.click(screen.getByRole("button", { name: /Apply Status/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/status transition.*no longer allowed|refresh.*try again/i);
    expect(alert).not.toHaveTextContent(/Unable to save the Ticket change/i);
  });

  it("UI-07 renders Administrator direct-detail oversight read-only except IT Priority", async () => {
    mockDetailFetch("ADMINISTRATOR");
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    await screen.findByRole("heading", { name: /Ticket Detail/i });
    expect(screen.queryByRole("button", { name: /Claim Ticket/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Owner$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Status Transition/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Public Comment/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Internal Note/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/IT Priority/i)).toBeEnabled();
    expect(screen.getByText("Private diagnostic note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to User Management/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Back to Queue/i })).not.toBeInTheDocument();
  });

  it("UI-07 shows safe not-found feedback without leaking raw server details", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = urlOf(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: staff, csrfToken: "issue38-csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`)) return jsonResponse(404, { error: { code: "NOT_FOUND", message: "database-secret-row-901" } });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    window.location.hash = `#staff-ticket-${detail.id}`;
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Ticket Detail was not found/i);
    expect(alert).not.toHaveTextContent(/database-secret/i);
  });
});
