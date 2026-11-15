import { expect } from "chai";
import { ethers } from "hardhat";
import { FIELD_ORDER } from "../shared/zk";
import { deployVoting, OPTIONS } from "./fixtures";

describe("Voting: polls and registration", function () {
  this.timeout(300000);

  it("createPoll emits PollCreated with sequential ids", async () => {
    const { voting, signers } = await deployVoting();
    await expect(voting.createPoll("Q1?", OPTIONS))
      .to.emit(voting, "PollCreated").withArgs(0n, signers[0].address);
    await expect(voting.connect(signers[1]).createPoll("Q2?", OPTIONS))
      .to.emit(voting, "PollCreated").withArgs(1n, signers[1].address);
  });

  it("createPoll reverts with 1 or 9 options", async () => {
    const { voting } = await deployVoting();
    await expect(voting.createPoll("Q?", ["only"])).to.be.revertedWithCustomError(voting, "InvalidOptions");
    const nine = Array.from({ length: 9 }, (_, i) => `o${i}`);
    await expect(voting.createPoll("Q?", nine)).to.be.revertedWithCustomError(voting, "InvalidOptions");
  });

  it("createPoll reverts with an empty question", async () => {
    const { voting } = await deployVoting();
    await expect(voting.createPoll("", OPTIONS)).to.be.revertedWithCustomError(voting, "InvalidQuestion");
  });

  it("register stores commitment and emits MemberRegistered with index", async () => {
    const { voting, signers } = await deployVoting();
    await voting.createPoll("Q?", OPTIONS);
    await expect(voting.connect(signers[1]).register(0, 111n))
      .to.emit(voting, "MemberRegistered").withArgs(0n, 111n, 0n);
    await expect(voting.connect(signers[2]).register(0, 222n))
      .to.emit(voting, "MemberRegistered").withArgs(0n, 222n, 1n);
  });

  it("same address cannot register twice in one poll but can in another", async () => {
    const { voting, signers } = await deployVoting();
    await voting.createPoll("A?", OPTIONS);
    await voting.createPoll("B?", OPTIONS);
    await voting.connect(signers[1]).register(0, 1n);
    await expect(voting.connect(signers[1]).register(0, 2n)).to.be.revertedWithCustomError(voting, "AlreadyRegistered");
    await expect(voting.connect(signers[1]).register(1, 1n)).to.emit(voting, "MemberRegistered");
  });

  it("reverts on commitment >= FIELD_ORDER and on zero", async () => {
    const { voting, signers } = await deployVoting();
    await voting.createPoll("Q?", OPTIONS);
    await expect(voting.connect(signers[1]).register(0, FIELD_ORDER)).to.be.revertedWithCustomError(voting, "InvalidCommitment");
    await expect(voting.connect(signers[1]).register(0, ethers.MaxUint256)).to.be.revertedWithCustomError(voting, "InvalidCommitment");
    await expect(voting.connect(signers[1]).register(0, 0n)).to.be.revertedWithCustomError(voting, "InvalidCommitment");
  });

  it("reverts on duplicate commitment from a different address", async () => {
    const { voting, signers } = await deployVoting();
    await voting.createPoll("Q?", OPTIONS);
    await voting.connect(signers[1]).register(0, 5n);
    await expect(voting.connect(signers[2]).register(0, 5n)).to.be.revertedWithCustomError(voting, "DuplicateCommitment");
  });

  it("reverts for a poll that does not exist", async () => {
    const { voting } = await deployVoting();
    await expect(voting.register(3, 1n)).to.be.revertedWithCustomError(voting, "PollNotFound");
  });

  it.skip("reverts after registration closed (enabled in Task 10)", async () => {});
});
