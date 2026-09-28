import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const requester = {
  id: 41,
  name: "Issue 36 Requester",
  email: "issue36.requester@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
} as const;

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

describe("Lab 3 authenticated Requester regression UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
    localStorage.clear();
  });

  it("UI-04 uses canonical authenticated My Tickets and never sends requester identity in the URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: requester, csrfToken: "issue36-csrf" });
      if (url.endsWith("/api/categories")) return jsonResponse(200, [{ id: 1, name: "Hardware" }]);
      if (url.endsWith("/api/related-systems")) return jsonResponse(200, [{ id: 1, name: "Corporate Laptop" }]);
      if (url.includes("/api/tickets/mine") || url.includes(`/api/requesters/${requester.id}/tickets`)) {
        return jsonResponse(200, { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("link", { name: /My Tickets/i }));
    await screen.findByRole("heading", { name: /My Tickets/i });

    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([input]) => requestUrl(input).includes("/api/tickets/mine"))).toBe(true);
    });
    expect(fetchSpy.mock.calls.some(([input]) => requestUrl(input).includes(`/api/requesters/${requester.id}/tickets`))).toBe(false);
    expect(screen.queryByText(/Development Requester|Change Requester/i)).not.toBeInTheDocument();
  });

  it("UI-04 creates with one clientRequestId reused across a retry and never sends requesterId", async () => {
    const createBodies: Record<string, unknown>[] = [];
    let createAttempt = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: requester, csrfToken: "issue36-csrf" });
      if (url.endsWith("/api/categories")) return jsonResponse(200, [{ id: 1, name: "Hardware" }]);
      if (url.endsWith("/api/related-systems")) return jsonResponse(200, [{ id: 2, name: "Corporate Laptop" }]);
      if (url.endsWith("/api/tickets") && init?.method === "POST") {
        createBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        createAttempt += 1;
        if (createAttempt === 1) return jsonResponse(500, { error: { code: "CREATE_TICKET_ERROR", message: "Unable to create Ticket." } });
        return jsonResponse(201, {
          id: 501,
          ticketNumber: "TTK-20260918-0501",
          clientRequestId: createBodies[1]?.clientRequestId,
          requesterId: requester.id,
          categoryId: 1,
          relatedSystemId: 2,
          summary: "Retry safe Requester Ticket",
          description: "This Ticket retry must reuse the same client request UUID value.",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          currentStatus: "NEW",
          currentStatusLabel: "New",
          owner: null,
          replayed: false,
          createdAt: "2026-09-18T12:00:00.000Z",
        });
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: /Create Ticket/i });
    await screen.findByRole("option", { name: "Hardware" });
    await screen.findByRole("option", { name: "Corporate Laptop" });
    await user.selectOptions(screen.getByLabelText(/Category/i), "1");
    await user.selectOptions(screen.getByLabelText(/Related System/i), "2");
    await user.type(screen.getByLabelText(/Ticket Summary/i), "Retry safe Requester Ticket");
    await user.type(screen.getByLabelText(/^Description/i), "This Ticket retry must reuse the same client request UUID value.");
    await user.click(screen.getByRole("button", { name: /Submit Ticket/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to create ticket/i);

    await user.click(screen.getByRole("button", { name: /Submit Ticket/i }));
    expect(await screen.findByText(/Ticket created successfully/i)).toBeInTheDocument();

    expect(createBodies).toHaveLength(2);
    expect(createBodies[0]).not.toHaveProperty("requesterId");
    expect(createBodies[1]).not.toHaveProperty("requesterId");
    expect(createBodies[0].clientRequestId).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
    expect(createBodies[1].clientRequestId).toBe(createBodies[0].clientRequestId);
  });
});
