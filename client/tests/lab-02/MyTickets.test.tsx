import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

interface TicketListResponse {
  items: Array<{
    id: number;
    ticketNumber: string;
    summary: string;
    category: { id: number; name: string };
    relatedSystem: { id: number; name: string };
    requestedPriority: string;
    currentStatus: string;
    currentStatusLabel: string;
    updatedAt: string;
  }>;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

type MyTicketsApi = {
  getMyTickets: (requesterId: number, query?: Record<string, string | number>) => Promise<TicketListResponse>;
};

const ticketResponse: TicketListResponse = {
  items: [{
    id: 10,
    ticketNumber: "TTK-20260904-0001",
    summary: "Laptop battery drains quickly",
    category: { id: 1, name: "Hardware" },
    relatedSystem: { id: 2, name: "Corporate Laptop" },
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    currentStatusLabel: "New",
    updatedAt: "2026-09-04T08:00:00.000Z",
  }],
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
};

function mockBase() {
  vi.spyOn(api, "getRequesters").mockResolvedValue([
    { id: 1, name: "Anong Student", email: "anong.student@example.test" },
    { id: 2, name: "Burin Lecturer", email: "burin.lecturer@example.test" },
  ]);
  vi.spyOn(api, "getCategories").mockResolvedValue([
    { id: 1, name: "Hardware" },
    { id: 3, name: "Network" },
  ]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([
    { id: 2, name: "Corporate Laptop" },
    { id: 4, name: "Campus Wi-Fi" },
  ]);
}

function mockMyTickets(response: TicketListResponse | Error | "pending" = ticketResponse) {
  const mock = vi.spyOn(api as unknown as MyTicketsApi, "getMyTickets");
  if (response === "pending") return mock.mockReturnValue(new Promise(() => undefined));
  if (response instanceof Error) return mock.mockRejectedValue(response);
  return mock.mockResolvedValue(response);
}

async function selectRequesterAndOpenMyTickets(requesterId = "1") {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), requesterId);
  await user.click(screen.getByRole("button", { name: /Continue/i }));
  await user.click(screen.getByRole("link", { name: /My Tickets/i }));
  return user;
}

describe("My Tickets workflow", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows the selected Requester's paginated Ticket list", async () => {
    mockBase();
    const getMyTickets = mockMyTickets();

    await selectRequesterAndOpenMyTickets();

    expect(await screen.findByRole("heading", { name: /My Tickets/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Ticket Number/i })).toBeInTheDocument();
    expect(screen.getAllByText("TTK-20260904-0001")).toHaveLength(2);
    expect(screen.getAllByText("Laptop battery drains quickly")).toHaveLength(2);
    expect(screen.getAllByText("Hardware").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Corporate Laptop").length).toBeGreaterThanOrEqual(2);
    expect(getMyTickets).toHaveBeenCalledWith(1, expect.objectContaining({ page: 1, pageSize: 10 }));
  });

  it("provides Open Ticket controls in desktop and mobile views and shows mobile Last Updated", async () => {
    mockBase();
    mockMyTickets();

    await selectRequesterAndOpenMyTickets();
    await screen.findAllByText("TTK-20260904-0001");
    const desktop = document.querySelector(".my-tickets-table-wrap");
    const mobile = document.querySelector(".my-ticket-cards");

    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(within(desktop as HTMLElement).getByRole("button", { name: /Open Ticket TTK-20260904-0001/i })).toBeInTheDocument();
    expect(within(mobile as HTMLElement).getByRole("button", { name: /Open Ticket TTK-20260904-0001/i })).toBeInTheDocument();
    expect(within(mobile as HTMLElement).getByText("Last Updated")).toBeInTheDocument();
    expect(within(mobile as HTMLElement).getByText("2026-09-04")).toBeInTheDocument();
  });

  it("shows a loading state while owned Tickets are being retrieved", async () => {
    mockBase();
    mockMyTickets("pending");

    await selectRequesterAndOpenMyTickets();

    expect(await screen.findByText(/Loading My Tickets/i)).toBeInTheDocument();
  });

  it("distinguishes an empty owned list from filtered no-results", async () => {
    mockBase();
    const empty = { ...ticketResponse, items: [], totalItems: 0, totalPages: 0 };
    const getMyTickets = mockMyTickets(empty);
    const user = await selectRequesterAndOpenMyTickets();

    expect(await screen.findByText(/You do not have any Tickets yet/i)).toBeInTheDocument();

    getMyTickets.mockResolvedValue(empty);
    await user.type(screen.getByRole("searchbox", { name: /Search Tickets/i }), "printer");

    expect(await screen.findByText(/No Tickets match your search or filters/i)).toBeInTheDocument();
  });

  it("shows a safe failure state and retry action", async () => {
    mockBase();
    const getMyTickets = mockMyTickets(new Error("Unable to load Tickets."));
    const user = await selectRequesterAndOpenMyTickets();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to load My Tickets/i);
    getMyTickets.mockResolvedValue(ticketResponse);
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    expect(await screen.findAllByText("TTK-20260904-0001")).toHaveLength(2);
  });

  it("sends search, filter, sort, and pagination controls to the API", async () => {
    mockBase();
    const getMyTickets = mockMyTickets({ ...ticketResponse, totalPages: 2 });
    const user = await selectRequesterAndOpenMyTickets();
    await screen.findAllByText("TTK-20260904-0001");

    await user.type(screen.getByRole("searchbox", { name: /Search Tickets/i }), "laptop");
    await user.selectOptions(screen.getByRole("combobox", { name: /Category filter/i }), "1");
    await user.selectOptions(screen.getByRole("combobox", { name: /Related System filter/i }), "2");
    await user.selectOptions(screen.getByRole("combobox", { name: /Priority filter/i }), "HIGH");
    await user.selectOptions(screen.getByRole("combobox", { name: /Status filter/i }), "NEW");
    await user.selectOptions(screen.getByRole("combobox", { name: /Sort by/i }), "ticketNumber");
    await user.selectOptions(screen.getByRole("combobox", { name: /Sort direction/i }), "asc");
    await user.click(screen.getByRole("button", { name: /Next page/i }));

    await waitFor(() => expect(getMyTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({
      search: "laptop",
      categoryId: 1,
      relatedSystemId: 2,
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      sortBy: "ticketNumber",
      sortDirection: "asc",
      page: 2,
      pageSize: 10,
    })));
  });

  it("clears stale list and query state when the Requester changes", async () => {
    mockBase();
    const getMyTickets = mockMyTickets(ticketResponse);
    const user = await selectRequesterAndOpenMyTickets();
    await user.type(await screen.findByRole("searchbox", { name: /Search Tickets/i }), "old requester");

    await user.click(screen.getByRole("button", { name: /Change Requester/i }));
    expect(screen.queryByText("TTK-20260904-0001")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: /Development Requester/i }), "2");
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.click(screen.getByRole("link", { name: /My Tickets/i }));

    await waitFor(() => expect(getMyTickets).toHaveBeenLastCalledWith(2, expect.objectContaining({
      search: "",
      page: 1,
    })));
    expect(screen.getByRole("searchbox", { name: /Search Tickets/i })).toHaveValue("");
  });
});
