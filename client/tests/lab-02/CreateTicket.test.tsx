import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

function mockRequester() {
  vi.spyOn(api, "getRequesters").mockResolvedValue([
    { id: 1, name: "Anong Student", email: "anong.student@example.test" },
  ]);
}

async function selectRequester() {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), "1");
  await user.click(screen.getByRole("button", { name: /Continue/i }));
  return user;
}

describe("Create Ticket workflow", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows requester read-only field and required Create Ticket controls", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);

    await selectRequester();

    expect(await screen.findByRole("heading", { name: /Create Ticket/i })).toBeInTheDocument();
    expect(screen.getByText(/Anong Student \(anong.student@example.test\)/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Category/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Related System/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Ticket Summary/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Requested Priority/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Description/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Attachments/i)).toBeInTheDocument();
  });

  it("shows validation messages before sending invalid create data", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
    const createTicket = vi.spyOn(api, "createTicket").mockResolvedValue({} as api.CreatedTicket);
    const user = await selectRequester();

    await user.click(await screen.findByRole("button", { name: /Submit Ticket/i }));

    expect(screen.getByText(/Category is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Related System is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Summary is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Description is required/i)).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("preserves form values when the create API fails before Ticket creation", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Corporate Laptop" }]);
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("Unable to create Ticket."));
    const user = await selectRequester();

    await user.selectOptions(await screen.findByRole("combobox", { name: /Category/i }), "1");
    await user.selectOptions(screen.getByRole("combobox", { name: /Related System/i }), "2");
    await user.type(screen.getByRole("textbox", { name: /Ticket Summary/i }), "Laptop battery drains quickly");
    await user.type(screen.getByRole("textbox", { name: /Description/i }), "Battery drops during class.");
    await user.click(screen.getByRole("button", { name: /Submit Ticket/i }));

    expect(await screen.findByText(/Unable to create ticket/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Laptop battery drains quickly/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Battery drops during class/i)).toBeInTheDocument();
  });

  it("shows success with backend Ticket Number after valid submit", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Corporate Laptop" }]);
    vi.spyOn(api, "createTicket").mockResolvedValue({
      id: 10,
      ticketNumber: "TTK-20260904-0001",
      currentStatusLabel: "New",
    } as api.CreatedTicket);
    const user = await selectRequester();

    await user.selectOptions(await screen.findByRole("combobox", { name: /Category/i }), "1");
    await user.selectOptions(screen.getByRole("combobox", { name: /Related System/i }), "2");
    await user.type(screen.getByRole("textbox", { name: /Ticket Summary/i }), "Laptop battery drains quickly");
    await user.type(screen.getByRole("textbox", { name: /Description/i }), "Battery drops during class.");
    await user.click(screen.getByRole("button", { name: /Submit Ticket/i }));

    expect(await screen.findByText(/Ticket created successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/TTK-20260904-0001/i)).toBeInTheDocument();
  });

  it("shows invalid attachment and post-create upload failure retry guidance", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Corporate Laptop" }]);
    vi.spyOn(api, "createTicket").mockResolvedValue({
      id: 10,
      ticketNumber: "TTK-20260904-0001",
      currentStatusLabel: "New",
    } as api.CreatedTicket);
    vi.spyOn(api, "uploadTicketAttachment").mockRejectedValue(new Error("Only JPG, JPEG, PNG, WEBP, and PDF files are allowed."));
    const user = await selectRequester();

    await user.upload(await screen.findByLabelText(/Attachments/i), new File(["bad"], "malware.exe"));
    expect(screen.getByText(/Only JPG, JPEG, PNG, WEBP, and PDF files are allowed/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText(/Attachments/i), new File(["pdf"], "evidence.pdf", { type: "application/pdf" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: /Category/i }), "1");
    await user.selectOptions(screen.getByRole("combobox", { name: /Related System/i }), "2");
    await user.type(screen.getByRole("textbox", { name: /Ticket Summary/i }), "Laptop battery drains quickly");
    await user.type(screen.getByRole("textbox", { name: /Description/i }), "Battery drops during class.");
    await user.click(screen.getByRole("button", { name: /Submit Ticket/i }));

    expect(await screen.findByText(/Some attachments could not be uploaded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry evidence.pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove evidence.pdf/i })).toBeInTheDocument();
    await waitFor(() => expect(api.createTicket).toHaveBeenCalledTimes(1));
  });
});
