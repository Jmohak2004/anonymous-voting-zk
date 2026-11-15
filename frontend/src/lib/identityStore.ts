import { FIELD_ORDER, Identity, poseidon2 } from "@shared/zk";

/** Minimal Storage surface so tests (and private-mode browsers) can swap it. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Storage scope for one account on one deployment, so two accounts used in the
 * same browser never overwrite each other's identity. Pass the result wherever
 * a `voting` address is expected below.
 */
export const identityScope = (voting: string, account: string | undefined) =>
  `${voting.toLowerCase()}:${(account ?? "").toLowerCase()}`;

const key = (chainId: number, voting: string, pollId: bigint) =>
  `zkvote:identity:${chainId}:${voting.toLowerCase()}:${pollId}`;

const toJson = (id: Identity) =>
  JSON.stringify({
    nullifier: id.nullifier.toString(),
    trapdoor: id.trapdoor.toString(),
    commitment: id.commitment.toString(),
  });

/** Throws if storage is unavailable: the caller must not register an unsaved identity. */
export function saveIdentity(
  chainId: number, voting: string, pollId: bigint, id: Identity,
  storage: StorageLike = globalThis.localStorage
): void {
  storage.setItem(key(chainId, voting, pollId), toJson(id));
}

export function removeIdentity(
  chainId: number, voting: string, pollId: bigint,
  storage: StorageLike = globalThis.localStorage
): void {
  try {
    storage.removeItem(key(chainId, voting, pollId));
  } catch {
    /* nothing to remove if storage is unavailable */
  }
}

export function loadIdentity(
  chainId: number, voting: string, pollId: bigint,
  storage: StorageLike = globalThis.localStorage
): Identity | null {
  try {
    const raw = storage.getItem(key(chainId, voting, pollId));
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      nullifier: BigInt(p.nullifier),
      trapdoor: BigInt(p.trapdoor),
      commitment: BigInt(p.commitment),
    };
  } catch {
    return null;
  }
}

/** Backup string the user can keep so clearing browser data does not lose the right to vote. */
export function exportIdentity(id: Identity): string {
  return toJson(id);
}

/** Parses a backup and checks the commitment really is Poseidon(nullifier, trapdoor). */
export async function importIdentity(json: string): Promise<Identity> {
  const p = JSON.parse(json);
  const nullifier = BigInt(p.nullifier);
  const trapdoor = BigInt(p.trapdoor);
  const commitment = BigInt(p.commitment);
  for (const v of [nullifier, trapdoor, commitment]) {
    if (v <= 0n || v >= FIELD_ORDER) throw new Error("identity value out of range");
  }
  if ((await poseidon2(nullifier, trapdoor)) !== commitment) {
    throw new Error("commitment does not match nullifier and trapdoor");
  }
  return { nullifier, trapdoor, commitment };
}
