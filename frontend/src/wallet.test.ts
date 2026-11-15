// @vitest-environment node
import { describe, it, expect } from "vitest";
import { listDevWallets } from "./wallet";

describe("dev wallets", () => {
  it("returns 10 distinct Hardhat addresses when enabled", () => {
    const wallets = listDevWallets(true);
    expect(wallets).toHaveLength(10);
    expect(new Set(wallets.map((w) => w.address)).size).toBe(10);
    expect(wallets[0].address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });

  it("returns an empty list when disabled", () => {
    expect(listDevWallets(false)).toEqual([]);
  });
});
