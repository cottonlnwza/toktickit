import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const requester = {
  id: 31,
  name: "Authenticated Requester",
  email: "authenticated.requester@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
} as const;

const listTicket = {
  id: 42,
  ticketNumber: "TTK-20260918-0042",
  summary: "Laptop battery drains quickly",
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  currentStatusLabel: "New",
  updatedAt: "2026-09-18T09:00:00.000Z",
};

const detail = {
  ...listTicket,
  description: "The laptop battery drops during one class session.",
  requester: { id: requester.id, name: requester.name, email: requester.email },
  createdAt: "2026-09-18T08:00:00.000Z",
  attachments: [{
    id: 9,
    originalFilename: "evidence.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12,
    uploadedAt: "2026-09-18T08:30:00.000Z",
    removedAt: null,
    removalReason: null,
    state: "active",
    downloadUrl: "/download/9",
  }],
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function mockProductionRequesterApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith("/api/auth/me")) {
      return jsonResponse(200, { user: requester, csrfToken: "requester-csrf-token" });
    }
    if (url.endsWith("/api/categories")) return jsonResponse(200, [listTicket.category]);
    if (url.endsWith("/api/related-systems")) return jsonResponse(200, [listTicket.relatedSystem]);
    if (url.endsWith("/api/requesters")) {
      return jsonResponse(500, { error: "Production requester flow must not use the Development Requester selector." });
    }
    if (url.endsWith("/api/requesters/31/tickets/42/attachments") && init?.method === "POST") {
      return jsonResponse(201, {
        ...detail.attachments[0],
        id: 10,
        originalFilename: "new.pdf",
        downloadUrl: "/download/10",
      });
    }
    if (url.endsWith("/api/requesters/31/tickets/42")) return jsonResponse(200, detail);
    if (url.includes("/api/requesters/31/tickets")) {
      return jsonResponse(200, { items: [listTicket], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    }
    return jsonResponse(404, { error: "Not found" });
  });
}

describe("Lab 3 production Requester workflow continuity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.location.hash = "";
  });

  it("keeps Create Ticket, My Tickets, Ticket Detail, and Attachment workflow on the authenticated production path", async () => {
    const fetchSpy = mockProductionRequesterApi();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: /Create Ticket/i })).toBeInTheDocument();
    expect(screen.getByText(`${requester.name} (${requester.email})`)).toBeInTheDocument();
    expect(screen.getByLabelText(/Attachments/i)).toBeInTheDocument();
    expect(screen.queryByText(/Select Development Requester/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change Requester/i })).not.toBeInTheDocument();
    expect(localStorage.getItem("toktickit.devRequesterId")).toBeNull();

    const requesterListCalls = fetchSpy.mock.calls.filter(([input]) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return url.endsWith("/api/requesters");
    });
    expect(requesterListCalls).toHaveLength(0);

    const categoryCall = fetchSpy.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return url.endsWith("/api/categories");
    });
    expect(categoryCall?.[1]).toMatchObject({ credentials: "include" });

    await user.click(screen.getByRole("link", { name: /My Tickets/i }));
    expect(await screen.findByRole("heading", { name: /My Tickets/i })).toBeInTheDocument();
    expect(await screen.findAllByText(listTicket.ticketNumber)).not.toHaveLength(0);

    await user.click((await screen.findAllByRole("button", { name: /Open Ticket TTK-20260918-0042/i }))[0]);
    expect(await screen.findByRole("heading", { name: /Ticket Detail/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Attachments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download evidence.pdf/i })).toBeInTheDocument();

    await user.upload(screen.getByLabelText(/Add Attachment/i), new File(["pdf"], "new.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("new.pdf")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/requesters/31/tickets/42/attachments"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
