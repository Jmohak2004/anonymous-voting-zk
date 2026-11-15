import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const networks: HardhatUserConfig["networks"] = {
  hardhat: {},
  localhost: { url: "http://127.0.0.1:8545" },
};

// Sepolia is configured but unused by default; set both env vars to enable it.
if (process.env.SEPOLIA_RPC_URL && process.env.PRIVATE_KEY) {
  networks!.sepolia = {
    url: process.env.SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks,
  mocha: { timeout: 300000 },
};

export default config;
