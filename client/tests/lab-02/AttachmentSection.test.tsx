import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const active = { id: 9, originalFilename: "evidence.pdf", mimeType: "application/pdf", sizeBytes: 12, uploadedAt: "2026-09-04T08:30:00.000Z", removedAt: null, removalReason: null, state: "active", downloadUrl: "/download/9" };
const removed = { ...active, id: 10, originalFilename: "old.png", removedAt: "2026-09-04T09:00:00.000Z", removalReason: "Duplicate", state: "removed", downloadUrl: undefined };
const requester = { id: 7, name: "Anong Student", email: "anong@example.test" };
const listTicket = { id: 42, ticketNumber: "TTK-20260904-0042", summary: "Laptop issue", category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Laptop" }, requestedPriority: "MEDIUM", currentStatus: "NEW", currentStatusLabel: "New", updatedAt: "2026-09-04T09:00:00.000Z" };

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function mockApi(attachments: unknown[] = [active, removed]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith("/api/requesters")) return json([requester]);
    if (url.endsWith("/api/categories")) return json([listTicket.category]);
    if (url.endsWith("/api/related-systems")) return json([listTicket.relatedSystem]);
    if (url.endsWith("/tickets/42/attachments") && init?.method === "POST") {
      return json({ ...active, originalFilename: "new.pdf" }, 201);
    }
    if (url.endsWith("/attachments/9") && init?.method === "DELETE") return json({ ...active, removedAt: "2026-09-04T10:00:00.000Z", removalReason: "Wrong file", state: "removed" });
    if (url.endsWith("/tickets/42/attachments")) return json(attachments);
    if (url.endsWith("/tickets/42")) return json({ ...listTicket, description: "Battery drops during class.", requester, createdAt: "2026-09-04T08:00:00.000Z", attachments });
    if (url.includes("/tickets")) return json({ items: [listTicket], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    return json({});
  });
}

async function openDetail() {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), "7");
  await user.click(screen.getByRole("button", { name: /Continue/i }));
  await user.click(screen.getByRole("link", { name: /My Tickets/i }));
  await user.click((await screen.findAllByRole("button", { name: /Open Ticket/i }))[0]);
  await screen.findByRole("heading", { name: /Attachments/i });
  return user;
}

describe("Ticket Detail Attachment section", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("distinguishes empty, active, and removed attachments and blocks removed download", async () => {
    mockApi();
    await openDetail();
    expect(screen.getByRole("link", { name: /Download evidence.pdf/i })).toHaveAttribute("href", "http://localhost:3000/download/9");
    expect(screen.getByText(/Active.*Uploaded 2026-09-04/i)).toBeInTheDocument();
    const removedRow = screen.getByText("old.png").closest("li");
    expect(removedRow).not.toBeNull();
    expect(within(removedRow as HTMLElement).getByText(/Uploaded 2026-09-04.*application\/pdf.*12 bytes/i)).toBeInTheDocument();
    expect(within(removedRow as HTMLElement).getByText(/Removed 2026-09-04.*Duplicate/i)).toBeInTheDocument();
    expect(within(removedRow as HTMLElement).getByText(/Download unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download old.png/i })).not.toBeInTheDocument();
  });

  it("shows an empty Attachment state", async () => {
    mockApi([]);
    await openDetail();
    expect(screen.getByText(/No attachments have been added/i)).toBeInTheDocument();
  });

  it("validates an upload and displays successful backend metadata", async () => {
    const fetch = mockApi([]);
    const user = await openDetail();
    const input = screen.getByLabelText(/Add Attachment/i);
    await user.upload(input, new File(["bad"], "malware.exe"));
    expect(screen.getByText(/Only JPG, JPEG, PNG, WEBP, and PDF/i)).toBeInTheDocument();

    await user.upload(input, new File(["pdf"], "new.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/new.pdf/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/tickets/42/attachments"), expect.objectContaining({ method: "POST" }));
  });

  it("shows uploading and safe upload-failure feedback", async () => {
    const fetch = mockApi([]);
    const user = await openDetail();
    let rejectUpload: (reason: Error) => void = () => undefined;
    fetch.mockReturnValueOnce(new Promise((_, reject) => { rejectUpload = reject; }));

    await user.upload(screen.getByLabelText(/Add Attachment/i), new File(["pdf"], "new.pdf", { type: "application/pdf" }));
    expect(screen.getByText(/Uploading/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Add Attachment/i)).toBeDisabled();

    rejectUpload(new Error("down"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to upload Attachment/i);
  });

  it("shows the specific max-five error when a sixth active Attachment is uploaded", async () => {
    const five = Array.from({ length: 5 }, (_, index) => ({
      ...active,
      id: index + 1,
      originalFilename: `evidence-${index + 1}.pdf`,
      downloadUrl: `/download/${index + 1}`,
    }));
    const fetch = mockApi(five);
    const user = await openDetail();
    fetch.mockImplementationOnce(() => json({
      error: { code: "VALIDATION_ERROR", message: "A Ticket may have at most five active attachments." },
    }, 400));

    await user.upload(screen.getByLabelText(/Add Attachment/i), new File(["six"], "sixth.pdf", { type: "application/pdf" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A Ticket may have at most five active attachments.");
    expect(screen.queryByText(/Please retry/i)).not.toBeInTheDocument();
  });

  it("requires a trimmed reason, confirms removal, and retains removed metadata", async () => {
    mockApi([active]);
    const user = await openDetail();
    await user.click(screen.getByRole("button", { name: /Remove evidence.pdf/i }));
    expect(screen.getByText(/Confirm Attachment removal/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Confirm removal/i }));
    expect(screen.getByText(/Removal reason is required/i)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Removal reason/i }), "  Wrong file  ");
    await user.click(screen.getByRole("button", { name: /Confirm removal/i }));
    expect(await screen.findByText(/Removed.*Wrong file/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download evidence.pdf/i })).not.toBeInTheDocument();
  });

  it("keeps the active Attachment available when removal fails", async () => {
    const fetch = mockApi([active]);
    fetch.mockImplementationOnce(() => json([requester]));
    const user = await openDetail();
    fetch.mockRejectedValueOnce(new Error("down"));
    await user.click(screen.getByRole("button", { name: /Remove evidence.pdf/i }));
    await user.type(screen.getByRole("textbox", { name: /Removal reason/i }), "Wrong file");
    await user.click(screen.getByRole("button", { name: /Confirm removal/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to remove Attachment/i);
    expect(screen.getByRole("link", { name: /Download evidence.pdf/i })).toBeInTheDocument();
  });
});
