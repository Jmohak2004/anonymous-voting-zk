import { Contract, ContractRunner } from "ethers";
import deployment from "../contracts/deployment.json";
import abi from "../contracts/Voting.abi.json";

export const PHASES = ["Registration", "Voting", "Ended"] as const;
export type PhaseName = (typeof PHASES)[number];

export interface PollView {
  id: bigint;
  creator: string;
  question: string;
  options: string[];
  phase: PhaseName;
  memberCount: number;
  root: bigint;
}

export const DEPLOYMENT = deployment;

export function getVotingContract(runner: ContractRunner): Contract {
  return new Contract(deployment.voting, abi, runner);
}

export function toPollView(
  id: bigint,
  raw: { creator: string; question: string; options: readonly string[]; phase: bigint; memberCount: bigint; root: bigint }
): PollView {
  return {
    id,
    creator: raw.creator,
    question: raw.question,
    options: [...raw.options],
    phase: PHASES[Number(raw.phase)],
    memberCount: Number(raw.memberCount),
    root: raw.root,
  };
}

export async function fetchPoll(voting: Contract, id: bigint): Promise<PollView> {
  return toPollView(id, await voting.getPoll(id));
}

/** Newest first. */
export async function fetchPolls(voting: Contract): Promise<PollView[]> {
  const count: bigint = await voting.pollCount();
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i)).reverse();
  return Promise.all(ids.map((id) => fetchPoll(voting, id)));
}
