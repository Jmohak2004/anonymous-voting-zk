// Smoke check: prove membership for a 1-leaf tree and verify against verification_key.json.
import fs from "fs";
import path from "path";
import { groth16 } from "snarkjs";
import { buildPoseidon } from "circomlibjs";

const DEPTH = 20;
const build = path.join(__dirname, "../circuits/build");

export async function sampleProof() {
  const poseidon = await buildPoseidon();
  const h = (a: bigint, b: bigint) => poseidon.F.toObject(poseidon([a, b])) as bigint;
  const nullifier = 42n, trapdoor = 4242n, pollId = 0n, vote = 1n;
  const commitment = h(nullifier, trapdoor);
  // 1-leaf tree: leaf at index 0, siblings are the all-empty subtrees.
  let node = commitment;
  let zero = 0n;
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  for (let i = 0; i < DEPTH; i++) {
    pathElements.push(zero);
    pathIndices.push(0);
    node = h(node, zero);
    zero = h(zero, zero);
  }
  const input = {
    root: node, nullifierHash: h(nullifier, pollId), pollId, vote,
    nullifier, trapdoor, pathElements, pathIndices,
  };
  return groth16.fullProve(input, path.join(build, "vote.wasm"), path.join(build, "vote_final.zkey"));
}

async function main() {
  const vkey = JSON.parse(fs.readFileSync(path.join(build, "verification_key.json"), "utf8"));
  const { proof, publicSignals } = await sampleProof();
  const ok = await groth16.verify(vkey, publicSignals, proof);
  console.log("verify:", ok);
  if (!ok) process.exit(1);
  process.exit(0);
}

if (require.main === module) main();
