import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  wallet: { signer: undefined as any, chainOk: true },
  createPoll: vi.fn(),
}));
vi.mock("../wallet", () => ({ useWallet: () => mocks.wallet }));
vi.mock("../lib/contract", async (orig) => ({
  ...(await orig<typeof import("../lib/contract")>()),
  getVotingContract: () => ({ createPoll: mocks.createPoll }),
}));

import CreatePoll, { cleanOptions, createPollTx } from "./CreatePoll";

const receiptWith = (id: bigint) => ({
  wait: async () => ({ logs: [{ fragment: { name: "PollCreated" }, args: [id, "0xabc"] }] }),
});

describe("cleanOptions", () => {
  it("trims and drops empty options", () => {
    expect(cleanOptions([" A ", "", "  ", "B"])).toEqual(["A", "B"]);
  });
});

describe("createPollTx", () => {
  it("calls createPoll(question, options) and returns the pollId from the PollCreated event", async () => {
    const createPoll = vi.fn().mockResolvedValue(receiptWith(7n));
    const id = await createPollTx({ createPoll } as any, "Lunch?", ["Pizza", "Sushi"]);
    expect(createPoll).toHaveBeenCalledWith("Lunch?", ["Pizza", "Sushi"]);
    expect(id).toBe(7n);
  });

  it("throws when the receipt has no PollCreated event", async () => {
    const createPoll = vi.fn().mockResolvedValue({ wait: async () => ({ logs: [] }) });
    await expect(createPollTx({ createPoll } as any, "Q?", ["A", "B"])).rejects.toThrow(/PollCreated/);
  });
});

function PollStub() {
  return <div>poll page {useParams().id}</div>;
}

describe("CreatePoll form", () => {
  beforeEach(() => {
    mocks.wallet = { signer: {}, chainOk: true };
    mocks.createPoll.mockReset();
  });
  const setup = () =>
    render(
      <MemoryRouter initialEntries={["/create"]}>
        <Routes>
          <Route path="/create" element={<CreatePoll />} />
          <Route path="/poll/:id" element={<PollStub />} />
        </Routes>
      </MemoryRouter>
    );
  const submitBtn = () => screen.getByRole("button", { name: /create poll/i });

  it("submit is disabled until there is a question and at least 2 non-empty options", () => {
    setup();
    expect(submitBtn()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: "Q?" } });
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "A" } });
    expect(submitBtn()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "B" } });
    expect(submitBtn()).toBeEnabled();
  });

  it("submit is disabled without a connected wallet", () => {
    mocks.wallet = { signer: undefined, chainOk: true };
    setup();
    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: "Q?" } });
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "B" } });
    expect(submitBtn()).toBeDisabled();
  });

  it("allows at most 8 option rows", () => {
    setup();
    for (let i = 0; i < 10; i++) {
      const add = screen.getByRole("button", { name: /add option/i });
      if (!(add as HTMLButtonElement).disabled) fireEvent.click(add);
    }
    expect(screen.getByLabelText("Option 8")).toBeInTheDocument();
    expect(screen.queryByLabelText("Option 9")).toBeNull();
  });

  it("submit creates the poll and navigates to /poll/:id from the PollCreated event", async () => {
    mocks.createPoll.mockResolvedValue(receiptWith(5n));
    setup();
    fireEvent.change(screen.getByLabelText(/question/i), { target: { value: "Lunch?" } });
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "Pizza" } });
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "Sushi" } });
    fireEvent.click(submitBtn());
    await waitFor(() => expect(screen.getByText("poll page 5")).toBeInTheDocument());
    expect(mocks.createPoll).toHaveBeenCalledWith("Lunch?", ["Pizza", "Sushi"]);
  });
});
