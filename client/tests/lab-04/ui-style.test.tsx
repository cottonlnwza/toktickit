import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

const staff = { id: 71, name: "Style Staff", email: "staff@example.test", role: "IT_STAFF", mustChangePassword: false } as const;
const detail = {
  id: 901, ticketNumber: "TTK-L4-STYLE", summary: "Visual style", description: "Style verification",
  requester: { id: 51, name: "Requester", email: "requester@example.test" }, category: { id: 1, name: "Hardware" }, relatedSystem: { id: 10, name: "Laptop" },
  requestedPriority: "HIGH", itPriority: "URGENT", currentStatus: "OPEN", currentStatusLabel: "Open",
  owner: { id: staff.id, name: staff.name, role: "IT_STAFF" }, ownerOptions: [{ id: staff.id, name: staff.name, role: "IT_STAFF" }],
  problemAppearsResolvedAt: null, version: 4, workflowCycle: 2, createdAt: "2026-10-05T01:00:00Z", updatedAt: "2026-10-05T02:00:00Z",
  attachments: [], publicComments: [], internalNotes: [],
};
const actions = [
  { id: 1, ticketId: 901, workflowCycle: 2, clientRequestId: "1", actionDateTime: "2026-10-05T02:00:00Z", actionDescription: "Current action", result: null, status: "PLANNED", statusLabel: "Planned", assignee: { id: 71, name: "Style Staff" }, performedBy: null, followUpRequired: true, followUpNote: "Retest tomorrow", attachmentNotes: "See photo", completedAt: null, cancelledAt: null, version: 0, createdAt: "2026-10-05T02:00:00Z", updatedAt: "2026-10-05T02:00:00Z" },
  { id: 2, ticketId: 901, workflowCycle: 1, clientRequestId: "2", actionDateTime: "2026-10-04T02:00:00Z", actionDescription: "Historical action", result: "Done", status: "COMPLETED", statusLabel: "Completed", assignee: { id: 71, name: "Style Staff" }, performedBy: { id: 71, name: "Style Staff" }, followUpRequired: false, followUpNote: null, attachmentNotes: null, completedAt: "2026-10-04T03:00:00Z", cancelledAt: null, version: 1, createdAt: "2026-10-04T02:00:00Z", updatedAt: "2026-10-04T03:00:00Z" },
];
function res(status: number, body: unknown) { return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })); }
afterEach(() => { vi.restoreAllMocks(); window.location.hash = ""; });

describe("Lab 4 Zen Green UI style contract", () => {
  it("UI-05 exposes distinct current/historical Action presentation with non-color text cues", async () => {
    window.location.hash = `#staff-ticket-${detail.id}`;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return res(200, { user: staff, csrfToken: "csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`)) return res(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`)) return res(200, { items: actions });
      return res(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    render(<App />);
    const historical = (await screen.findByText("Historical action")).closest("article");
    expect(historical).toHaveClass("action-card", "historical");
    expect(screen.getByText("Cycle 1 - Historical")).toBeInTheDocument();
    expect(screen.getByText("Completed", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText("Follow-Up Required").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Yes", { exact: true }).length).toBeGreaterThanOrEqual(2);
  });

  it("UI-05 distinguishes editable form fields from read-only Action detail structure", async () => {
    window.location.hash = `#staff-ticket-${detail.id}`;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return res(200, { user: staff, csrfToken: "csrf" });
      if (url.endsWith(`/api/staff/tickets/${detail.id}`)) return res(200, detail);
      if (url.endsWith(`/api/tickets/${detail.id}/actions`)) return res(200, { items: [actions[0]] });
      return res(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    render(<App />);
    const card = (await screen.findByText("Current action")).closest("article");
    expect(card?.querySelector(".action-detail-grid")).not.toBeNull();
    expect(screen.getByLabelText(/Action Description/)).toHaveClass("form-control");
    expect(screen.getByLabelText(/^Assignee/)).toHaveClass("form-select");
    const description = screen.getByLabelText(/Action Description/) as HTMLTextAreaElement;
    expect(description.labels?.[0]?.querySelector(".required-marker")).not.toBeNull();
  });
});
