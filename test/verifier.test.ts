import { expect } from "chai";
import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import { sampleProof } from "../scripts/smoke-prove";

async function calldata(proof: any, publicSignals: string[]) {
  const raw = await groth16.exportSolidityCallData(proof, publicSignals);
  const [a, b, c, pub] = JSON.parse(`[${raw}]`);
  return { a, b, c, pub };
}

describe("Groth16Verifier", function () {
  this.timeout(120000);

  it("deploys Groth16Verifier and accepts a valid proof", async () => {
    const verifier = await ethers.deployContract("Groth16Verifier");
    const { proof, publicSignals } = await sampleProof();
    const { a, b, c, pub } = await calldata(proof, publicSignals);
    expect(await verifier.verifyProof(a, b, c, pub)).to.equal(true);
  });

  it("rejects a proof with a modified public signal", async () => {
    const verifier = await ethers.deployContract("Groth16Verifier");
    const { proof, publicSignals } = await sampleProof();
    const { a, b, c, pub } = await calldata(proof, publicSignals);
    const tampered = [...pub];
    tampered[3] = "0x" + (BigInt(tampered[3]) + 1n).toString(16); // change `vote`
    expect(await verifier.verifyProof(a, b, c, tampered)).to.equal(false);
  });
});
