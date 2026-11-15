import path from "path";
import { expect } from "chai";
import { createIdentity, generateVoteProof, Identity } from "../shared/zk";
import { deployVoting, OPTIONS } from "./fixtures";

const ARTIFACTS = {
  wasm: path.join(__dirname, "../circuits/build/vote.wasm"),
  zkey: path.join(__dirname, "../circuits/build/vote_final.zkey"),
};

/** Poll 0 with 3 registered voters (signers 1..3), registration closed. */
async function openPoll() {
  const ctx = await deployVoting();
  await ctx.voting.createPoll("Q?", OPTIONS);
  const ids: Identity[] = [];
  for (let i = 0; i < 3; i++) {
    const id = await createIdentity();
    ids.push(id);
    await ctx.voting.connect(ctx.signers[i + 1]).register(0, id.commitment);
  }
  await ctx.voting.closeRegistration(0);
  const commitments = ids.map((i) => i.commitment);
  const prove = (who: number, pollId: bigint, vote: bigint, cs = commitments) =>
    generateVoteProof(ids[who], cs, pollId, vote, ARTIFACTS);
  return { ...ctx, ids, commitments, prove };
}

describe("Voting: castVote", function () {
  this.timeout(600000);

  it("valid vote increments tally and emits VoteCast", async () => {
    const { voting, prove } = await openPoll();
    const p = await prove(0, 0n, 1n);
    await expect(voting.castVote(0, 1, p.nullifierHash, p.a, p.b, p.c))
      .to.emit(voting, "VoteCast").withArgs(0n, 1n, p.nullifierHash);
    expect(await voting.getTally(0)).to.deep.equal([0n, 1n, 0n]);
  });

  it("is anonymous: a vote can be cast by an address that never registered", async () => {
    const { voting, prove, signers } = await openPoll();
    const p = await prove(1, 0n, 2n);
    await voting.connect(signers[9]).castVote(0, 2, p.nullifierHash, p.a, p.b, p.c);
    expect(await voting.getTally(0)).to.deep.equal([0n, 0n, 1n]);
  });

  it("second vote by the same identity reverts NullifierUsed", async () => {
    const { voting, prove } = await openPoll();
    const p = await prove(0, 0n, 0n);
    await voting.castVote(0, 0, p.nullifierHash, p.a, p.b, p.c);
    const q = await prove(0, 0n, 1n);
    await expect(voting.castVote(0, 1, q.nullifierHash, q.a, q.b, q.c))
      .to.be.revertedWithCustomError(voting, "NullifierUsed");
  });

  it("same identity votes once in each of two polls", async () => {
    const { voting, ids, signers } = await openPoll();
    await voting.createPoll("Second?", OPTIONS);
    await voting.connect(signers[1]).register(1, ids[0].commitment);
    await voting.closeRegistration(1);
    const p0 = await generateVoteProof(ids[0], ids.map((i) => i.commitment), 0n, 0n, ARTIFACTS);
    const p1 = await generateVoteProof(ids[0], [ids[0].commitment], 1n, 1n, ARTIFACTS);
    expect(p0.nullifierHash).to.not.equal(p1.nullifierHash);
    await voting.castVote(0, 0, p0.nullifierHash, p0.a, p0.b, p0.c);
    await voting.castVote(1, 1, p1.nullifierHash, p1.a, p1.b, p1.c);
    expect(await voting.getTally(1)).to.deep.equal([0n, 1n, 0n]);
  });

  it("option >= options.length reverts InvalidOption", async () => {
    const { voting, prove } = await openPoll();
    const p = await prove(0, 0n, 3n);
    await expect(voting.castVote(0, 3, p.nullifierHash, p.a, p.b, p.c))
      .to.be.revertedWithCustomError(voting, "InvalidOption");
  });

  it("vote before registration closes reverts WrongPhase", async () => {
    const ctx = await deployVoting();
    await ctx.voting.createPoll("Q?", OPTIONS);
    const id = await createIdentity();
    await ctx.voting.connect(ctx.signers[1]).register(0, id.commitment);
    const p = await generateVoteProof(id, [id.commitment], 0n, 0n, ARTIFACTS);
    await expect(ctx.voting.castVote(0, 0, p.nullifierHash, p.a, p.b, p.c))
      .to.be.revertedWithCustomError(ctx.voting, "WrongPhase");
  });

  it("vote after endPoll reverts WrongPhase", async () => {
    const { voting, prove } = await openPoll();
    await voting.endPoll(0);
    const p = await prove(0, 0n, 0n);
    await expect(voting.castVote(0, 0, p.nullifierHash, p.a, p.b, p.c))
      .to.be.revertedWithCustomError(voting, "WrongPhase");
  });

  it("proof replayed with a different option reverts InvalidProof", async () => {
    const { voting, prove } = await openPoll();
    const p = await prove(0, 0n, 0n);
    await expect(voting.castVote(0, 1, p.nullifierHash, p.a, p.b, p.c))
      .to.be.revertedWithCustomError(voting, "InvalidProof");
  });

  it("proof replayed with a different nullifierHash reverts InvalidProof", async () => {
    const { voting, prove } = await openPoll();
    const p = await prove(0, 0n, 0n);
    await expect(voting.castVote(0, 0, p.nullifierHash + 1n, p.a, p.b, p.c))
      .to.be.revertedWithCustomError(voting, "InvalidProof");
  });

  it("proof from one poll cannot be replayed in another poll", async () => {
    const { voting, ids, signers } = await openPoll();
    await voting.createPoll("Second?", OPTIONS);
    await voting.connect(signers[1]).register(1, ids[0].commitment);
    await voting.closeRegistration(1);
    const p0 = await generateVoteProof(ids[0], ids.map((i) => i.commitment), 0n, 0n, ARTIFACTS);
    await expect(voting.castVote(1, 0, p0.nullifierHash, p0.a, p0.b, p0.c))
      .to.be.revertedWithCustomError(voting, "InvalidProof");
  });

  it("an identity that is not in the tree cannot produce a proof", async () => {
    const { commitments } = await openPoll();
    const stranger = await createIdentity();
    let threw = false;
    try {
      await generateVoteProof(stranger, commitments, 0n, 0n, ARTIFACTS);
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });
});
