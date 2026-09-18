import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const requiredUser = {
  id: 21,
  name: "First Login User",
  email: "first.login@example.test",
  role: "REQUESTER",
  mustChangePassword: true,
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function authFetch(handler?: (url: string, init?: RequestInit) => Promise<Response> | Response | undefined) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (handler) {
      const result = handler(url, init);
      if (result !== undefined) return Promise.resolve(result);
    }
    if (url.endsWith("/api/auth/me")) {
      return Promise.resolve(jsonResponse(200, { user: requiredUser, csrfToken: "csrf-initial-token" }));
    }
    return Promise.resolve(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } }));
  });
}

describe("Lab 3 mandatory Change Password", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("UI-02 blocks the normal app and shows the approved first-password-change form and rules", async () => {
    authFetch();
    render(<App />);

    expect(await screen.findByRole("heading", { name: /Change Password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Current|Initial Password/i)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/^New Password/i)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/Confirm New Password/i)).toHaveAttribute("type", "password");
    expect(screen.getAllByText(/12-128 characters/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/must differ/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save|Change Password/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Logout/i })).toBeInTheDocument();
    expect(screen.queryByText(/Create Ticket|My Tickets|Ticket Queue|User Management/i)).not.toBeInTheDocument();
  });

  it("UI-02 validates password length, current-password difference, and confirmation before sending", async () => {
    const fetchSpy = authFetch();
    const user = userEvent.setup();
    render(<App />);

    const current = await screen.findByLabelText(/Current|Initial Password/i);
    const next = screen.getByLabelText(/^New Password/i);
    const confirm = screen.getByLabelText(/Confirm New Password/i);
    await user.type(current, "Lab3-ChangeMe-2026");
    await user.type(next, "Short-123");
    await user.type(confirm, "Different-Lab3-Password-2026");
    await user.click(screen.getByRole("button", { name: /Save|Change Password/i }));

    expect(screen.getAllByText(/12-128 characters/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/confirmation.*match|passwords.*match/i).length).toBeGreaterThan(0);
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/api/auth/change-password"))).toBe(false);
  });

  it("UI-02 sends the exact passwords with credentials and CSRF and shows a saving state", async () => {
    let resolveChange!: (value: Response) => void;
    const fetchSpy = authFetch((url) => {
      if (url.endsWith("/api/auth/change-password")) return new Promise<Response>((resolve) => { resolveChange = resolve; });
      return undefined;
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/Current|Initial Password/i), "Lab3-ChangeMe-2026");
    await user.type(screen.getByLabelText(/^New Password/i), "Changed-Lab3-Password-2026");
    await user.type(screen.getByLabelText(/Confirm New Password/i), "Changed-Lab3-Password-2026");
    await user.click(screen.getByRole("button", { name: /Save|Change Password/i }));

    expect(screen.getByRole("button", { name: /Saving/i })).toBeDisabled();
    const call = fetchSpy.mock.calls.find(([input]) => String(input).includes("/api/auth/change-password"));
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(new Headers(call?.[1]?.headers).get("X-CSRF-Token")).toBe("csrf-initial-token");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      currentPassword: "Lab3-ChangeMe-2026",
      newPassword: "Changed-Lab3-Password-2026",
      confirmPassword: "Changed-Lab3-Password-2026",
    });
    resolveChange(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Unable to change password." } }));
  });

  it("UI-02 keeps the gate and shows safe server feedback when password change fails", async () => {
    authFetch((url) => {
      if (url.endsWith("/api/auth/change-password")) {
        return jsonResponse(401, { error: { code: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect." } });
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/Current|Initial Password/i), "Wrong-Lab3-Password");
    await user.type(screen.getByLabelText(/^New Password/i), "Changed-Lab3-Password-2026");
    await user.type(screen.getByLabelText(/Confirm New Password/i), "Changed-Lab3-Password-2026");
    await user.click(screen.getByRole("button", { name: /Save|Change Password/i }));

    expect(await screen.findByText(/Current password is incorrect/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Change Password/i })).toBeInTheDocument();
  });

  it("UI-02 leaves the mandatory gate after a successful change and uses the rotated authenticated state", async () => {
    authFetch((url) => {
      if (url.endsWith("/api/auth/change-password")) {
        return jsonResponse(200, {
          user: { ...requiredUser, mustChangePassword: false },
          csrfToken: "csrf-rotated-token",
        });
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/Current|Initial Password/i), "Lab3-ChangeMe-2026");
    await user.type(screen.getByLabelText(/^New Password/i), "Changed-Lab3-Password-2026");
    await user.type(screen.getByLabelText(/Confirm New Password/i), "Changed-Lab3-Password-2026");
    await user.click(screen.getByRole("button", { name: /Save|Change Password/i }));

    expect(await screen.findByText(requiredUser.name)).toBeInTheDocument();
    expect(screen.getByText(/Password changed successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Change Password/i })).not.toBeInTheDocument();
  });
});
