import { Contract, Interface } from "ethers";
import abi from "../contracts/Voting.abi.json";
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

const iface = new Interface(abi);

/** Finds the first 0x-hex string in the shapes ethers/JSON-RPC use to carry revert data. */
function revertData(e: any): string | undefined {
  const candidates = [e?.data, e?.info?.error?.data, e?.info?.error?.data?.data, e?.error?.data, e?.error?.data?.data];
  return candidates.find((c) => typeof c === "string" && /^0x[0-9a-fA-F]{8,}$/.test(c));
}

/**
 * Name of the contract custom error behind `e`. ethers only decodes custom errors for
 * read calls, so for sent transactions the raw revert data is decoded here.
 */
function revertName(e: any): string | undefined {
  if (e?.revert?.name) return e.revert.name;
  const data = revertData(e);
  if (!data) return undefined;
  try {
    return iface.parseError(data)?.name;
  } catch {
    return undefined;
  }
}

const FRIENDLY: Record<string, string> = {
  AlreadyRegistered: "This address has already registered for this poll.",
  DuplicateCommitment: "That commitment is already registered. Try again.",
  InvalidCommitment: "Invalid commitment.",
  WrongPhase: "This action is not allowed in the poll's current phase.",
  NullifierUsed: "This identity has already voted in this poll.",
  InvalidProof: "The proof was rejected by the contract. Make sure you are voting in the poll you registered for.",
  InvalidOption: "That option does not exist.",
  InvalidOptions: "A poll needs between 2 and 8 options.",
  InvalidQuestion: "A poll needs a question.",
  NoMembers: "Registration needs at least one registered voter before it can be closed.",
  NotCreator: "Only the poll creator can do this.",
  PollNotFound: "Poll not found.",
};

export function errorMessage(e: any): string {
  const name = revertName(e);
  if (name && FRIENDLY[name]) return FRIENDLY[name];
  return e?.shortMessage ?? e?.message ?? String(e);
}
