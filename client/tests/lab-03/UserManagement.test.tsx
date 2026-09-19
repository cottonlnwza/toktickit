import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const admin = { id: 90, name: "Issue 39 Admin", email: "issue39.admin@example.test", role: "ADMINISTRATOR", mustChangePassword: false } as const;
const requester = { id: 11, name: "Alice Requester", email: "alice@example.test", role: "REQUESTER", isActive: true, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" } as const;
const staff = { id: 12, name: "Sam Staff", email: "sam@example.test", role: "IT_STAFF", isActive: true, createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" } as const;

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function mockAdminFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = requestUrl(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: admin, csrfToken: "issue39-csrf" });
    if (url.includes("/api/admin/users") && method === "GET") return jsonResponse(200, [requester, staff, { ...admin, isActive: true, createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:00.000Z" }]);
    if (url.endsWith("/api/admin/users") && method === "POST") return jsonResponse(201, { id: 99, name: "New User", email: "new@example.test", role: "REQUESTER", isActive: true, mustChangePassword: true, createdAt: "2026-09-19T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z" });
    if (/\/api\/admin\/users\/\d+$/.test(url) && method === "PATCH") return jsonResponse(200, { ...staff, name: "Edited Staff", role: "REQUESTER" });
    if (/\/api\/admin\/users\/\d+\/initial-password$/.test(url) && method === "POST") return jsonResponse(200, { userId: staff.id, mustChangePassword: true });
    return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
  });
}

describe("Lab 3 Issue 7 Administrator User Management", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("UI-08 renders the minimalist User list with Name, Email, Role, Status, Edit, search, and role filter", async () => {
    mockAdminFetch();
    window.location.hash = "#user-management";
    render(<App />);

    expect(await screen.findByRole("heading", { name: /User Management/i })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /Name/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Email/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Role/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Status/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Edit/i }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Search Users/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Role Filter/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete User/i })).not.toBeInTheDocument();
  });

  it("UI-08 sends documented search/role queries and exposes create fields including exactly one role and initial password", async () => {
    const fetchSpy = mockAdminFetch();
    const user = userEvent.setup();
    window.location.hash = "#user-management";
    render(<App />);
    await screen.findByRole("heading", { name: /User Management/i });

    await user.type(screen.getByLabelText(/Search Users/i), "alice");
    await user.selectOptions(screen.getByLabelText(/Role Filter/i), "REQUESTER");
    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map(([input]) => requestUrl(input)).filter((url) => url.includes("/api/admin/users"));
      const latest = new URL(calls.at(-1)!);
      expect(latest.searchParams.get("search")).toBe("alice");
      expect(latest.searchParams.get("role")).toBe("REQUESTER");
    });

    await user.click(screen.getByRole("button", { name: /Create User/i }));
    expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Role$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Active/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Initial Password/i)).toBeInTheDocument();
  });

  it("UI-08 creates a User with CSRF and keeps the initial password out of ordinary edit payloads", async () => {
    const fetchSpy = mockAdminFetch();
    const user = userEvent.setup();
    window.location.hash = "#user-management";
    render(<App />);
    await screen.findByRole("columnheader", { name: /Name/i });

    await user.click(screen.getByRole("button", { name: /Create User/i }));
    await user.type(screen.getByLabelText(/^Name$/i), "New User");
    await user.type(screen.getByLabelText(/^Email$/i), "new@example.test");
    await user.type(screen.getByLabelText(/Initial Password/i), "Issue39-Initial-2026");
    await user.click(screen.getAllByRole("button", { name: /Create User/i }).at(-1)!);

    await waitFor(() => {
      const createCall = fetchSpy.mock.calls.find(([input, init]) => requestUrl(input).endsWith("/api/admin/users") && init?.method === "POST");
      expect(createCall).toBeDefined();
      expect(new Headers(createCall![1]?.headers).get("X-CSRF-Token")).toBe("issue39-csrf");
      expect(JSON.parse(String(createCall![1]?.body))).toEqual({
        name: "New User",
        email: "new@example.test",
        role: "REQUESTER",
        isActive: true,
        initialPassword: "Issue39-Initial-2026",
      });
    });
  });

  it("UI-08 separates ordinary profile edit from Set New Initial Password and confirms deactivation", async () => {
    mockAdminFetch();
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    window.location.hash = "#user-management";
    render(<App />);
    await screen.findByRole("heading", { name: /User Management/i });

    const desktop = await screen.findByTestId("admin-user-desktop");
    const staffRow = within(desktop).getByText(staff.email).closest("tr");
    expect(staffRow).not.toBeNull();
    await user.click(within(staffRow!).getByRole("button", { name: /Edit/i }));
    expect(screen.getByRole("heading", { name: /Edit User/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Set New Initial Password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Initial Password$/i)).not.toBeInTheDocument();

    const active = screen.getByLabelText(/Active/i);
    await user.click(active);
    expect(window.confirm).toHaveBeenCalled();
  });

  it("UI-08 submits profile edit and new initial password separately with CSRF", async () => {
    const fetchSpy = mockAdminFetch();
    const user = userEvent.setup();
    window.location.hash = "#user-management";
    render(<App />);
    const desktop = await screen.findByTestId("admin-user-desktop");
    const staffRow = within(desktop).getByText(staff.email).closest("tr");
    await user.click(within(staffRow!).getByRole("button", { name: /Edit/i }));

    const nameInput = screen.getByLabelText(/^Name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Edited Staff");
    await user.selectOptions(screen.getByLabelText(/^Role$/i), "REQUESTER");
    await user.click(screen.getByRole("button", { name: /Save User/i }));

    await waitFor(() => {
      const patchCall = fetchSpy.mock.calls.find(([input, init]) => requestUrl(input).endsWith(`/api/admin/users/${staff.id}`) && init?.method === "PATCH");
      expect(patchCall).toBeDefined();
      expect(new Headers(patchCall![1]?.headers).get("X-CSRF-Token")).toBe("issue39-csrf");
      const payload = JSON.parse(String(patchCall![1]?.body));
      expect(payload).toMatchObject({ name: "Edited Staff", role: "REQUESTER" });
      expect(payload).not.toHaveProperty("initialPassword");
    });

    await user.type(screen.getByLabelText(/Set New Initial Password/i), "Issue39-Reset-2026");
    await user.click(screen.getByRole("button", { name: /Apply New Initial Password/i }));
    await waitFor(() => {
      const resetCall = fetchSpy.mock.calls.find(([input, init]) => requestUrl(input).endsWith(`/api/admin/users/${staff.id}/initial-password`) && init?.method === "POST");
      expect(resetCall).toBeDefined();
      expect(new Headers(resetCall![1]?.headers).get("X-CSRF-Token")).toBe("issue39-csrf");
      expect(JSON.parse(String(resetCall![1]?.body))).toEqual({ initialPassword: "Issue39-Reset-2026" });
    });
  });

  it("UI-08 shows last-active-Administrator conflict feedback instead of a generic failure", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: admin, csrfToken: "issue39-csrf" });
      if (url.includes("/api/admin/users") && method === "GET") return jsonResponse(200, [{ ...admin, isActive: true, createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:00.000Z" }]);
      if (/\/api\/admin\/users\/\d+$/.test(url) && method === "PATCH") return jsonResponse(409, { error: { code: "LAST_ACTIVE_ADMIN_REQUIRED", message: "At least one active Administrator is required." } });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    const user = userEvent.setup();
    window.location.hash = "#user-management";
    render(<App />);
    const desktop = await screen.findByTestId("admin-user-desktop");
    await user.click(within(desktop).getByRole("button", { name: /Edit/i }));
    await user.selectOptions(screen.getByLabelText(/^Role$/i), "IT_STAFF");
    await user.click(screen.getByRole("button", { name: /Save User/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/At least one active Administrator is required/i);
  });

  it("UI-08 shows safe forbidden feedback to non-Administrator direct access without User list content", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: { ...staff, mustChangePassword: false }, csrfToken: "staff-csrf" });
      if (url.includes("/api/admin/users")) return jsonResponse(403, { error: { code: "FORBIDDEN", message: "This operation is not permitted for the current role." } });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    window.location.hash = "#user-management";
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/Forbidden|not permitted/i);
    expect(screen.queryByText(requester.email)).not.toBeInTheDocument();
  });

  it("UI-08 shows a safe retryable failure when Administrator User loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.endsWith("/api/auth/me")) return jsonResponse(200, { user: admin, csrfToken: "issue39-csrf" });
      if (url.includes("/api/admin/users")) return jsonResponse(500, { error: { code: "USER_MANAGEMENT_ERROR", message: "database-stack-secret" } });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });
    window.location.hash = "#user-management";
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Unable to load Users/i);
    expect(alert).not.toHaveTextContent(/database-stack-secret/i);
    expect(within(alert).getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });
});
