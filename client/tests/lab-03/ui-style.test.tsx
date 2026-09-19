import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const requester = {
  id: 31,
  name: "Visual Requester",
  email: "visual.requester@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
} as const;

const admin = {
  id: 90,
  name: "Visual Administrator",
  email: "visual.admin@example.test",
  role: "ADMINISTRATOR",
  mustChangePassword: false,
} as const;

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function urlOf(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

describe("Lab 3 Zen Green style and accessibility contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.location.hash = "";
  });

  it("STYLE-01 keeps Login labelled, keyboard reachable, Zen Green, and free of the Development Requester selector", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (urlOf(input).endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "UNAUTHENTICATED" } });
      return jsonResponse(404, { error: { code: "NOT_FOUND" } });
    });
    const user = userEvent.setup();
    render(<App />);

    const email = await screen.findByLabelText("Email");
    const password = screen.getByLabelText("Password");
    const signIn = screen.getByRole("button", { name: "Sign In" });
    expect(document.querySelector(".auth-card")).toBeInTheDocument();
    expect(signIn).toHaveClass("btn-success");
    expect(screen.queryByText(/Development Requester/i)).not.toBeInTheDocument();

    email.focus();
    expect(email).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(password).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(signIn).toHaveFocus();
  });

  it("STYLE-01 renders authenticated Requester identity as read-only treatment while editable controls stay normal", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = urlOf(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: requester, csrfToken: "visual-csrf" });
      if (url.endsWith("/api/categories")) return jsonResponse(200, [{ id: 1, name: "Hardware" }]);
      if (url.endsWith("/api/related-systems")) return jsonResponse(200, [{ id: 1, name: "Corporate Laptop" }]);
      return jsonResponse(404, { error: { code: "NOT_FOUND" } });
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    const readOnly = screen.getByText(`${requester.name} (${requester.email})`).closest(".readonly-field");
    expect(readOnly).not.toBeNull();
    expect(readOnly).toHaveClass("readonly-field");
    expect(document.getElementById("ticket-summary")).toHaveClass("form-control");
    expect(screen.getByText("Requester", { selector: ".role-badge" })).toBeInTheDocument();
  });

  it("STYLE-01 keeps Administrator role/status meaning textual and omits excluded destructive User deletion", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = urlOf(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: admin, csrfToken: "visual-admin-csrf" });
      if (url.includes("/api/admin/users")) return jsonResponse(200, [{
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: true,
        createdAt: "2026-09-19T00:00:00.000Z",
        updatedAt: "2026-09-19T00:00:00.000Z",
      }]);
      return jsonResponse(404, { error: { code: "NOT_FOUND" } });
    });
    window.location.hash = "#user-management";
    render(<App />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByText("Administrator", { selector: ".auth-identity .role-badge" })).toBeInTheDocument();
    expect((await screen.findAllByText("Active", { selector: ".admin-status-badge" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Delete User/i })).not.toBeInTheDocument();
  });
});
