// End-to-end: full poll lifecycle with real proofs on an in-process Hardhat chain.
import assert from "assert";
import path from "path";
import { deployVoting } from "../test/fixtures";
import { createIdentity, generateVoteProof } from "../shared/zk";

const ARTIFACTS = {
  wasm: path.join(__dirname, "../circuits/build/vote.wasm"),
  zkey: path.join(__dirname, "../circuits/build/vote_final.zkey"),
};

async function expectRevert(p: Promise<unknown>, errorName: string) {
  try {
    await p;
  } catch (e: any) {
    assert.ok(String(e.message).includes(errorName), `expected ${errorName}, got: ${e.message}`);
    return;
  }
  assert.fail(`expected revert ${errorName}`);
}

async function main() {
  const { voting, signers } = await deployVoting();
  const [creator, relayer] = [signers[0], signers[10]];
  const voters = signers.slice(1, 6);
  const choices = [0n, 1n, 1n, 2n, 1n];

  await voting.connect(creator).createPoll("Best language?", ["Rust", "Solidity", "Circom"]);
  const identities = [];
  for (const v of voters) {
    const id = await createIdentity();
    identities.push(id);
    await voting.connect(v).register(0, id.commitment);
  }
  console.log(`registered ${identities.length} voters`);
  await voting.connect(creator).closeRegistration(0);

  const commitments = [...(await voting.getCommitments(0))].map(BigInt);
  const proofs = [];
  for (let i = 0; i < identities.length; i++) {
    const p = await generateVoteProof(identities[i], commitments, 0n, choices[i], ARTIFACTS);
    proofs.push(p);
    // cast from a relayer address that never registered: the chain cannot link vote to voter
    await voting.connect(relayer).castVote(0, choices[i], p.nullifierHash, p.a, p.b, p.c);
  }
  assert.deepStrictEqual([...(await voting.getTally(0))].map(Number), [1, 3, 1]);
  console.log("tally correct: [1, 3, 1]");

  await expectRevert(
    voting.connect(relayer).castVote(0, choices[0], proofs[0].nullifierHash, proofs[0].a, proofs[0].b, proofs[0].c),
    "NullifierUsed"
  );
  console.log("double vote rejected");

  const fresh = await createIdentity();
  await expectRevert(generateVoteProof(fresh, commitments, 0n, 0n, ARTIFACTS), "not registered");
  console.log("non-member cannot prove membership");

  await voting.connect(creator).endPoll(0);
  const late = await generateVoteProof(identities[0], commitments, 0n, 0n, ARTIFACTS);
  await expectRevert(
    voting.connect(relayer).castVote(0, 0, late.nullifierHash, late.a, late.b, late.c),
    "WrongPhase"
  );
  console.log("vote after end rejected");
  console.log("E2E PASS");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("E2E FAIL:", e);
  process.exit(1);
});
