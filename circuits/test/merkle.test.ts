import path from "path";
import { expect } from "chai";
import { wasm as wasmTester } from "circom_tester";
import { buildPoseidon } from "circomlibjs";

const DEPTH = 4;

describe("MerkleProof circuit", function () {
  this.timeout(120000);
  let circuit: any;
  let poseidon: any;
  let h: (a: bigint, b: bigint) => bigint;

  before(async () => {
    poseidon = await buildPoseidon();
    h = (a, b) => poseidon.F.toObject(poseidon([a, b])) as bigint;
    circuit = await wasmTester(path.join(__dirname, "merkle_4.circom"));
  });

  // Reference tree: 2**DEPTH leaves, empty leaf = 0.
  function proofFor(leaves: bigint[], index: number) {
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

  const leaves = [101n, 202n, 303n, 404n, 505n, 606n, 707n, 808n];

  for (const index of [0, 5]) {
    it(`computes the same root as the JS tree for leaf at index ${index} of 8 leaves`, async () => {
      const p = proofFor(leaves, index);
      const w = await circuit.calculateWitness(
        { leaf: leaves[index], pathElements: p.pathElements, pathIndices: p.pathIndices },
        true
      );
      await circuit.checkConstraints(w);
      await circuit.assertOut(w, { root: p.root });
    });
  }

  it("rejects pathIndices value 2", async () => {
    const p = proofFor(leaves, 0);
    const bad = [...p.pathIndices];
    bad[1] = 2;
    let threw = false;
    try {
      await circuit.calculateWitness(
        { leaf: leaves[0], pathElements: p.pathElements, pathIndices: bad },
        true
      );
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });
});
