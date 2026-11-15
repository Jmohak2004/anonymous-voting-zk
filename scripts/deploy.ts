import fs from "fs";
import path from "path";
import { ethers, artifacts } from "hardhat";

// Deploys PoseidonT3 (linked library), Groth16Verifier and Voting, then writes
// the addresses and ABI where the frontend picks them up.
async function main() {
  const poseidon = await ethers.deployContract("PoseidonT3");
  await poseidon.waitForDeployment();
  const verifier = await ethers.deployContract("Groth16Verifier");
  await verifier.waitForDeployment();
  const Voting = await ethers.getContractFactory("Voting", {
    libraries: { PoseidonT3: await poseidon.getAddress() },
  });
  const voting = await Voting.deploy(await verifier.getAddress());
  await voting.waitForDeployment();

  const { chainId } = await ethers.provider.getNetwork();
  const deployment = {
    chainId: Number(chainId),
    voting: await voting.getAddress(),
    verifier: await verifier.getAddress(),
    poseidon: await poseidon.getAddress(),
  };

  const outDir = path.join(__dirname, "../frontend/src/contracts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "deployment.json"), JSON.stringify(deployment, null, 2) + "\n");
  const abi = (await artifacts.readArtifact("Voting")).abi;
  fs.writeFileSync(path.join(outDir, "Voting.abi.json"), JSON.stringify(abi, null, 2) + "\n");
  console.log("Deployed:", deployment);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
