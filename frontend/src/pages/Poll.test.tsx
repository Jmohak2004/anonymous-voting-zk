import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const ME = "0x00000000000000000000000000000000000000Aa";
const mocks = vi.hoisted(() => ({
  wallet: { address: undefined as string | undefined, signer: {} as any, chainOk: true, readProvider: {} as any },
  poll: {} as any,
  commitments: [] as bigint[],
  fetchError: undefined as any,
}));
vi.mock("../wallet", () => ({ useWallet: () => mocks.wallet }));
vi.mock("../lib/contract", async (orig) => ({
  ...(await orig<typeof import("../lib/contract")>()),
  getVotingContract: () => ({ getCommitments: async () => mocks.commitments, getTally: async () => [0n, 0n], on: () => {}, removeAllListeners: () => {} }),
  fetchPoll: async () => { if (mocks.fetchError) throw mocks.fetchError; return mocks.poll; },
}));

import Poll from "./Poll";
import { identityScope, saveIdentity } from "../lib/identityStore";
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
    mocks.fetchError = undefined;
  });

  it("a poll that does not exist on-chain shows poll-not-found with a link back", async () => {
    mocks.fetchError = Object.assign(new Error("x"), { revert: { name: "PollNotFound" } });
    setup();
    expect(await screen.findByText(/poll not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to all polls/i })).toHaveAttribute("href", "/");
  });

  it("a loaded poll links back to all polls", async () => {
    setup();
    await screen.findByText("Lunch?");
    expect(screen.getByRole("link", { name: /all polls/i })).toHaveAttribute("href", "/");
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

  it("registered voters can still back up their identity once voting has opened", async () => {
    saveIdentity(DEPLOYMENT.chainId, identityScope(DEPLOYMENT.voting, ME), 0n, { nullifier: 1n, trapdoor: 2n, commitment: 3n });
    mocks.commitments = [3n];
    mocks.poll = { ...basePoll, phase: "Voting", memberCount: 1 };
    setup();
    expect(await screen.findByLabelText(/identity backup export/i)).toBeInTheDocument();
  });

  it("an identity stored for a different account is not used", async () => {
    saveIdentity(DEPLOYMENT.chainId, identityScope(DEPLOYMENT.voting, "0x00000000000000000000000000000000000000Cc"), 0n, { nullifier: 1n, trapdoor: 2n, commitment: 3n });
    mocks.commitments = [3n];
    mocks.poll = { ...basePoll, memberCount: 1 };
    setup();
    await screen.findByText("Lunch?");
    expect(screen.queryByText(/you are registered/i)).toBeNull();
    expect(screen.getByRole("button", { name: /register to vote/i })).toBeInTheDocument();
  });

  it("an address with a stored identity that is in the tree sees a registered notice", async () => {
    saveIdentity(DEPLOYMENT.chainId, identityScope(DEPLOYMENT.voting, ME), 0n, { nullifier: 1n, trapdoor: 2n, commitment: 3n });
    mocks.commitments = [3n];
    mocks.poll = { ...basePoll, memberCount: 1 };
    setup();
    await waitFor(() => expect(screen.getByText(/you are registered/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /register to vote/i })).toBeNull();
  });
});
