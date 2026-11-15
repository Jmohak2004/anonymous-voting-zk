// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { submitVote, NoIdentityError } from "./vote";
import { saveIdentity, StorageLike } from "./identityStore";

function fakeStorage(): StorageLike {
  const d = new Map<string, string>();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}
const V = "0x0000000000000000000000000000000000000001";
const id = { nullifier: 11n, trapdoor: 22n, commitment: 33n };
const proof = { a: ["1", "2"], b: [["3", "4"], ["5", "6"]], c: ["7", "8"], nullifierHash: 99n };

function deps(storage: StorageLike) {
  const castVote = vi.fn(async () => ({ wait: async () => ({}) }));
  const prover = vi.fn(async () => proof as any);
  const reader = { getCommitments: vi.fn(async () => [5n, 33n, 44n]) };
  return {
    castVote, prover,
    args: {
      voting: { castVote } as any, reader: reader as any, chainId: 31337, votingAddress: V,
      pollId: 4n, option: 1n, storage, prover,
    },
  };
}

describe("submitVote", () => {
  it("throws NoIdentityError when no identity is stored", async () => {
    const d = deps(fakeStorage());
    await expect(submitVote(d.args)).rejects.toBeInstanceOf(NoIdentityError);
    expect(d.prover).not.toHaveBeenCalled();
  });

  it("passes commitments in on-chain order and the chosen option to the prover, then casts the vote", async () => {
    const storage = fakeStorage();
    saveIdentity(31337, V, 4n, id, storage);
    const d = deps(storage);
    const stages: string[] = [];
    await submitVote({ ...d.args, onStage: (s) => stages.push(s) });
    expect(d.prover).toHaveBeenCalledWith(id, [5n, 33n, 44n], 4n, 1n, expect.objectContaining({ wasm: expect.any(String), zkey: expect.any(String) }));
    expect(d.castVote).toHaveBeenCalledWith(4n, 1n, 99n, proof.a, proof.b, proof.c);
    expect(stages).toEqual(["proving", "sending"]);
  });
});
