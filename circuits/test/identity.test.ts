import path from "path";
import { expect } from "chai";
import { wasm as wasmTester } from "circom_tester";
import { buildPoseidon } from "circomlibjs";

describe("Identity circuit", function () {
  this.timeout(120000);
  let circuit: any;
  let F: any;
  let poseidon: any;

  before(async () => {
    poseidon = await buildPoseidon();
    F = poseidon.F;
    circuit = await wasmTester(path.join(__dirname, "../identity.circom"));
  });

  const h = (xs: bigint[]) => F.toObject(poseidon(xs)) as bigint;

  it("commitment equals Poseidon(nullifier, trapdoor)", async () => {
    const input = { nullifier: 11n, trapdoor: 22n, pollId: 3n };
    const w = await circuit.calculateWitness(input, true);
    await circuit.checkConstraints(w);
    await circuit.assertOut(w, { commitment: h([11n, 22n]) });
  });

  it("nullifierHash equals Poseidon(nullifier, pollId)", async () => {
    const w = await circuit.calculateWitness({ nullifier: 11n, trapdoor: 22n, pollId: 3n }, true);
    await circuit.assertOut(w, { nullifierHash: h([11n, 3n]) });
  });

  it("nullifierHash differs for different pollId", async () => {
    const a = await circuit.calculateWitness({ nullifier: 11n, trapdoor: 22n, pollId: 3n }, true);
    const b = await circuit.calculateWitness({ nullifier: 11n, trapdoor: 22n, pollId: 4n }, true);
    expect(a[2]).to.not.equal(b[2]); // witness[1]=commitment, witness[2]=nullifierHash
    expect(a[1]).to.equal(b[1]);
  });
});
