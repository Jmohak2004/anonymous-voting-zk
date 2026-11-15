// @vitest-environment node
import { describe, it, expect } from "vitest";
import { Interface } from "ethers";
import abi from "../contracts/Voting.abi.json";
import { errorMessage } from "./register";

const sel = (name: string) => new Interface(abi).getError(name)!.selector;

describe("errorMessage", () => {
  it("uses a decoded revert name when ethers provides one", () => {
    expect(errorMessage({ revert: { name: "WrongPhase" } })).toMatch(/phase/i);
  });

  it("decodes raw revert data on a sent transaction (top-level data)", () => {
    const e = { shortMessage: "execution reverted (unknown custom error)", data: sel("NullifierUsed") };
    expect(errorMessage(e)).toMatch(/already voted/i);
  });

  it("decodes revert data nested in a JSON-RPC error", () => {
    const e = { shortMessage: "execution reverted (unknown custom error)", info: { error: { data: { data: sel("AlreadyRegistered") } } } };
    expect(errorMessage(e)).toMatch(/already registered/i);
  });

  it("names the other contract errors a user can hit", () => {
    expect(errorMessage({ data: sel("InvalidProof") })).toMatch(/proof/i);
    expect(errorMessage({ data: sel("InvalidOption") })).toMatch(/option/i);
    expect(errorMessage({ data: sel("NoMembers") })).toMatch(/at least one/i);
  });

  it("falls back to the library message for unknown errors", () => {
    expect(errorMessage({ shortMessage: "user rejected action" })).toBe("user rejected action");
    expect(errorMessage({ data: "0xdeadbeef", shortMessage: "x" })).toBe("x");
  });
});
