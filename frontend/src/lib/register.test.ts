// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { registerFlow } from "./register";
import { loadIdentity, StorageLike } from "./identityStore";

function fakeStorage(): StorageLike {
  const d = new Map<string, string>();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}
const V = "0x0000000000000000000000000000000000000001";

describe("registerFlow", () => {
  it("saves the identity BEFORE sending the tx and keeps it on success", async () => {
    const storage = fakeStorage();
    let savedAtCallTime = false;
    const voting = {
      register: vi.fn(async (_poll: bigint, commitment: bigint) => {
        savedAtCallTime = loadIdentity(31337, V, 2n, storage)?.commitment === commitment;
        return { wait: async () => ({}) };
      }),
    };
    const id = await registerFlow({ voting: voting as any, chainId: 31337, votingAddress: V, pollId: 2n, storage });
    expect(savedAtCallTime).toBe(true);
    expect(voting.register).toHaveBeenCalledWith(2n, id.commitment);
    expect(loadIdentity(31337, V, 2n, storage)).toEqual(id);
  });

  it("removes the saved identity and rethrows when the tx is rejected", async () => {
    const storage = fakeStorage();
    const voting = { register: vi.fn().mockRejectedValue(new Error("user rejected")) };
    await expect(
      registerFlow({ voting: voting as any, chainId: 31337, votingAddress: V, pollId: 2n, storage })
    ).rejects.toThrow("user rejected");
    expect(loadIdentity(31337, V, 2n, storage)).toBeNull();
  });

  it("keeps the identity when the tx was broadcast but confirmation fails", async () => {
    const storage = fakeStorage();
    const voting = { register: vi.fn(async () => ({ wait: async () => { throw new Error("TRANSACTION_REPLACED"); } })) };
    await expect(
      registerFlow({ voting: voting as any, chainId: 31337, votingAddress: V, pollId: 2n, storage })
    ).rejects.toThrow("TRANSACTION_REPLACED");
    expect(loadIdentity(31337, V, 2n, storage)).not.toBeNull(); // commitment may be on-chain: never drop the secret
  });

  it("does not send a tx when the identity cannot be saved", async () => {
    const broken: StorageLike = { getItem: () => null, setItem: () => { throw new Error("denied"); }, removeItem: () => {} };
    const voting = { register: vi.fn() };
    await expect(
      registerFlow({ voting: voting as any, chainId: 31337, votingAddress: V, pollId: 2n, storage: broken })
    ).rejects.toThrow();
    expect(voting.register).not.toHaveBeenCalled();
  });

  it("keeps an existing identity when the failure is AlreadyRegistered", async () => {
    const storage = fakeStorage();
    const voting = { register: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { revert: { name: "AlreadyRegistered" } })) };
    const first = { nullifier: 1n, trapdoor: 2n, commitment: 3n };
    storage.setItem(`zkvote:identity:31337:${V.toLowerCase()}:2`, JSON.stringify({ nullifier: "1", trapdoor: "2", commitment: "3" }));
    await expect(
      registerFlow({ voting: voting as any, chainId: 31337, votingAddress: V, pollId: 2n, storage })
    ).rejects.toThrow();
    expect(loadIdentity(31337, V, 2n, storage)).toEqual(first);
  });
});
