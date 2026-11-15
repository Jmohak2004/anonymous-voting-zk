// Shared ZK helpers used by contract tests, scripts and the frontend.
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";

export const TREE_DEPTH = 20;
/** BN254 scalar field order: every circuit value must be strictly below this. */
export const FIELD_ORDER =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export interface Identity {
  nullifier: bigint;
  trapdoor: bigint;
  commitment: bigint;
}

export interface MerkleProof {
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

let poseidonPromise: Promise<any> | undefined;
function getPoseidon() {
  return (poseidonPromise ??= buildPoseidon());
}

export async function poseidon2(a: bigint, b: bigint): Promise<bigint> {
  const p = await getPoseidon();
  return p.F.toObject(p([a, b])) as bigint;
}

function randomFieldElement(): bigint {
  const bytes = new Uint8Array(31); // 248 bits < field order
  globalThis.crypto.getRandomValues(bytes);
  let v = 0n;
  for (const byte of bytes) v = (v << 8n) | BigInt(byte);
  return v;
}

export async function createIdentity(): Promise<Identity> {
  const nullifier = randomFieldElement();
  const trapdoor = randomFieldElement();
  return { nullifier, trapdoor, commitment: await poseidon2(nullifier, trapdoor) };
}

/** Roots of empty subtrees: zeros[0] = 0, zeros[i+1] = H(zeros[i], zeros[i]). */
async function zeroHashes(): Promise<bigint[]> {
  const zeros = [0n];
  for (let i = 0; i < TREE_DEPTH; i++) zeros.push(await poseidon2(zeros[i], zeros[i]));
  return zeros;
}

/** Builds the authentication path for leaf `index` in a depth-20 tree holding `commitments`. */
export async function buildMerkleProof(
  commitments: bigint[],
  index: number
): Promise<MerkleProof> {
  if (index < 0 || index >= commitments.length) throw new Error("leaf index out of range");
  const zeros = await zeroHashes();
  let level = [...commitments];
  let idx = index;
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  for (let d = 0; d < TREE_DEPTH; d++) {
    const sibling = idx ^ 1;
    pathElements.push(sibling < level.length ? level[sibling] : zeros[d]);
    pathIndices.push(idx & 1);
    const next: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const right = i + 1 < level.length ? level[i + 1] : zeros[d];
      next.push(await poseidon2(level[i], right));
    }
    level = next;
    idx >>= 1;
  }
  return { root: level[0], pathElements, pathIndices };
}

export interface ProofArtifacts {
  /** Path (Node) or URL (browser) of vote.wasm */
  wasm: string;
  /** Path (Node) or URL (browser) of vote_final.zkey */
  zkey: string;
}

export interface VoteProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  nullifierHash: bigint;
}

/**
 * Generates a Groth16 proof that `identity` is in the tree of `commitments`
 * and votes `vote` in poll `pollId`. Output is in Solidity calldata order.
 */
export async function generateVoteProof(
  identity: Identity,
  commitments: bigint[],
  pollId: bigint,
  vote: bigint,
  artifacts: ProofArtifacts
): Promise<VoteProof> {
  const index = commitments.findIndex((c) => c === identity.commitment);
  if (index < 0) throw new Error("identity is not registered in this poll");
  const tree = await buildMerkleProof(commitments, index);
  const nullifierHash = await poseidon2(identity.nullifier, pollId);
  const input = {
    root: tree.root,
    nullifierHash,
    pollId,
    vote,
    nullifier: identity.nullifier,
    trapdoor: identity.trapdoor,
    pathElements: tree.pathElements,
    pathIndices: tree.pathIndices,
  };
  const { proof, publicSignals } = await groth16.fullProve(input, artifacts.wasm, artifacts.zkey);
  const raw = await groth16.exportSolidityCallData(proof, publicSignals);
  const [a, b, c] = JSON.parse(`[${raw}]`);
  return { a, b, c, nullifierHash };
}
