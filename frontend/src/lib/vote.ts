import { Contract } from "ethers";
import { generateVoteProof, ProofArtifacts } from "@shared/zk";
import { loadIdentity, StorageLike } from "./identityStore";

export class NoIdentityError extends Error {
  constructor() {
    super("No voting identity found in this browser for this poll.");
    this.name = "NoIdentityError";
  }
}

export const DEFAULT_ARTIFACTS: ProofArtifacts = {
  wasm: "/zk/vote.wasm",
  zkey: "/zk/vote_final.zkey",
};

export type VoteStage = "proving" | "sending";

interface SubmitVoteArgs {
  /** Contract connected to the voter's signer (sends castVote). */
  voting: Contract;
  /** Read-only contract (fetches the on-chain commitment list). */
  reader: Contract;
  chainId: number;
  votingAddress: string;
  pollId: bigint;
  option: bigint;
  storage?: StorageLike;
  prover?: typeof generateVoteProof;
  artifacts?: ProofArtifacts;
  onStage?: (stage: VoteStage) => void;
}

/** Builds the proof in the browser from the stored secret and submits the vote. */
export async function submitVote({
  voting, reader, chainId, votingAddress, pollId, option,
  storage = globalThis.localStorage, prover = generateVoteProof,
  artifacts = DEFAULT_ARTIFACTS, onStage,
}: SubmitVoteArgs): Promise<void> {
  const identity = loadIdentity(chainId, votingAddress, pollId, storage);
  if (!identity) throw new NoIdentityError();
  const commitments = [...(await reader.getCommitments(pollId))].map(BigInt);
  onStage?.("proving");
  const p = await prover(identity, commitments, pollId, option, artifacts);
  onStage?.("sending");
  const tx = await voting.castVote(pollId, option, p.nullifierHash, p.a, p.b, p.c);
  await tx.wait();
}
