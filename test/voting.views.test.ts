import path from "path";
import { expect } from "chai";
import { buildMerkleProof, createIdentity, generateVoteProof } from "../shared/zk";
import { deployVoting, OPTIONS } from "./fixtures";

const ARTIFACTS = {
  wasm: path.join(__dirname, "../circuits/build/vote.wasm"),
  zkey: path.join(__dirname, "../circuits/build/vote_final.zkey"),
};

describe("Voting: views across the poll lifecycle", function () {
  this.timeout(300000);

  it("pollCount increments per created poll", async () => {
    const { voting } = await deployVoting();
    expect(await voting.pollCount()).to.equal(0n);
    await voting.createPoll("A?", OPTIONS);
    await voting.createPoll("B?", OPTIONS);
    expect(await voting.pollCount()).to.equal(2n);
  });

  it("getPoll reflects registration, voting and ended phases", async () => {
    const { voting, signers } = await deployVoting();
    await voting.createPoll("Lunch?", OPTIONS);
    let poll = await voting.getPoll(0);
    expect(poll.creator).to.equal(signers[0].address);
    expect(poll.question).to.equal("Lunch?");
    expect([...poll.options]).to.deep.equal(OPTIONS);
    expect(poll.phase).to.equal(0n);
    expect(poll.memberCount).to.equal(0n);
    expect(poll.root).to.equal(0n);

    await voting.connect(signers[1]).register(0, 77n);
    poll = await voting.getPoll(0);
    expect(poll.memberCount).to.equal(1n);
    expect(poll.root).to.equal(0n); // root stays zero until registration closes

    await voting.closeRegistration(0);
    poll = await voting.getPoll(0);
    expect(poll.phase).to.equal(1n);
    expect(poll.root).to.equal((await buildMerkleProof([77n], 0)).root);

    await voting.endPoll(0);
    expect((await voting.getPoll(0)).phase).to.equal(2n);
  });

  it("getCommitments returns commitments in insertion order", async () => {
    const { voting, signers } = await deployVoting();
    await voting.createPoll("Q?", OPTIONS);
    await voting.connect(signers[1]).register(0, 30n);
    await voting.connect(signers[2]).register(0, 10n);
    await voting.connect(signers[3]).register(0, 20n);
    expect([...(await voting.getCommitments(0))]).to.deep.equal([30n, 10n, 20n]);
  });

  it("getTally and hasVoted follow cast votes", async () => {
    const { voting, signers } = await deployVoting();
    await voting.createPoll("Q?", OPTIONS);
    const id = await createIdentity();
    await voting.connect(signers[1]).register(0, id.commitment);
    await voting.closeRegistration(0);
    expect([...(await voting.getTally(0))]).to.deep.equal([0n, 0n, 0n]);
    const p = await generateVoteProof(id, [id.commitment], 0n, 2n, ARTIFACTS);
    expect(await voting.hasVoted(0, p.nullifierHash)).to.equal(false);
    await voting.castVote(0, 2, p.nullifierHash, p.a, p.b, p.c);
    expect(await voting.hasVoted(0, p.nullifierHash)).to.equal(true);
    expect([...(await voting.getTally(0))]).to.deep.equal([0n, 0n, 1n]);
  });

  it("views revert PollNotFound for an unknown poll", async () => {
    const { voting } = await deployVoting();
    await expect(voting.getPoll(0)).to.be.revertedWithCustomError(voting, "PollNotFound");
    await expect(voting.getCommitments(0)).to.be.revertedWithCustomError(voting, "PollNotFound");
  });
});
