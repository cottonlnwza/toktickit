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

  it("loads Create Ticket references when requester is restored from localStorage", async () => {
    localStorage.setItem("toktickit.devRequesterId", "1");
    mockRequester();
    const getCategories = vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    const getRelatedSystems = vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);

    render(<App />);

    expect(await screen.findByRole("heading", { name: /Create Ticket/i })).toBeInTheDocument();
    expect(getCategories).toHaveBeenCalled();
    expect(getRelatedSystems).toHaveBeenCalled();
    expect(await screen.findByRole("option", { name: /Hardware/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Corporate Laptop/i })).toBeInTheDocument();
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

  it("enforces Summary and Description boundary messages before submit", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
    const createTicket = vi.spyOn(api, "createTicket").mockResolvedValue({} as api.CreatedTicket);
    const user = await selectRequester();

    await user.selectOptions(await screen.findByRole("combobox", { name: /Category/i }), "1");
    await user.selectOptions(screen.getByRole("combobox", { name: /Related System/i }), "1");
    await user.type(screen.getByRole("textbox", { name: /Ticket Summary/i }), "1234");
    await user.type(screen.getByRole("textbox", { name: /Description/i }), "too short");
    await user.click(screen.getByRole("button", { name: /Submit Ticket/i }));

    expect(screen.getByText(/Summary must be 5-120 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Description must be 20-2000 characters/i)).toBeInTheDocument();
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

  it("shows reference loading failure clearly", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockRejectedValue(new Error("down"));
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Corporate Laptop" }]);

    await selectRequester();

    expect(await screen.findByText(/Unable to load Create Ticket reference data/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit Ticket/i })).toBeDisabled();
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
    expect(screen.getAllByText(/TTK-20260904-0001/i).length).toBeGreaterThanOrEqual(1);
  });

  it("blocks duplicate submit while the first create request is processing", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Corporate Laptop" }]);
    const createTicket = vi.spyOn(api, "createTicket").mockReturnValue(new Promise(() => undefined));
    const user = await selectRequester();

    await user.selectOptions(await screen.findByRole("combobox", { name: /Category/i }), "1");
    await user.selectOptions(screen.getByRole("combobox", { name: /Related System/i }), "2");
    await user.type(screen.getByRole("textbox", { name: /Ticket Summary/i }), "Laptop battery drains quickly");
    await user.type(screen.getByRole("textbox", { name: /Description/i }), "Battery drops during class.");
    await user.click(screen.getByRole("button", { name: /Submit Ticket/i }));

    expect(screen.getByRole("button", { name: /Submitting/i })).toBeDisabled();
    expect(createTicket).toHaveBeenCalledTimes(1);
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

  it("shows an attachment validation message instead of silently dropping files over the max-five limit", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Corporate Laptop" }]);
    const user = await selectRequester();

    await user.upload(screen.getByLabelText(/Attachments/i), [
      new File(["1"], "one.pdf", { type: "application/pdf" }),
      new File(["2"], "two.pdf", { type: "application/pdf" }),
      new File(["3"], "three.pdf", { type: "application/pdf" }),
      new File(["4"], "four.pdf", { type: "application/pdf" }),
      new File(["5"], "five.pdf", { type: "application/pdf" }),
      new File(["6"], "six.pdf", { type: "application/pdf" }),
    ]);

    expect(screen.getByText(/A Ticket may have at most five active attachments/i)).toBeInTheDocument();
    expect(screen.queryByText(/six.pdf/i)).not.toBeInTheDocument();
  });

  it("clears Create Ticket state when Cancel or Change Requester is used", async () => {
    mockRequester();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Corporate Laptop" }]);
    const user = await selectRequester();

    await user.type(await screen.findByRole("textbox", { name: /Ticket Summary/i }), "Laptop battery drains quickly");
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.getByRole("textbox", { name: /Ticket Summary/i })).toHaveValue("");

    await user.type(screen.getByRole("textbox", { name: /Ticket Summary/i }), "Laptop battery drains quickly");
    await user.click(screen.getByRole("button", { name: /Change Requester/i }));
    expect(screen.getByText(/Select Development Requester/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Laptop battery drains quickly/i)).not.toBeInTheDocument();
  });
});
