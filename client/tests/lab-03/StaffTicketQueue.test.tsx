import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const staff = {
  id: 71,
  name: "Issue 37 IT Staff",
  email: "issue37.staff@example.test",
  role: "IT_STAFF",
  mustChangePassword: false,
} as const;

const queueItem = {
  id: 901,
  ticketNumber: "TTK-20260919-0901",
  summary: "VPN disconnects during class",
  requester: { id: 11, name: "Alice Requester", email: "alice.requester@example.test" },
  requestedPriority: "HIGH",
  itPriority: "URGENT",
  currentStatus: "OPEN",
  owner: { id: staff.id, name: staff.name },
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedAt: "2026-09-19T00:30:00.000Z",
};

const unassignedItem = {
  ...queueItem,
  id: 902,
  ticketNumber: "TTK-20260919-0902",
  summary: "Printer toner replacement",
  requester: { id: 12, name: "Bob Requester", email: "bob.requester@example.test" },
  requestedPriority: "LOW",
  itPriority: "MEDIUM",
  currentStatus: "WAITING_FOR_REQUESTER",
  owner: null,
  updatedAt: "2026-09-18T23:30:00.000Z",
};

const adminOwner = {
  id: 88,
  name: "Owner Admin Not On Current Page",
  role: "ADMINISTRATOR",
} as const;

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function queueResponse(items = [queueItem, unassignedItem], overrides: Record<string, unknown> = {}) {
  return {
    items,
    ownerOptions: [
      { id: staff.id, name: staff.name, role: "IT_STAFF" },
      adminOwner,
    ],
    page: 1,
    pageSize: 10,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  };
}

function mockStaffQueueFetch(
  queueHandler: (url: string, init?: RequestInit) => Promise<Response> = () => jsonResponse(200, queueResponse()),
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = requestUrl(input);
    if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: staff, csrfToken: "issue37-csrf" });
    if (url.endsWith("/api/categories")) return jsonResponse(200, [{ id: 1, name: "Network" }, { id: 2, name: "Hardware" }]);
    if (url.endsWith("/api/related-systems")) return jsonResponse(200, [{ id: 10, name: "VPN" }, { id: 20, name: "Printer" }]);
    if (url.includes("/api/staff/tickets")) return queueHandler(url, init);
    return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
  });
}

describe("Lab 3 Issue 5 IT Staff Ticket Queue UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
    localStorage.clear();
  });

  it("UI-06 shows a meaningful loading state while the Queue request is pending", async () => {
    let resolveQueue!: (response: Response) => void;
    mockStaffQueueFetch(() => new Promise<Response>((resolve) => { resolveQueue = resolve; }));
    render(<App />);

    await screen.findByRole("heading", { name: /Ticket Queue/i });
    expect(screen.getByRole("status")).toHaveTextContent(/Loading Ticket Queue/i);

    resolveQueue(await jsonResponse(200, queueResponse([queueItem])));
    expect(await screen.findByTestId("staff-queue-desktop")).toBeInTheDocument();
  });

  it("UI-06 renders the approved desktop Queue fields, priorities/status, assigned/unassigned ownership, and Open actions", async () => {
    mockStaffQueueFetch();
    render(<App />);

    const heading = await screen.findByRole("heading", { name: /Ticket Queue/i });
    expect(heading).toBeInTheDocument();
    const desktop = await screen.findByTestId("staff-queue-desktop");
    const table = within(desktop).getByRole("table", { name: /Ticket Queue/i });
    for (const header of ["Ticket Number", "Summary", "Requested Priority", "IT Priority", "Status", "Owner", "Last Updated"]) {
      expect(within(table).getByRole("columnheader", { name: new RegExp(header, "i") })).toBeInTheDocument();
    }
    expect(within(table).getByText(queueItem.ticketNumber)).toBeInTheDocument();
    expect(within(table).getByText(queueItem.summary)).toBeInTheDocument();
    expect(within(table).getByText("Alice Requester")).toBeInTheDocument();
    expect(within(table).getByText("URGENT")).toBeInTheDocument();
    expect(within(table).getByText("OPEN")).toBeInTheDocument();
    expect(within(table).getByText(staff.name)).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: new RegExp(`Open Ticket ${queueItem.ticketNumber}`, "i") })).toBeInTheDocument();
  });

  it("UI-06 keeps active owner choices available even when that owner is absent from the current Ticket page", async () => {
    const fetchSpy = mockStaffQueueFetch(() => jsonResponse(200, queueResponse([queueItem])));
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: /Ticket Queue/i });
    const ownerSelect = screen.getByLabelText(/^Owner$/i);
    expect(await within(ownerSelect).findByRole("option", { name: adminOwner.name })).toHaveValue(String(adminOwner.id));
    expect(within(screen.getByTestId("staff-queue-desktop")).queryByText(adminOwner.name)).not.toBeInTheDocument();

    await user.selectOptions(ownerSelect, String(adminOwner.id));
    await waitFor(() => {
      const queueCalls = fetchSpy.mock.calls.map(([input]) => requestUrl(input)).filter((url) => url.includes("/api/staff/tickets"));
      expect(new URL(queueCalls.at(-1)!).searchParams.get("owner")).toBe(String(adminOwner.id));
    });
  });

  it("UI-06 sends documented search/filter/sort/page-size/pagination parameters and can clear the query", async () => {
    const fetchSpy = mockStaffQueueFetch((url) => {
      const page = new URL(url).searchParams.get("page") === "2" ? 2 : 1;
      return jsonResponse(200, queueResponse([queueItem], { page, totalItems: 11, totalPages: 2 }));
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: /Ticket Queue/i });

    await user.type(screen.getByLabelText(/Search Tickets/i), "VPN");
    await user.selectOptions(screen.getByLabelText(/^Status$/i), "OPEN");
    await user.selectOptions(screen.getByLabelText(/Requested Priority/i), "HIGH");
    await user.selectOptions(screen.getByLabelText(/IT Priority/i), "URGENT");
    await user.selectOptions(screen.getByLabelText(/^Owner$/i), "unassigned");
    await user.selectOptions(screen.getByLabelText(/^Category$/i), "1");
    await user.selectOptions(screen.getByLabelText(/Related System/i), "10");
    await user.selectOptions(screen.getByLabelText(/Sort By/i), "createdAt");
    await user.selectOptions(screen.getByLabelText(/Sort Order/i), "asc");
    await user.selectOptions(screen.getByLabelText(/Page Size/i), "10");

    await waitFor(() => {
      const queueCalls = fetchSpy.mock.calls.map(([input]) => requestUrl(input)).filter((url) => url.includes("/api/staff/tickets"));
      const latest = new URL(queueCalls.at(-1)!);
      expect(latest.searchParams.get("search")).toBe("VPN");
      expect(latest.searchParams.get("status")).toBe("OPEN");
      expect(latest.searchParams.get("requestedPriority")).toBe("HIGH");
      expect(latest.searchParams.get("itPriority")).toBe("URGENT");
      expect(latest.searchParams.get("owner")).toBe("unassigned");
      expect(latest.searchParams.get("categoryId")).toBe("1");
      expect(latest.searchParams.get("relatedSystemId")).toBe("10");
      expect(latest.searchParams.get("sortBy")).toBe("createdAt");
      expect(latest.searchParams.get("sortOrder")).toBe("asc");
      expect(latest.searchParams.get("pageSize")).toBe("10");
    });

    await user.click(screen.getByRole("button", { name: /Next/i }));
    await waitFor(() => {
      const queueCalls = fetchSpy.mock.calls.map(([input]) => requestUrl(input)).filter((url) => url.includes("/api/staff/tickets"));
      expect(new URL(queueCalls.at(-1)!).searchParams.get("page")).toBe("2");
    });

    await user.click(screen.getByRole("button", { name: /Clear Filters/i }));
    expect(screen.getByLabelText(/Search Tickets/i)).toHaveValue("");
    expect(screen.getByLabelText(/^Status$/i)).toHaveValue("");
  });

  it("UI-06 distinguishes an empty Queue from a no-results query and offers Clear Filters for no results", async () => {
    mockStaffQueueFetch(() => jsonResponse(200, queueResponse([], { totalItems: 0, totalPages: 0 })));
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText(/queue is empty|no tickets.*queue/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Search Tickets/i), "does-not-exist");
    expect(await screen.findByText(/no tickets match|no results/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Clear Filters/i }).length).toBeGreaterThan(0);
  });

  it("UI-06 shows forbidden feedback without Queue rows when the Queue API returns 403", async () => {
    mockStaffQueueFetch(() => jsonResponse(403, { error: { code: "FORBIDDEN", message: "This operation is not permitted for the current role." } }));
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/forbidden|not permitted/i);
    expect(screen.queryByText(queueItem.ticketNumber)).not.toBeInTheDocument();
  });

  it("UI-06 shows a safe failure with Retry and recovers without exposing raw server details", async () => {
    let attempts = 0;
    mockStaffQueueFetch(() => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(500, { error: { code: "QUEUE_ERROR", message: "db-host-42 internal stack trace" } });
      }
      return jsonResponse(200, queueResponse([queueItem]));
    });
    const user = userEvent.setup();
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unable to load|try again/i);
    expect(alert).not.toHaveTextContent(/db-host-42|stack trace/i);
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    expect((await screen.findAllByText(queueItem.ticketNumber)).length).toBeGreaterThan(0);
  });

  it("UI-06 provides both the desktop table and smaller-screen card representation hooks", async () => {
    mockStaffQueueFetch();
    render(<App />);

    await screen.findByRole("heading", { name: /Ticket Queue/i });
    expect(screen.getByTestId("staff-queue-desktop")).toBeInTheDocument();
    const mobile = screen.getByTestId("staff-queue-mobile");
    expect(within(mobile).getByRole("article", { name: new RegExp(queueItem.ticketNumber, "i") })).toBeInTheDocument();
    expect(within(mobile).getByText(queueItem.summary)).toBeInTheDocument();
    expect(within(mobile).getByText(/Alice Requester/i)).toBeInTheDocument();
    expect(within(mobile).getByText(/URGENT/i)).toBeInTheDocument();
    expect(within(mobile).getByText("OPEN")).toBeInTheDocument();
    expect(within(mobile).getByText(staff.name)).toBeInTheDocument();
    expect(within(mobile).getByRole("button", { name: new RegExp(`Open Ticket ${queueItem.ticketNumber}`, "i") })).toBeInTheDocument();
  });
});
