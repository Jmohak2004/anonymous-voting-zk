import { expect } from "chai";
import { buildMerkleProof } from "../shared/zk";
import { deployVoting, OPTIONS } from "./fixtures";

async function pollWithMembers(n: number) {
  const ctx = await deployVoting();
  await ctx.voting.createPoll("Q?", OPTIONS); // creator = signers[0]
  const commitments: bigint[] = [];
  for (let i = 0; i < n; i++) {
    const c = BigInt(100 + i);
    commitments.push(c);
    await ctx.voting.connect(ctx.signers[i + 1]).register(0, c);
  }
  return { ...ctx, commitments };
}

describe("Voting: phases", function () {
  this.timeout(300000);

  it("only the creator can close registration or end the poll", async () => {
    const { voting, signers } = await pollWithMembers(1);
    await expect(voting.connect(signers[1]).closeRegistration(0)).to.be.revertedWithCustomError(voting, "NotCreator");
    await voting.closeRegistration(0);
    await expect(voting.connect(signers[1]).endPoll(0)).to.be.revertedWithCustomError(voting, "NotCreator");
  });

  it("closing with zero members reverts NoMembers", async () => {
    const { voting } = await pollWithMembers(0);
    await expect(voting.closeRegistration(0)).to.be.revertedWithCustomError(voting, "NoMembers");
  });

  it("close freezes a root equal to the JS reference tree and emits RegistrationClosed", async () => {
    const { voting, commitments } = await pollWithMembers(3);
    const ref = await buildMerkleProof(commitments, 0);
    await expect(voting.closeRegistration(0))
      .to.emit(voting, "RegistrationClosed").withArgs(0n, ref.root);
  });

  it("closing twice reverts WrongPhase", async () => {
    const { voting } = await pollWithMembers(1);
    await voting.closeRegistration(0);
    await expect(voting.closeRegistration(0)).to.be.revertedWithCustomError(voting, "WrongPhase");
  });

  it("endPoll before close reverts WrongPhase", async () => {
    const { voting } = await pollWithMembers(1);
    await expect(voting.endPoll(0)).to.be.revertedWithCustomError(voting, "WrongPhase");
  });

  it("endPoll after close succeeds, emits PollEnded, and cannot repeat", async () => {
    const { voting } = await pollWithMembers(1);
    await voting.closeRegistration(0);
    await expect(voting.endPoll(0)).to.emit(voting, "PollEnded").withArgs(0n);
    await expect(voting.endPoll(0)).to.be.revertedWithCustomError(voting, "WrongPhase");
  });
});
