import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const ME = "0x00000000000000000000000000000000000000Aa";
const mocks = vi.hoisted(() => ({
  wallet: { address: undefined as string | undefined, signer: {} as any, chainOk: true, readProvider: {} as any },
  poll: {} as any,
  commitments: [] as bigint[],
}));
vi.mock("../wallet", () => ({ useWallet: () => mocks.wallet }));
vi.mock("../lib/contract", async (orig) => ({
  ...(await orig<typeof import("../lib/contract")>()),
  getVotingContract: () => ({ getCommitments: async () => mocks.commitments, getTally: async () => [0n, 0n], on: () => {}, removeAllListeners: () => {} }),
  fetchPoll: async () => mocks.poll,
}));

import Poll from "./Poll";
import { saveIdentity } from "../lib/identityStore";
import { DEPLOYMENT } from "../lib/contract";

const basePoll = {
  id: 0n, creator: "0x00000000000000000000000000000000000000bB", question: "Lunch?",
  options: ["Pizza", "Sushi"], phase: "Registration", memberCount: 0, root: 0n,
};

function setup() {
  return render(
    <MemoryRouter initialEntries={["/poll/0"]}>
      <Routes><Route path="/poll/:id" element={<Poll />} /></Routes>
    </MemoryRouter>
  );
}

describe("Poll page: registration", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.wallet = { address: ME, signer: {}, chainOk: true, readProvider: {} };
    mocks.poll = { ...basePoll };
    mocks.commitments = [];
  });

  it("shows the question and phase and a Register button during Registration", async () => {
    setup();
    expect(await screen.findByText("Lunch?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register to vote/i })).toBeInTheDocument();
  });

  it("register button is hidden outside the Registration phase", async () => {
    mocks.poll = { ...basePoll, phase: "Voting", memberCount: 2 };
    setup();
    await screen.findByText("Lunch?");
    expect(screen.queryByRole("button", { name: /register to vote/i })).toBeNull();
  });

  it("only the creator sees Close registration", async () => {
    mocks.poll = { ...basePoll, memberCount: 1 };
    setup();
    await screen.findByText("Lunch?");
    expect(screen.queryByRole("button", { name: /close registration/i })).toBeNull();
  });

  it("the creator sees Close registration", async () => {
    mocks.poll = { ...basePoll, creator: ME.toLowerCase(), memberCount: 1 };
    setup();
    expect(await screen.findByRole("button", { name: /close registration/i })).toBeEnabled();
  });

  it("an address with a stored identity that is in the tree sees a registered notice", async () => {
    saveIdentity(DEPLOYMENT.chainId, DEPLOYMENT.voting, 0n, { nullifier: 1n, trapdoor: 2n, commitment: 3n });
    mocks.commitments = [3n];
    mocks.poll = { ...basePoll, memberCount: 1 };
    setup();
    await waitFor(() => expect(screen.getByText(/you are registered/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /register to vote/i })).toBeNull();
  });
});
