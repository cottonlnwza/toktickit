import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("Lab 4 Requester Dashboard", () => {
  it("UI-02 renders owned metrics, recent lists, empty resolved state, and Dashboard navigation", async () => {
    window.location.hash = "#dashboard";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: { id: 51, name: "Requester", email: "requester@example.test", role: "REQUESTER", mustChangePassword: false }, csrfToken: "csrf" });
      if (url.endsWith("/api/dashboards/requester")) return jsonResponse(200, {
        generatedAt: "2026-10-05T12:00:00.000Z",
        metrics: { openTickets: 3, waitingForRequester: 1 },
        recentlyUpdated: [{ id: 42, ticketNumber: "TTK-42", summary: "VPN issue", status: "IN_PROGRESS", updatedAt: "2026-10-05T11:00:00.000Z", drillDown: "/tickets/42" }],
        recentlyResolved: [],
        drillDown: { openTickets: "/tickets?scope=open", waitingForRequester: "/tickets?currentStatus=WAITING_FOR_REQUESTER" },
      });
      if (url.endsWith("/api/categories") || url.endsWith("/api/related-systems")) return jsonResponse(200, []);
      if (url.includes("/api/tickets/mine")) return jsonResponse(200, { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });

    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(screen.getByLabelText("Open Tickets 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Waiting for You 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Waiting for You 1")).toHaveAttribute("href", "#my-tickets?currentStatus=WAITING_FOR_REQUESTER");
    expect(screen.getByLabelText("Open Tickets 3")).toHaveAttribute("href", "#my-tickets?scope=open");
    expect(screen.getByText("VPN issue")).toBeInTheDocument();
    expect(screen.getByText("No Tickets to show.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByLabelText("Open Tickets 3"));
    await screen.findByRole("heading", { name: "My Tickets" });
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([input]) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url.includes("/api/tickets/mine?") && url.includes("scope=open");
      })).toBe(true);
    });
  });
});
