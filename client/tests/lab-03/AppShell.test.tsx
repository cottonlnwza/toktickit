import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const currentUser = {
  id: 31,
  name: "Authenticated User",
  email: "authenticated.user@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockAuthenticatedFetch(user = currentUser) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith("/api/auth/me")) {
      return Promise.resolve(jsonResponse(200, { user, csrfToken: "shell-csrf-token" }));
    }
    if (url.endsWith("/api/auth/logout")) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.endsWith("/api/requesters")) {
      return Promise.resolve(jsonResponse(200, []));
    }
    return Promise.resolve(jsonResponse(200, []));
  });
}

describe("Lab 3 authenticated application shell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("UI-03 shows the current authenticated user name, role, Logout, and Change Password access", async () => {
    mockAuthenticatedFetch();
    render(<App />);

    expect(await screen.findByText(currentUser.name)).toBeInTheDocument();
    expect(screen.getByText("Requester", { selector: ".role-badge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Logout/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change Password/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("href", "#my-tickets");
    expect(screen.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("href", "#create-ticket");
    expect(screen.queryByText("Ticket Queue")).not.toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });

  it.each([
    ["IT_STAFF", "IT Staff", "Ticket Queue", "My Tickets", "User Management"],
    ["ADMINISTRATOR", "Administrator", "User Management", "My Tickets", "Ticket Queue"],
  ])("UI-03 exposes only the %s shell navigation", async (role, roleLabel, allowed, forbiddenOne, forbiddenTwo) => {
    mockAuthenticatedFetch({ ...currentUser, role });
    render(<App />);

    expect(await screen.findByText(roleLabel)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: allowed })).toBeInTheDocument();
    expect(screen.queryByText(forbiddenOne)).not.toBeInTheDocument();
    expect(screen.queryByText(forbiddenTwo)).not.toBeInTheDocument();
  });

  it("UI-03 logs out with credentials and CSRF, then removes authenticated shell access", async () => {
    const fetchSpy = mockAuthenticatedFetch();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Logout/i }));

    const logoutCall = fetchSpy.mock.calls.find(([input]) => String(input).includes("/api/auth/logout"));
    expect(logoutCall).toBeDefined();
    expect(logoutCall?.[1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(new Headers(logoutCall?.[1]?.headers).get("X-CSRF-Token")).toBe("shell-csrf-token");
    expect(await screen.findByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.queryByText(currentUser.name)).not.toBeInTheDocument();
  });

  it("UI-03 keeps authenticated access visible and shows safe feedback when logout fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) return Promise.resolve(jsonResponse(200, { user: currentUser, csrfToken: "shell-csrf-token" }));
      if (url.endsWith("/api/auth/logout")) return Promise.reject(new Error("network details must stay hidden"));
      return Promise.resolve(jsonResponse(404, {}));
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Logout/i }));

    expect(await screen.findByText(/Unable to sign out.*try again/i)).toBeInTheDocument();
    expect(screen.getByText(currentUser.name)).toBeInTheDocument();
    expect(screen.queryByText(/network details/i)).not.toBeInTheDocument();
  });

  it("UI-03 treats an invalid direct session as unauthenticated instead of rendering protected shell identity", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/api/auth/me")) {
        return Promise.resolve(jsonResponse(401, { error: { code: "AUTH_REQUIRED", message: "Authentication required." } }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
    render(<App />);

    expect(await screen.findByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.queryByText(currentUser.name)).not.toBeInTheDocument();
  });
});
