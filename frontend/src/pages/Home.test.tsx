import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({ polls: [] as any[] }));
vi.mock("../wallet", () => ({ useWallet: () => ({ readProvider: {} }) }));
vi.mock("../lib/contract", async (orig) => ({
  ...(await orig<typeof import("../lib/contract")>()),
  getVotingContract: () => ({}),
  fetchPolls: async () => mocks.polls,
}));

import Home from "./Home";

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe("Home", () => {
  beforeEach(() => { mocks.polls = []; });

  it("shows an empty state with a link to create a poll", async () => {
    renderHome();
    expect(await screen.findByText(/no polls yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create the first poll/i })).toHaveAttribute("href", "/create");
  });

  it("lists polls with phase and member count, linking to each poll", async () => {
    mocks.polls = [
      { id: 1n, creator: "0x1", question: "Second?", options: ["a", "b"], phase: "Voting", memberCount: 3, root: 1n },
      { id: 0n, creator: "0x1", question: "First?", options: ["a", "b"], phase: "Registration", memberCount: 0, root: 0n },
    ];
    renderHome();
    expect(await screen.findByText("Second?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /first\?/i })).toHaveAttribute("href", "/poll/0");
    expect(screen.getByText(/3 voters/)).toBeInTheDocument();
  });
});
