import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("Development Requester selector", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows testing-only selector text and active requester choices", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Anong Student", email: "anong.student@example.test" },
      { id: 2, name: "Burin Lecturer", email: "burin.lecturer@example.test" },
    ]);

    render(<App />);

    expect(await screen.findByText(/Select Development Requester/i)).toBeInTheDocument();
    expect(screen.getByText(/not a login screen/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Anong Student/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Burin Lecturer/i })).toBeInTheDocument();
  });

  it("blocks continue until a requester is selected", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Anong Student", email: "anong.student@example.test" },
    ]);
    const user = userEvent.setup();

    render(<App />);

    const select = await screen.findByRole("combobox", { name: /Development Requester/i });
    const continueButton = screen.getByRole("button", { name: /Continue/i });

    expect(continueButton).toBeDisabled();

    await user.selectOptions(select, "1");

    expect(continueButton).toBeEnabled();
  });

  it("shows loading, empty, and safe API error states", async () => {
    vi.spyOn(api, "getRequesters").mockReturnValue(new Promise(() => undefined));
    const { unmount } = render(<App />);
    expect(screen.getByText(/Loading active requesters/i)).toBeInTheDocument();
    unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "getRequesters").mockResolvedValue([]);
    render(<App />);
    expect(await screen.findByText(/No active Development Requesters/i)).toBeInTheDocument();
    unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "getRequesters").mockRejectedValue(new Error("network down"));
    render(<App />);
    expect(await screen.findByText(/Unable to load Development Requesters/i)).toBeInTheDocument();
  });

  it("hides selector after successful selection", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([
      { id: 1, name: "Anong Student", email: "anong.student@example.test" },
    ]);

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Development Requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: /Continue/i }));

    await waitFor(() => expect(screen.queryByText(/Select Development Requester/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Requester: Anong Student/i)).toBeInTheDocument();
  });
});
