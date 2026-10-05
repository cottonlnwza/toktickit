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

describe("Lab 4 Requester Dashboard", () => {
  it("UI-02 renders owned metrics, recent lists, empty resolved state, and Dashboard navigation", async () => {
    window.location.hash = "#dashboard";
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: { id: 51, name: "Requester", email: "requester@example.test", role: "REQUESTER", mustChangePassword: false }, csrfToken: "csrf" });
      if (url.endsWith("/api/dashboards/requester")) return jsonResponse(200, {
        generatedAt: "2026-10-05T12:00:00.000Z",
        metrics: { openTickets: 3, waitingForRequester: 1 },
        recentlyUpdated: [{ id: 42, ticketNumber: "TTK-42", summary: "VPN issue", status: "IN_PROGRESS", updatedAt: "2026-10-05T11:00:00.000Z", drillDown: "/tickets/42" }],
        recentlyResolved: [],
        drillDown: { openTickets: "/tickets?scope=open", waitingForRequester: "/tickets?currentStatus=WAITING_FOR_REQUESTER" },
      });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(screen.getByLabelText("Open Tickets 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Waiting for You 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Waiting for You 1")).toHaveAttribute("href", "#my-tickets?currentStatus=WAITING_FOR_REQUESTER");
    expect(screen.getByText("VPN issue")).toBeInTheDocument();
    expect(screen.getByText("No Tickets to show.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });
});
