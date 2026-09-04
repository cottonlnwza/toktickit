import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("Development Requester context", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores selected requester id in local storage and shows app shell identity", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Anong Student", email: "anong.student@example.test" },
    ]);

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(localStorage.getItem("toktickit.devRequesterId")).toBe("1");
    expect(screen.getByText(/Requester: Anong Student/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change Requester/i })).toBeInTheDocument();
  });

  it("revalidates stored requester and clears invalid selections", async () => {
    localStorage.setItem("toktickit.devRequesterId", "99");
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Anong Student", email: "anong.student@example.test" },
    ]);

    render(<App />);

    expect(await screen.findByText(/Select Development Requester/i)).toBeInTheDocument();
    expect(localStorage.getItem("toktickit.devRequesterId")).toBeNull();
  });

  it("clears requester-owned screen data when changing requester", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Anong Student", email: "anong.student@example.test" },
      { id: 2, name: "Burin Lecturer", email: "burin.lecturer@example.test" },
    ]);

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await userEvent.click(screen.getByRole("button", { name: /Change Requester/i }));

    expect(screen.getByText(/Select Development Requester/i)).toBeInTheDocument();
    expect(localStorage.getItem("toktickit.devRequesterId")).toBeNull();
  });
});
