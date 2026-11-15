// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createIdentity } from "@shared/zk";
import {
  saveIdentity, loadIdentity, removeIdentity, exportIdentity, importIdentity, StorageLike,
} from "./identityStore";

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
const throwing: StorageLike = {
  getItem: () => { throw new Error("denied"); },
  setItem: () => { throw new Error("denied"); },
  removeItem: () => { throw new Error("denied"); },
};
const V = "0xAbC0000000000000000000000000000000000001";

describe("identityStore", () => {
  it("identity round-trips through storage keyed per poll", async () => {
    const s = fakeStorage();
    const id = await createIdentity();
    saveIdentity(31337, V, 0n, id, s);
    expect(loadIdentity(31337, V, 0n, s)).toEqual(id);
  });

  it("different polls do not overwrite each other", async () => {
    const s = fakeStorage();
    const a = await createIdentity();
    const b = await createIdentity();
    saveIdentity(31337, V, 0n, a, s);
    saveIdentity(31337, V, 1n, b, s);
    expect(loadIdentity(31337, V, 0n, s)).toEqual(a);
    expect(loadIdentity(31337, V, 1n, s)).toEqual(b);
    removeIdentity(31337, V, 0n, s);
    expect(loadIdentity(31337, V, 0n, s)).toBeNull();
    expect(loadIdentity(31337, V, 1n, s)).toEqual(b);
  });

  it("import round-trips an exported identity", async () => {
    const id = await createIdentity();
    expect(await importIdentity(exportIdentity(id))).toEqual(id);
  });

  it("import rejects malformed JSON and tampered commitments", async () => {
    await expect(importIdentity("not json")).rejects.toThrow();
    const id = await createIdentity();
    const tampered = JSON.parse(exportIdentity(id));
    tampered.commitment = "12345";
    await expect(importIdentity(JSON.stringify(tampered))).rejects.toThrow(/commitment/i);
  });

  it("loadIdentity returns null when storage throws; saveIdentity surfaces the error", async () => {
    expect(loadIdentity(31337, V, 0n, throwing)).toBeNull();
    const id = await createIdentity();
    expect(() => saveIdentity(31337, V, 0n, id, throwing)).toThrow();
  });
});
