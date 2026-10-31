import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const staff = { id: 71, name: "Accessible Staff", email: "staff@example.test", role: "IT_STAFF", mustChangePassword: false } as const;
const detail = {
  id: 901,
  ticketNumber: "TTK-L4-A11Y",
  summary: "Accessibility verification",
  description: "Verify accessible Actions Taken controls.",
  requester: { id: 51, name: "Requester", email: "requester@example.test" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 10, name: "Corporate Laptop" },
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "OPEN",
  currentStatusLabel: "Open",
  owner: { id: staff.id, name: staff.name, role: "IT_STAFF" },
  ownerOptions: [{ id: staff.id, name: staff.name, role: "IT_STAFF" }],
  problemAppearsResolvedAt: null,
  version: 4,
  workflowCycle: 1,
  createdAt: "2026-10-05T01:00:00.000Z",
  updatedAt: "2026-10-05T02:00:00.000Z",
  attachments: [],
  publicComments: [],
  internalNotes: [],
};

function response(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("Lab 4 accessibility hardening", () => {
  it("A11Y-01 exposes semantic navigation, active page state, and labeled controls", async () => {
    window.location.hash = `#staff-ticket-${detail.id}`;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return response(200, { user: staff, csrfToken: "csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`)) return response(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`)) return response(200, { items: [] });
      if (url.includes("/api/staff/tickets") && (!init?.method || init.method === "GET")) return response(200, { items: [], ownerOptions: detail.ownerOptions, page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
      return response(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    render(<App />);

    expect(await screen.findByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current", "page");
    expect(await screen.findByLabelText(/Action Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Assignee/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Follow-Up Required/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Action" })).toBeInTheDocument();
  });

  it("A11Y-01 programmatically associates Action validation messages with invalid fields", async () => {
    window.location.hash = `#staff-ticket-${detail.id}`;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return response(200, { user: staff, csrfToken: "csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`)) return response(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`)) return response(200, { items: [] });
      return response(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    render(<App />);
    const description = await screen.findByLabelText(/Action Description/);
    const assignee = screen.getByLabelText(/^Assignee/);

    await user.click(screen.getByRole("button", { name: "Create Action" }));
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveAttribute("aria-describedby", `action-description-error-${detail.id}`);
    expect(assignee).toHaveAttribute("aria-invalid", "true");
    expect(assignee).toHaveAttribute("aria-describedby", `action-assignee-error-${detail.id}`);

    await user.type(description, "Retest endpoint");
    await user.selectOptions(assignee, String(staff.id));
    await user.selectOptions(screen.getByLabelText(/Follow-Up Required/), "yes");
    await user.click(screen.getByRole("button", { name: "Create Action" }));
    const followUp = screen.getByLabelText(/Follow-up Note/);
    expect(followUp).toHaveAttribute("aria-invalid", "true");
    expect(followUp).toHaveAttribute("aria-describedby", `action-followup-note-error-${detail.id}`);
  });
});
