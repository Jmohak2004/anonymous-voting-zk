import { Contract } from "ethers";
import { createIdentity, Identity } from "@shared/zk";
import { loadIdentity, removeIdentity, saveIdentity, StorageLike } from "./identityStore";

interface RegisterArgs {
  voting: Contract;
  chainId: number;
  votingAddress: string;
  pollId: bigint;
  storage?: StorageLike;
}

/**
 * Creates an identity, saves it locally BEFORE sending the register tx (so a
 * confirmed registration can never end up without its secret), and rolls the
 * local state back if the tx fails.
 */
export async function registerFlow({
  voting, chainId, votingAddress, pollId, storage = globalThis.localStorage,
}: RegisterArgs): Promise<Identity> {
  const previous = loadIdentity(chainId, votingAddress, pollId, storage);
  const id = await createIdentity();
  saveIdentity(chainId, votingAddress, pollId, id, storage); // throws => no tx is sent
  let tx;
  try {
    tx = await voting.register(pollId, id.commitment);
  } catch (e) {
    // Nothing was broadcast: restore the previous identity (or none).
    if (previous) saveIdentity(chainId, votingAddress, pollId, previous, storage);
    else removeIdentity(chainId, votingAddress, pollId, storage);
    throw e;
  }
  // The tx is out. Even if confirmation fails (replaced, RPC drop) the commitment
  // may be on-chain, so the secret must be kept.
  await tx.wait();
  return id;
}

export function errorMessage(e: any): string {
  const name = e?.revert?.name;
  if (name === "AlreadyRegistered") return "This address has already registered for this poll.";
  if (name === "WrongPhase") return "This action is not allowed in the poll's current phase.";
  if (name === "NullifierUsed") return "This identity has already voted in this poll.";
  if (name === "NotCreator") return "Only the poll creator can do this.";
  return e?.shortMessage ?? e?.message ?? String(e);
}
