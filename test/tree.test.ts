import { expect } from "chai";
import { ethers } from "hardhat";
import { buildMerkleProof, TREE_DEPTH } from "../shared/zk";

async function deployHarness() {
  const lib = await ethers.deployContract("PoseidonT3");
  const f = await ethers.getContractFactory("TreeHarness", {
    libraries: { PoseidonT3: await lib.getAddress() },
  });
  return f.deploy();
}

describe("IncrementalTree", function () {
  this.timeout(300000);

  it("tree depth constant is 20", () => {
    expect(TREE_DEPTH).to.equal(20);
  });

  for (const n of [1, 2, 5]) {
    it(`root after ${n} insert(s) matches the JS reference tree`, async () => {
      const h = await deployHarness();
      const leaves: bigint[] = [];
      for (let i = 0; i < n; i++) {
        const leaf = BigInt(1000 + i);
        leaves.push(leaf);
        await h.insert(leaf);
      }
      const ref = await buildMerkleProof(leaves, 0);
      expect(await h.root()).to.equal(ref.root);
    });
  }

  it("index returned increments from 0", async () => {
    const h = await deployHarness();
    expect(await h.insert.staticCall(7)).to.equal(0n);
    await h.insert(7);
    expect(await h.insert.staticCall(8)).to.equal(1n);
    await h.insert(8);
    expect(await h.size()).to.equal(2n);
  });

  it("reverts with TreeFull when the tree is full", async () => {
    const h = await deployHarness();
    await h.forceSize(2n ** 20n);
    await expect(h.insert(1)).to.be.revertedWithCustomError(h, "TreeFull");
  });
});
