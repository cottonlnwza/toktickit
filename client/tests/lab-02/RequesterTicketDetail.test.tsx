import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const ticket = {
  id: 42,
  ticketNumber: "TTK-20260904-0042",
  summary: "Laptop battery drains quickly",
  description: "The battery drops during one class session.",
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  requester: { id: 7, name: "Anong Student", email: "anong@example.test" },
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  currentStatusLabel: "New",
  createdAt: "2026-09-04T08:00:00.000Z",
  updatedAt: "2026-09-04T09:00:00.000Z",
  attachments: [],
};

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function mockApi(detail: "success" | "pending" | "notFound" | "failure" = "success") {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/api/requesters")) return response([ticket.requester]);
    if (url.endsWith("/api/categories")) return response([ticket.category]);
    if (url.endsWith("/api/related-systems")) return response([ticket.relatedSystem]);
    if (url.includes("/tickets/42")) {
      if (detail === "pending") return new Promise(() => undefined);
      if (detail === "notFound") return response({ error: { code: "NOT_FOUND", message: "Ticket was not found." } }, 404);
      if (detail === "failure") return response({ error: { code: "TICKET_DETAIL_ERROR", message: "Unable to load Ticket Detail." } }, 500);
      return response(ticket);
    }
    if (url.includes("/tickets")) {
      return response({ items: [{ ...ticket, requester: undefined, description: undefined, createdAt: undefined, attachments: undefined }], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    }
    return response({});
  });
}

async function openTicket() {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), "7");
  await user.click(screen.getByRole("button", { name: /Continue/i }));
  await user.click(screen.getByRole("link", { name: /My Tickets/i }));
  await user.click((await screen.findAllByRole("button", { name: /Open Ticket TTK-20260904-0042/i }))[0]);
  return user;
}

describe("Requester Ticket Detail", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens the selected Ticket, shows every field read-only, and returns to My Tickets", async () => {
    const fetch = mockApi();
    const user = await openTicket();

    expect(await screen.findByRole("heading", { name: /Ticket Detail/i })).toBeInTheDocument();
    for (const value of [ticket.ticketNumber, "New", "Anong Student", "Hardware", "Corporate Laptop", "MEDIUM", ticket.summary, ticket.description, "2026-09-04"]) {
      expect(screen.getAllByText(value, { exact: false }).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole("textbox", { name: /Summary|Description/i })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/requesters/7/tickets/42"));
    await user.click(screen.getByRole("button", { name: /Back to My Tickets/i }));
    expect(screen.getByRole("heading", { name: /My Tickets/i })).toBeInTheDocument();
  });

  it("shows a loading state while Ticket Detail is retrieved", async () => {
    mockApi("pending");
    await openTicket();
    expect(await screen.findByText(/Loading Ticket Detail/i)).toBeInTheDocument();
  });

  it("shows the same safe unavailable state for not-found or unowned Tickets", async () => {
    mockApi("notFound");
    await openTicket();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Ticket is unavailable/i);
  });

  it("shows a safe failure state with retry", async () => {
    mockApi("failure");
    await openTicket();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to load Ticket Detail/i);
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("clears stale Ticket Detail when the Requester changes", async () => {
    mockApi();
    const user = await openTicket();
    await screen.findByRole("heading", { name: /Ticket Detail/i });
    await user.click(screen.getByRole("button", { name: /Change Requester/i }));
    await waitFor(() => expect(screen.queryByText(ticket.ticketNumber)).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /Select Development Requester/i })).toBeInTheDocument();
  });
});
