import { ethers } from "hardhat";

/** Deploys PoseidonT3 (linked), Groth16Verifier and Voting. */
export async function deployVoting() {
  const signers = await ethers.getSigners();
  const poseidon = await ethers.deployContract("PoseidonT3");
  const verifier = await ethers.deployContract("Groth16Verifier");
  const Voting = await ethers.getContractFactory("Voting", {
    libraries: { PoseidonT3: await poseidon.getAddress() },
  });
  const voting = await Voting.deploy(await verifier.getAddress());
  return { voting, verifier, poseidon, signers };
}

export const OPTIONS = ["Yes", "No", "Abstain"];
