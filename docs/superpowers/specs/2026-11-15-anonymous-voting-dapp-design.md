# Anonymous Voting dApp — Design

Status: approved by user ("start"), 2026-11-15.

## Intent
A complete, working on-chain dapp for anonymous voting using zero-knowledge proofs. Voters register a hidden commitment, then cast one vote per poll with a ZK proof that they are a registered member without revealing which one. The contract enforces everything; nobody is trusted to count. Built as a learning project and a demo-able portfolio piece.

## Goals
- Create polls (question + options) from the UI.
- Two phases per poll: registration (submit commitment), then voting (submit proof + vote).
- Circom circuit: Poseidon commitment, Merkle membership proof, per-poll nullifier, vote bound into the proof.
- Solidity: incremental Poseidon Merkle tree per poll, Groth16 verifier generated from the circuit, `Voting` contract rejecting bad proofs and reused nullifiers.
- React + Vite + ethers frontend; proofs generated in-browser with snarkjs; secrets never leave the browser.
- Tests at every layer (circuit, contracts, frontend logic); end-to-end run on a local Hardhat chain.
- Final: public-ready GitHub repo, pushed as 22 commits.

## Non-goals
- Production-grade trusted setup (local dev ceremony only).
- Strong Sybil resistance (one address registers once per poll; documented as weak).
- Mainnet deployment, hosted frontend, admin allowlists, gas optimization.

## Anti-goals
- Any design where the server/contract operator can link a vote to a voter.
- Secrets or private keys stored anywhere but the user's browser (local storage, user-exportable).

## Approaches considered
- A. Local server as ballot box: fastest, but needs trust in the server. Rejected: user wants a proper dapp.
- **B. On-chain verification on a local Hardhat chain (chosen):** trustless, matches real products (Semaphore-style), config ready for Sepolia later.
- C. Rust/arkworks end to end: deepest, steepest, no browser proving. Rejected.

## Design decisions (user-approved)
- Anyone can create a poll; anyone with a wallet can register during registration phase (open registration).
- Local Hardhat chain only for now; Sepolia network config included but unused.
- Dev trusted setup (powers of tau generated locally).

## Builder's calls (mine, not user-decided)
- Circom 2 + snarkjs Groth16; Poseidon from circomlib; Merkle depth 20 (supports ~1M voters, proof still fast enough in browser — may drop to 16 if proving is too slow).
- Hardhat + TypeScript + Chai for contract tests; circom_tester for circuit tests; Vitest for frontend logic.
- Circom installed via `cargo install` from source (Rust is present); everything else via npm.
- Monorepo layout: `circuits/`, `contracts/`, `frontend/`, `scripts/`, `docs/`.
- Registration closes and voting opens by explicit creator action (`closeRegistration`), voting ends by `endPoll`; no timestamps, to keep local testing simple.
- Public signals: merkle root, nullifier hash, poll id, vote option (all bound).

## Left to the builder
Exact file layout, UI styling, error messages, README wording.
