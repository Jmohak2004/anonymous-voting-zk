import path from "path";
import { expect } from "chai";
import { wasm as wasmTester } from "circom_tester";
import { buildPoseidon } from "circomlibjs";

const DEPTH = 4;

describe("Vote circuit", function () {
  this.timeout(180000);
  let circuit: any;
  let h: (a: bigint, b: bigint) => bigint;

  before(async () => {
    const poseidon = await buildPoseidon();
    h = (a, b) => poseidon.F.toObject(poseidon([a, b])) as bigint;
    circuit = await wasmTester(path.join(__dirname, "vote_4.circom"));
  });

  function tree(leaves: bigint[], index: number) {
    let level = Array.from({ length: 2 ** DEPTH }, (_, i) => leaves[i] ?? 0n);
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = index;
    for (let d = 0; d < DEPTH; d++) {
      pathElements.push(level[idx ^ 1]);
      pathIndices.push(idx & 1);
      const next: bigint[] = [];
      for (let i = 0; i < level.length; i += 2) next.push(h(level[i], level[i + 1]));
      level = next;
      idx >>= 1;
    }
    return { root: level[0], pathElements, pathIndices };
  }

  const nullifier = 1234n;
  const trapdoor = 5678n;
  const pollId = 7n;
  const commitment = () => h(nullifier, trapdoor);
  const others = [11n, 22n];

  function validInput(vote = 1n) {
    const leaves = [others[0], commitment(), others[1]];
    const t = tree(leaves, 1);
    return {
      root: t.root,
      nullifierHash: h(nullifier, pollId),
      pollId,
      vote,
      nullifier,
      trapdoor,
      pathElements: t.pathElements,
      pathIndices: t.pathIndices,
    };
  }

  const fails = async (input: any) => {
    try {
      await circuit.calculateWitness(input, true);
    } catch {
      return true;
    }
    return false;
  };

  it("accepts a valid witness", async () => {
    const w = await circuit.calculateWitness(validInput(), true);
    await circuit.checkConstraints(w);
  });

  it("rejects wrong root", async () => {
    expect(await fails({ ...validInput(), root: 999n })).to.equal(true);
  });

  it("rejects wrong nullifierHash", async () => {
    expect(await fails({ ...validInput(), nullifierHash: 999n })).to.equal(true);
  });

  it("rejects a commitment not in the tree", async () => {
    expect(await fails({ ...validInput(), trapdoor: 1n })).to.equal(true);
  });
});
