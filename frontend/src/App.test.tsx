import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("./wallet", () => ({
  useWallet: () => ({ address: undefined, devWallets: [], connect: () => {}, chainOk: true, readProvider: {} }),
}));
vi.mock("./lib/contract", async (orig) => ({
  ...(await orig<typeof import("./lib/contract")>()),
  getVotingContract: () => ({}),
  fetchPolls: async () => [],
}));

import App from "./App";

const at = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe("App routing", () => {
  it("shows a not-found page with a link home for unknown URLs", () => {
    at("/does/not/exist");
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to all polls/i })).toHaveAttribute("href", "/");
  });

  it("header links point at real routes", () => {
    at("/");
    expect(screen.getByRole("link", { name: /new poll/i })).toHaveAttribute("href", "/create");
  });

  it("a non-numeric poll id shows poll-not-found instead of crashing", () => {
    at("/poll/abc");
    expect(screen.getByText(/poll not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to all polls/i })).toHaveAttribute("href", "/");
  });
});
