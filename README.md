# Anonymous Voting dApp (zk-SNARKs)

Anonymous, one-person-one-vote polls on an EVM chain. Voters register a hidden
commitment, then prove in zero knowledge that they are a registered member and
cast a vote - **without revealing which member they are** (the transaction sender is still public, so vote from a fresh address for real anonymity; see [docs/SECURITY.md](docs/SECURITY.md)). A Solidity contract
verifies the proof and enforces one vote per member, so nobody has to be trusted
to count.

- **Circuit** (Circom 2, Groth16): Poseidon commitment, depth-20 Merkle membership, per-poll nullifier, vote bound into the proof.
- **Contracts** (Solidity 0.8, Hardhat): per-poll incremental Poseidon Merkle tree, generated Groth16 verifier, `Voting` with explicit phases.
- **Frontend** (React + Vite + ethers): proofs are generated **in your browser**; secrets never leave it.

> Local demo / learning project. The trusted setup is a dev-only ceremony - read [docs/SECURITY.md](docs/SECURITY.md) before trusting it with anything real.

## How it works (30 seconds)

1. **Create** a poll (question + 2-8 options). The creator controls the phases.
2. **Register**: your browser makes a random secret `(nullifier, trapdoor)` and sends only `commitment = Poseidon(nullifier, trapdoor)` on-chain. The secret is saved in `localStorage`.
3. The creator **closes registration**; the Merkle root of all commitments is frozen.
4. **Vote**: the browser proves "I know a secret whose commitment is in the tree, and this is my one-time tag for this poll" and submits the proof + chosen option. The contract checks the proof, rejects a reused tag, and tallies.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

- Node.js 20+
- circom 2.2.3 (prebuilt release binary from https://github.com/iden3/circom/releases, or build from source with Cargo); put it on your `PATH`
- Run `scripts/check-env.sh` to verify

## Quickstart

```bash
npm install && npm --prefix frontend install
scripts/check-env.sh

npm run test:all          # circuit, contract, frontend tests + end-to-end flow

# run the dapp locally (three terminals)
npm run chain             # 1) local Hardhat chain on :8545
npm run deploy:local      # 2) deploy contracts, writes frontend/src/contracts/*.json
npm run frontend:dev      # 3) open http://localhost:5173
```

In dev mode the app lets you switch between Hardhat's funded accounts #0-#9 from a dropdown (no MetaMask needed), which makes it easy to play several voters. To use MetaMask instead, set `VITE_DEV_WALLETS=false`, add the local network (chain id 31337, RPC `http://127.0.0.1:8545`) and import some Hardhat test keys.

Try it: as account #0 create a poll, as #1 and #2 register, as #0 close registration, then vote as #1 and #2 and watch the tally update live.

### Rebuilding the circuit

`circuits/build/vote.wasm` and `vote_final.zkey` and `contracts/Verifier.sol` are committed so a fresh clone works. They must stay in sync: `npm run build:circuit` regenerates **all three** (new random setup), after which you must redeploy.

## Scripts

| Script | What it does |
|---|---|
| `npm run build:circuit` | compile circuit, dev trusted setup, export `Verifier.sol` |
| `npm run test:circuits` | circuit unit tests (circom_tester) |
| `npm test` | Hardhat contract tests (includes real proofs) |
| `npm run test:frontend` | Vitest frontend tests |
| `npm run e2e` | full lifecycle with 5 voters and real proofs |
| `npm run chain` / `deploy:local` / `frontend:dev` | run the dapp |

## Layout

```
circuits/   circom sources, tests, build artifacts
contracts/  Voting.sol, IncrementalTree.sol, generated Verifier.sol
shared/     TypeScript ZK helpers (identity, Merkle proof, proof generation) used by tests, scripts and the frontend
scripts/    circuit build, deploy, e2e
frontend/   React app
docs/       architecture, security notes, design + plan
```

## Status

Verified during development: 10 circuit tests, 39 contract tests (including real Groth16 proofs, cross-poll replay and tampering), 49 frontend tests, the e2e script, and a headless-Chromium run of the full UI flow (create, register, close, vote with in-browser proving, live tally, double-vote rejection, every in-app link and bad-URL page, zero console errors). Sepolia network config exists but deployment there is untested.
