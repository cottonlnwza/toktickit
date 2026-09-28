import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const requester = {
  id: 501,
  name: "Regression Requester",
  email: "regression.requester@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
} as const;

const ticket = {
  id: 601,
  ticketNumber: "TTK-20260919-0601",
  summary: "Preserved Requester regression flow",
  description: "The authenticated Requester must retain the Lab 2 create/list/detail/Attachment workflow.",
  requester: { id: requester.id, name: requester.name, email: requester.email },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  currentStatusLabel: "New",
  createdAt: "2026-09-19T01:00:00.000Z",
  updatedAt: "2026-09-19T01:00:00.000Z",
  problemAppearsResolvedAt: null,
  attachments: [{
    id: 71,
    originalFilename: "regression.pdf",
    mimeType: "application/pdf",
    sizeBytes: 10,
    uploadedAt: "2026-09-19T01:01:00.000Z",
    removedAt: null,
    removalReason: null,
    state: "active",
    downloadUrl: "/api/tickets/601/attachments/71/download",
  }],
};

function response(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function urlOf(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

describe("Lab 3 authenticated Lab 2 Requester UI regression", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
    localStorage.clear();
  });

  it("REG-02 preserves create/list/detail/Attachment UI without the Development Requester selector", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = urlOf(input);
      calls.push(url);
      if (url.endsWith("/api/auth/me")) return response(200, { user: requester, csrfToken: "regression-csrf" });
      if (url.endsWith("/api/categories")) return response(200, [ticket.category]);
      if (url.endsWith("/api/related-systems")) return response(200, [ticket.relatedSystem]);
      if (url.includes("/api/tickets/mine")) return response(200, { items: [ticket], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
      if (url.endsWith(`/api/tickets/${ticket.id}/comments`)) return response(200, []);
      if (url.endsWith(`/api/tickets/${ticket.id}/attachments`) && init?.method === "POST") return response(201, { ...ticket.attachments[0], id: 72, originalFilename: "new-regression.pdf", downloadUrl: "/api/tickets/601/attachments/72/download" });
      if (url.endsWith(`/api/tickets/${ticket.id}`)) return response(200, ticket);
      if (url.endsWith("/api/requesters")) return response(500, { error: { code: "FORBIDDEN", message: "Development Requester selector must not be used." } });
      return response(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByText(`${requester.name} (${requester.email})`)).toBeInTheDocument();
    expect(screen.queryByText(/Select Development Requester|Change Requester/i)).not.toBeInTheDocument();
    expect(localStorage.getItem("toktickit.devRequesterId")).toBeNull();
    expect(calls.some((url) => url.endsWith("/api/requesters"))).toBe(false);

    await user.click(screen.getByRole("link", { name: "My Tickets" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    const open = (await screen.findAllByRole("button", { name: `Open Ticket ${ticket.ticketNumber}` }))[0];
    await user.click(open);
    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(screen.getByText("regression.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download regression.pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public Comments" })).toBeInTheDocument();
    expect(screen.queryByText(/Internal Notes/i)).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText("Add Attachment"), new File(["pdf"], "new-regression.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByText("new-regression.pdf")).toBeInTheDocument());
    expect(calls.some((url) => url.includes(`/api/requesters/${requester.id}/tickets`))).toBe(false);
  });
});
