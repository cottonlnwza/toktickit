import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
}

function mockReferenceData() {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/api/requesters")) {
      return json([{ id: 1, name: "Anong Student", email: "anong.student@example.test" }]);
    }
    if (url.endsWith("/api/categories")) return json([{ id: 1, name: "Hardware" }]);
    if (url.endsWith("/api/related-systems")) return json([{ id: 1, name: "Corporate Laptop" }]);
    return json({ status: "ok", service: "TokTickIT API" });
  });
}

async function openCreateTicket() {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), "1");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  return user;
}

describe("Lab 2 UI style and accessibility contract", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("provides the Zen Green shell and responsive layout hooks", async () => {
    mockReferenceData();
    render(<App />);

    expect(document.querySelector(".toktickit-app")).toBeInTheDocument();
    expect(document.querySelector(".app-shell")).toBeInTheDocument();
    expect(document.querySelector(".requester-panel")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Continue" })).toHaveClass("btn-success");
  });

  it("provides labelled controls, required markers, semantic states, and button hierarchy", async () => {
    mockReferenceData();
    const user = await openCreateTicket();
    const form = screen.getByRole("region", { name: "Create Ticket" });

    for (const name of ["Category", "Related System", "Requested Priority", "Ticket Summary", "Description"]) {
      expect(within(form).getByLabelText(new RegExp(name, "i"))).toBeEnabled();
    }
    expect(within(form).getAllByText("*", { selector: ".required-marker" })).toHaveLength(5);
    expect(within(form).getByRole("button", { name: "Submit Ticket" })).toHaveClass("btn-success");
    expect(within(form).getByRole("button", { name: "Cancel" })).toHaveClass("btn-outline-secondary");

    await user.click(within(form).getByRole("button", { name: "Submit Ticket" }));
    expect(within(form).getAllByText(/is required/i).length).toBeGreaterThanOrEqual(2);
    expect(within(form).getByLabelText(/Ticket Summary/i)).toHaveClass("is-invalid");
  });

  it("supports keyboard focus and identifies the active navigation destination", async () => {
    mockReferenceData();
    const user = await openCreateTicket();

    expect(screen.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBeVisible();
  });
});
