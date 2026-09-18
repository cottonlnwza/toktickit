import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return Promise.resolve(handler(url, init));
  });
}

describe("Lab 3 Login", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("UI-01 shows only the approved email/password login controls when no valid session exists", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } });
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found." } });
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /TokTickIT/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.queryByText(/Select Development Requester/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Forgot Password|Reset Password|Sign up|Register|Google|Facebook/i)).not.toBeInTheDocument();
  });

  it("UI-01 validates required login fields on the client before sending a login request", async () => {
    const fetchSpy = mockFetch((url) => {
      if (url.endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } });
      return jsonResponse(500, { error: { code: "UNEXPECTED_ERROR", message: "Unexpected error." } });
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Sign In/i }));

    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/api/auth/login"))).toBe(false);
  });

  it("UI-01 rejects a malformed email before sending credentials", async () => {
    const fetchSpy = mockFetch((url) => {
      if (url.endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } });
      return jsonResponse(500, {});
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByRole("textbox", { name: /Email/i }), "not-an-email");
    await user.type(screen.getByLabelText(/Password/i), "Lab3-ChangeMe-2026");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/api/auth/login"))).toBe(false);
  });

  it.each([
    [true, /Change Password/i],
    [false, /Authenticated User/i],
  ])("UI-01 routes a valid login according to mustChangePassword=%s", async (mustChangePassword, expected) => {
    mockFetch((url) => {
      if (url.endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } });
      if (url.endsWith("/api/auth/login")) {
        return jsonResponse(200, {
          user: {
            id: 44,
            name: "Authenticated User",
            email: "auth.user@example.test",
            role: "REQUESTER",
            mustChangePassword,
          },
          csrfToken: "csrf-after-login",
        });
      }
      return jsonResponse(404, {});
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByRole("textbox", { name: /Email/i }), "auth.user@example.test");
    await user.type(screen.getByLabelText(/Password/i), "Lab3-ChangeMe-2026");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it("UI-01 disables the form and shows signing-in feedback while login is pending", async () => {
    let resolveLogin!: (value: Response) => void;
    mockFetch((url) => {
      if (url.endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } });
      if (url.endsWith("/api/auth/login")) return new Promise<Response>((resolve) => { resolveLogin = resolve; });
      return jsonResponse(404, {});
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByRole("textbox", { name: /Email/i }), "auth.active@example.test");
    await user.type(screen.getByLabelText(/Password/i), "Lab3-ChangeMe-2026");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(screen.getByRole("button", { name: /Signing in/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Email/i })).toBeDisabled();
    expect(screen.getByLabelText(/Password/i)).toBeDisabled();
    resolveLogin(jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } }));
  });

  it.each([
    [401, "INVALID_CREDENTIALS", /Invalid email or password/i],
    [403, "ACCOUNT_INACTIVE", /inactive/i],
    [429, "LOGIN_THROTTLED", /try again later/i],
  ])("UI-01 shows safe documented feedback for HTTP %s login failures", async (status, code, expected) => {
    mockFetch((url) => {
      if (url.endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } });
      if (url.endsWith("/api/auth/login")) {
        const message = code === "INVALID_CREDENTIALS"
          ? "Invalid email or password."
          : code === "ACCOUNT_INACTIVE"
            ? "This account is inactive."
            : "Too many login attempts. Please try again later.";
        return jsonResponse(status, { error: { code, message } });
      }
      return jsonResponse(404, {});
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByRole("textbox", { name: /Email/i }), "user@example.test");
    await user.type(screen.getByLabelText(/Password/i), "Wrong-Lab3-Password");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/passwordHash|tokenHash|csrfTokenHash/i)).not.toBeInTheDocument();
  });

  it("UI-01 shows a safe retry message for a network/API failure", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/auth/me")) return jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } });
      if (url.endsWith("/api/auth/login")) return Promise.reject(new Error("network details that must not be displayed"));
      return jsonResponse(404, {});
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByRole("textbox", { name: /Email/i }), "user@example.test");
    await user.type(screen.getByLabelText(/Password/i), "Lab3-ChangeMe-2026");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(await screen.findByText(/Unable to sign in.*try again/i)).toBeInTheDocument();
    expect(screen.queryByText(/network details/i)).not.toBeInTheDocument();
  });
});
