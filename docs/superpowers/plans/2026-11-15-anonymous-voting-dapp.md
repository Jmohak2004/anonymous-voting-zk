# Anonymous Voting dApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A complete on-chain anonymous voting dapp: Circom membership+nullifier circuit, Groth16 verification in a Solidity `Voting` contract, React frontend that proves in the browser, delivered as a GitHub repo with exactly 22 commits.

**Architecture:** Each poll owns an incremental Poseidon Merkle tree of voter commitments on-chain. After registration closes, the root is frozen. A vote is a Groth16 proof that the voter knows a commitment preimage in that tree; the proof exposes a per-poll nullifier hash and the chosen option as public inputs, so double votes and option tampering are rejected by the contract. Shared TypeScript (`shared/zk.ts`) is used by contract tests, the e2e script and the frontend.

**Tech Stack:** Circom 2 + circomlib, snarkjs (Groth16), circomlibjs, poseidon-solidity, Hardhat 2.x (TypeScript, ethers v6, Chai), React + Vite + TypeScript, Vitest, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-11-15-anonymous-voting-dapp-design.md`

## Global Constraints

- Merkle depth 20 (constant `TREE_DEPTH = 20` in circuit main, contract and `shared/zk.ts`); may drop to 16 only if browser proving is too slow, changing all three together.
- Public signals, in this exact order: `[root, nullifierHash, pollId, vote]`.
- Commitment = `Poseidon(nullifier, trapdoor)`; nullifierHash = `Poseidon(nullifier, pollId)`; Merkle node = `Poseidon(left, right)`; empty leaf = `0`.
- Open registration; one address registers once per poll; phases are explicit (`Registration → Voting → Ended`), no timestamps.
- Local Hardhat chain only; a `sepolia` network entry in config but not used.
- Dev-only trusted setup (documented as not production-safe).
- Secrets (nullifier, trapdoor) live only in the user's browser `localStorage`, never sent anywhere.
- Poll options: 2 to 8 inclusive (my call).
- Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Exactly one commit per task, 22 total.
- Layout: `circuits/`, `contracts/`, `test/`, `shared/`, `scripts/`, `frontend/`, `docs/`.

## Review Focus

1. Commitment equal to or above the BN254 scalar field order, or a duplicate commitment in the same poll → `register` reverts (Task 9).
2. Vote option index ≥ number of options → `castVote` reverts (Task 11).
3. Phase violations: registering after close, voting before close, voting after end, closing with zero members → revert (Tasks 9, 10, 11).
4. Same identity voting in two different polls must succeed in both (nullifier is per-poll), but twice in one poll must revert (Task 11).
5. A valid proof replayed with a different `vote` value or different `nullifierHash` must fail verification (Task 11).

---

### Task 1: Repo init

**Files:** Create `.gitignore`, `package.json` (private root), `README.md` (title + one-paragraph stub). Existing: `docs/superpowers/**`.

- [ ] **Step 1:** `git init -b main` in `/Users/mohakjaiswal/zk`; use the existing global git identity (check `git config user.name user.email`; if unset, stop and ask the user).
- [ ] **Step 2:** `.gitignore` covering `node_modules`, `artifacts`, `cache`, `typechain-types`, `frontend/dist`, `circuits/build/*.ptau`, `.env`.
- [ ] **Step 3:** Commit all: `chore: initialize repo with design doc and plan`.

### Task 2: Toolchain install and check

**Files:** Create `scripts/check-env.sh`.

**Produces:** `scripts/check-env.sh` exits 0 only if `node`, `circom`, `snarkjs` (via `npx`) are available.

- [ ] **Step 1:** Install circom from source: clone `https://github.com/iden3/circom.git` into the scratchpad (not the repo), checkout the latest 2.x release tag, `cargo build --release && cargo install --path circom`.
- [ ] **Step 2:** `scripts/check-env.sh` prints versions of node, circom, snarkjs and exits non-zero naming the first missing tool.
- [ ] **Step 3:** Run it; Expected: three versions printed, exit 0. Record the circom version in `README.md` Prerequisites.
- [ ] **Step 4:** Commit: `chore: add toolchain check script`.

### Task 3: Identity circuit

**Files:** Create `circuits/identity.circom`, `circuits/test/identity.test.ts`; add dev deps `circom_tester`, `circomlib`, `circomlibjs`, `mocha`/`chai`, `ts-node` at root.

**Produces:** `template Identity()` with inputs `nullifier, trapdoor, pollId`, outputs `commitment, nullifierHash`.

- [ ] **Step 1: Failing test** `identity.test.ts`: `commitment equals Poseidon(nullifier, trapdoor)` and `nullifierHash equals Poseidon(nullifier, pollId)` (expected values from circomlibjs), and `nullifierHash differs for different pollId`.
- [ ] **Step 2:** Run (`npx mocha -r ts-node/register circuits/test/identity.test.ts`); Expected: FAIL, circuit missing.
- [ ] **Step 3:** Implement `Identity()` using circomlib `Poseidon(2)` twice.
- [ ] **Step 4:** Run; Expected: 3 passing.
- [ ] **Step 5:** Commit: `feat(circuit): identity commitment and nullifier`.

### Task 4: Merkle membership circuit

**Files:** Create `circuits/merkle.circom`, `circuits/test/merkle.test.ts`.

**Produces:** `template MerkleProof(depth)`: inputs `leaf, pathElements[depth], pathIndices[depth]`, output `root`. `pathIndices[i]` ∈ {0,1} enforced; 1 means the current node is the right child. Uses `Poseidon(2)` and circomlib `Mux1`/`Switcher`.

- [ ] **Step 1: Failing tests** (depth 4 instance for speed): `computes the same root as JS tree for leaf at index 0 and index 5 of 8 leaves` (reference tree built inline with circomlibjs, empty leaf 0); `rejects pathIndices value 2`.
- [ ] **Step 2:** Run; Expected: FAIL.
- [ ] **Step 3:** Implement `MerkleProof(depth)`.
- [ ] **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Commit: `feat(circuit): merkle membership proof`.

### Task 5: Vote circuit

**Files:** Create `circuits/vote.circom`, `circuits/test/vote.test.ts`.

**Consumes:** `Identity`, `MerkleProof`.
**Produces:** `component main {public [root, nullifierHash, pollId, vote]} = Vote(20);` Private inputs: `nullifier, trapdoor, pathElements[20], pathIndices[20]`. Constrains: computed commitment is a leaf under `root`; computed nullifierHash === public `nullifierHash`; a dummy square constraint on `vote` so it cannot be optimised out.

- [ ] **Step 1: Failing tests** (use `Vote(4)` via a test wrapper circuit `circuits/test/vote_4.circom` so tests are fast): `accepts a valid witness`; `rejects wrong root`; `rejects wrong nullifierHash`; `rejects a commitment not in the tree`.
- [ ] **Step 2:** Run; Expected: FAIL.
- [ ] **Step 3:** Implement `Vote(depth)` and the depth-20 `vote.circom` main.
- [ ] **Step 4:** Run; Expected: 4 passing.
- [ ] **Step 5:** Commit: `feat(circuit): vote circuit with nullifier and vote binding`.

### Task 6: Trusted setup and verifier export

**Files:** Create `scripts/build-circuit.sh`; outputs (git-tracked except `.ptau`) in `circuits/build/`: `vote.wasm`, `vote_final.zkey`, `verification_key.json`; `contracts/Verifier.sol`.

**Produces:** `npm run build:circuit` produces the above. Verifier is snarkjs's `Groth16Verifier` with `verifyProof(uint[2], uint[2][2], uint[2], uint[4]) view returns (bool)`.

- [ ] **Step 1:** Script: compile `vote.circom` (`--r1cs --wasm`), powers of tau (power 14; increase if snarkjs reports too few), phase-2 setup, one random-entropy contribution, export vkey and `zkey export solidityverifier` to `contracts/Verifier.sol`.
- [ ] **Step 2:** Run it; Expected: files exist, no errors.
- [ ] **Step 3: Smoke check** `scripts/smoke-prove.ts`: generate a proof for a 1-leaf tree and `groth16.verify` against `verification_key.json`; Expected: `true`.
- [ ] **Step 4:** Commit: `feat: trusted setup script and generated verifier`.

### Task 7: Hardhat scaffold

**Files:** Create `hardhat.config.ts`, `tsconfig.json`, `.env.example`; deps `hardhat@2`, toolbox, `poseidon-solidity`.

**Produces:** Solidity 0.8.x compiling `contracts/Verifier.sol`; networks `hardhat`, `localhost`, `sepolia` (reads `SEPOLIA_RPC_URL`, `PRIVATE_KEY` from env, only if set).

- [ ] **Step 1:** `test/verifier.test.ts` `deploys Groth16Verifier and accepts a valid proof` using the smoke-check proof; `rejects a proof with a modified public signal`.
- [ ] **Step 2:** Run `npx hardhat test`; Expected: FAIL until config exists; then PASS after config.
- [ ] **Step 3:** Commit: `chore: hardhat scaffold with verifier tests`.

### Task 8: Merkle tree library and shared TS

**Files:** Create `contracts/lib/IncrementalTree.sol`, `shared/zk.ts`, `test/tree.test.ts`.

**Produces (Solidity):** `library IncrementalTree` with `struct Tree { uint256 size; uint256 root; uint256[20] filled; }`, `function insert(Tree storage t, uint256[20] storage zeros, uint256 leaf) internal returns (uint256 index)`, `function computeZeros() internal returns (uint256[20] memory)`. Hashing via `PoseidonT3.hash([a,b])` from `poseidon-solidity` (library needs linking in tests).
**Produces (TS, `shared/zk.ts`):** `TREE_DEPTH = 20`; `poseidon2(a: bigint, b: bigint): Promise<bigint>`; `createIdentity(): Promise<Identity>` where `Identity = {nullifier: bigint, trapdoor: bigint, commitment: bigint}` (random values below field order); `buildMerkleProof(commitments: bigint[], index: number): Promise<{root: bigint, pathElements: bigint[], pathIndices: number[]}>`; `FIELD_ORDER` constant.
**Test harness:** a tiny `contracts/test/TreeHarness.sol` exposing `insert`.

- [ ] **Step 1: Failing test** `tree.test.ts`: `root after 1, 2, 5 inserts matches buildMerkleProof root`; `index returned increments from 0`; `reverts when tree is full` (use depth-limited check by size == 2**20 via a storage-slot poke or skip with a documented comment if impractical — builder's call).
- [ ] **Step 2:** Run; Expected: FAIL.
- [ ] **Step 3:** Implement library, harness, and `shared/zk.ts` (circomlibjs poseidon, cached builder).
- [ ] **Step 4:** Run; Expected: PASS (Solidity and JS roots agree).
- [ ] **Step 5:** Commit: `feat(contracts): incremental poseidon merkle tree with shared TS reference`.

### Task 9: Voting contract — polls and registration

**Files:** Create `contracts/Voting.sol`, `test/voting.registration.test.ts`; shared fixture `test/fixtures.ts` exporting `deployVoting(): Promise<{voting, verifier, signers}>` (links PoseidonT3, deploys `Groth16Verifier`).

**Produces:** `constructor(address verifier)`; `enum Phase { Registration, Voting, Ended }`; `createPoll(string question, string[] options) returns (uint256 pollId)` (poll ids start at 0; 2–8 options; non-empty question); `register(uint256 pollId, uint256 commitment)`; events `PollCreated(uint256 indexed pollId, address indexed creator)`, `MemberRegistered(uint256 indexed pollId, uint256 commitment, uint256 index)`; errors `InvalidOptions`, `WrongPhase`, `AlreadyRegistered`, `InvalidCommitment`, `DuplicateCommitment`.

- [ ] **Step 1: Failing tests:** `createPoll emits PollCreated with sequential ids`; `createPoll reverts with 1 or 9 options`; `register stores commitment and emits MemberRegistered with index`; `same address cannot register twice in one poll but can in another`; `reverts on commitment >= FIELD_ORDER`; `reverts on duplicate commitment from different address`; `reverts after registration closed` (stub phase set via closeRegistration in Task 10 — mark this one `it.skip` here and enable in Task 10).
- [ ] **Step 2:** Run; Expected: FAIL.
- [ ] **Step 3:** Implement polls mapping, per-poll `IncrementalTree.Tree`, `commitments` array, zeros stored once in constructor.
- [ ] **Step 4:** Run; Expected: PASS (one skipped).
- [ ] **Step 5:** Commit: `feat(contracts): voting polls and anonymous registration`.

### Task 10: Phases

**Files:** Modify `contracts/Voting.sol`, `test/voting.registration.test.ts`; Create `test/voting.phases.test.ts`.

**Produces:** `closeRegistration(uint256 pollId)` (creator only, ≥1 member, freezes `root`, emits `RegistrationClosed(uint256 indexed pollId, uint256 root)`); `endPoll(uint256 pollId)` (creator only, only from Voting phase, emits `PollEnded(uint256 indexed pollId)`); errors `NotCreator`, `NoMembers`.

- [ ] **Step 1: Failing tests:** `only creator can close or end`; `close with zero members reverts NoMembers`; `close freezes root equal to JS buildMerkleProof root`; `register after close reverts WrongPhase` (un-skip); `endPoll before close reverts WrongPhase`; `endPoll after close succeeds`.
- [ ] **Step 2:** Run; Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Commit: `feat(contracts): explicit registration, voting and ended phases`.

### Task 11: castVote with proof verification

**Files:** Modify `contracts/Voting.sol`, `shared/zk.ts`; Create `test/voting.vote.test.ts`.

**Produces (Solidity):** `castVote(uint256 pollId, uint256 option, uint256 nullifierHash, uint256[2] a, uint256[2][2] b, uint256[2] c)`; builds public signals `[root, nullifierHash, pollId, option]`; per-poll `usedNullifiers`; `tally[pollId][option]`; event `VoteCast(uint256 indexed pollId, uint256 option, uint256 nullifierHash)`; errors `InvalidOption`, `NullifierUsed`, `InvalidProof`.
**Produces (TS):** `generateVoteProof(identity: Identity, commitments: bigint[], pollId: bigint, vote: bigint, artifacts: {wasm: string, zkey: string}): Promise<{a, b, c, nullifierHash: bigint}>` using `groth16.fullProve` and `exportSolidityCallData` (handles the `b` coordinate swap). Works with filesystem paths in Node and URLs in the browser.

- [ ] **Step 1: Failing tests (real proofs, 3 registered voters):** `valid vote increments tally and emits VoteCast`; `second vote by same identity reverts NullifierUsed`; `same identity votes once in each of two polls`; `option >= options.length reverts InvalidOption`; `vote before close reverts WrongPhase`; `vote after endPoll reverts WrongPhase`; `proof replayed with different option reverts InvalidProof`; `proof replayed with different nullifierHash reverts InvalidProof`; `identity not in the tree cannot produce a valid vote` (proof generation throws or contract reverts).
- [ ] **Step 2:** Run; Expected: FAIL.
- [ ] **Step 3:** Implement. Order checks: phase, option range, nullifier unused, verify proof, then mark nullifier and tally.
- [ ] **Step 4:** Run; Expected: PASS (proving makes this suite slow; set mocha timeout 120s).
- [ ] **Step 5:** Commit: `feat(contracts): anonymous castVote with groth16 verification`.

### Task 12: Views

**Files:** Modify `contracts/Voting.sol`; Create `test/voting.views.test.ts`.

**Produces:** `pollCount() view returns (uint256)`; `getPoll(uint256) view returns (address creator, string question, string[] options, Phase phase, uint256 memberCount, uint256 root)`; `getTally(uint256) view returns (uint256[] memory)`; `getCommitments(uint256) view returns (uint256[] memory)`; `hasVoted(uint256 pollId, uint256 nullifierHash) view returns (bool)`.

- [ ] **Step 1: Failing tests** covering each view across the full lifecycle (counts, phase transitions, tally, commitments order equals insertion order, root zero before close).
- [ ] **Step 2:** Run; Expected: FAIL. **Step 3:** Implement. **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Commit: `feat(contracts): read-only views for the frontend`.

### Task 13: Deploy script

**Files:** Create `scripts/deploy.ts`; output `frontend/src/contracts/deployment.json` (`{chainId, voting, verifier, poseidon}`) and `frontend/src/contracts/Voting.abi.json`; add npm scripts `chain` (`hardhat node`) and `deploy:local`.

- [ ] **Step 1:** Script deploys PoseidonT3 (linked), `Groth16Verifier`, `Voting`, writes the JSON files.
- [ ] **Step 2:** Run `npm run chain` in the background, then `npm run deploy:local`; Expected: the JSON files exist and contain three addresses and chainId `31337`.
- [ ] **Step 3:** Commit: `feat: local deploy script that exports abi and addresses`.

### Task 14: Frontend scaffold

**Files:** Create `frontend/` (Vite React TS template), `frontend/vite.config.ts` (alias `@shared` → `../shared`, copies `circuits/build/vote.wasm` and `vote_final.zkey` into `frontend/public/zk/` via a `predev`/`prebuild` script), `frontend/src/wallet.tsx`, `frontend/src/App.tsx`.

**Produces:** `useWallet(): {address?: string, signer?: JsonRpcSigner | Wallet, connect(): Promise<void>, chainOk: boolean}`. MetaMask via `BrowserProvider`; plus a dev-mode account switcher (env `VITE_DEV_WALLETS=true`) listing Hardhat accounts 0–9 as `Wallet`s on `JsonRpcProvider("http://127.0.0.1:8545")` so multiple voters can be demoed without MetaMask.

- [ ] **Step 1:** Vitest config and `frontend/src/wallet.test.ts`: `dev wallet list returns 10 distinct addresses when enabled` and `returns empty when disabled`.
- [ ] **Step 2:** Run (`npm --prefix frontend test`); Expected: FAIL, then PASS after implementing.
- [ ] **Step 3:** `npm --prefix frontend run build`; Expected: builds without errors.
- [ ] **Step 4:** Commit: `feat(frontend): vite app scaffold with wallet connection`.

### Task 15: Frontend library layer

**Files:** Create `frontend/src/lib/identityStore.ts`, `frontend/src/lib/contract.ts`, tests beside them.

**Produces:** `saveIdentity(chainId: number, voting: string, pollId: bigint, id: Identity): void`, `loadIdentity(...)` returning `Identity | null`, `exportIdentity/importIdentity(json: string)` (backup so clearing storage doesn't lose the vote right); `getVotingContract(signerOrProvider): Contract` using `deployment.json` and the ABI; `fetchPoll(pollId): Promise<PollView>`; `fetchPolls(): Promise<PollView[]>`.

- [ ] **Step 1: Failing tests:** `identity round-trips through storage keyed per poll`; `different polls do not overwrite each other`; `import rejects malformed JSON`; `loadIdentity returns null when storage throws` (private-mode behavior).
- [ ] **Step 2:** Run; Expected: FAIL. **Step 3:** Implement. **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Commit: `feat(frontend): identity storage and contract client`.

### Task 16: Create-poll page

**Files:** Create `frontend/src/pages/CreatePoll.tsx`, `frontend/src/pages/CreatePoll.test.tsx` (React Testing Library), router in `App.tsx`.

- [ ] **Step 1: Failing tests:** `submit disabled with fewer than 2 or more than 8 non-empty options`; `submit calls createPoll(question, options) and navigates to /poll/:id from the PollCreated event` (contract client mocked).
- [ ] **Step 2:** Run; Expected: FAIL. **Step 3:** Implement form with add/remove option rows and tx pending/error state. **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Commit: `feat(frontend): create poll page`.

### Task 17: Poll page — view and register

**Files:** Create `frontend/src/pages/Poll.tsx`, `Poll.test.tsx`.

**Behavior:** shows question, phase badge, member count; in Registration phase a "Register to vote" button creates an identity (`createIdentity`), saves it, then calls `register(pollId, commitment)`; save happens before the tx and is rolled back if the tx is rejected; creator sees "Close registration".

- [ ] **Step 1: Failing tests:** `register button hidden outside Registration phase`; `identity is saved before tx and removed when tx rejects`; `only creator sees Close registration`; `already-registered address sees a registered notice` (via `MemberRegistered` query or revert decode).
- [ ] **Step 2:** Run; Expected: FAIL. **Step 3:** Implement. **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Commit: `feat(frontend): poll page with registration flow`.

### Task 18: Voting flow

**Files:** Modify `Poll.tsx`; Create `frontend/src/lib/vote.ts`, `vote.test.ts`.

**Produces:** `submitVote(pollId: bigint, option: bigint, signer): Promise<void>`: loads identity (throws `NoIdentityError` if missing, UI shows import-backup prompt), fetches commitments, calls `generateVoteProof` with artifacts `/zk/vote.wasm` and `/zk/vote_final.zkey`, then `castVote`. UI shows proving progress state ("Generating proof…").

- [ ] **Step 1: Failing tests:** `submitVote throws NoIdentityError when no identity stored`; `submitVote passes commitments in on-chain order and the chosen option to the prover` (prover mocked); `UI shows proving state then success`.
- [ ] **Step 2:** Run; Expected: FAIL. **Step 3:** Implement. **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Commit: `feat(frontend): in-browser proving and anonymous vote submission`.

### Task 19: Home list and results

**Files:** Create `frontend/src/pages/Home.tsx`, `frontend/src/components/Results.tsx`, tests.

**Behavior:** Home lists polls (question, phase, members); Results renders tally bars per option with live refresh on `VoteCast` events; shows "Ended" final badge.

- [ ] **Step 1: Failing tests:** `Results renders percentages and handles zero total votes without NaN`; `Home shows empty state with link to create poll`.
- [ ] **Step 2:** Run; Expected: FAIL. **Step 3:** Implement. **Step 4:** Run; Expected: PASS.
- [ ] **Step 5:** Manually verify in the browser: start chain, deploy, `npm --prefix frontend run dev`, run through create → register with 3 dev wallets → close → vote with each → results show 3 votes and a second vote by the same wallet fails. Note outcome in the commit body.
- [ ] **Step 6:** Commit: `feat(frontend): poll list and live results`.

### Task 20: End-to-end script

**Files:** Create `scripts/e2e.ts`; npm script `e2e` (starts in-process Hardhat network, no external node needed).

**Behavior:** Deploys, creates a poll, registers 5 voters, closes, casts 5 votes across 3 options with real proofs, asserts tally, asserts double vote and wrong-option replay revert, ends poll, prints a PASS summary. Exit code non-zero on any failed assertion.

- [ ] **Step 1:** Write it. **Step 2:** Run `npm run e2e`; Expected: `E2E PASS` and tally printed.
- [ ] **Step 3:** Commit: `test: end-to-end voting flow script`.

### Task 21: Documentation

**Files:** Modify `README.md`; Create `docs/ARCHITECTURE.md`, `docs/SECURITY.md`.

**Content:** README: what it is, prerequisites (with recorded circom version), quickstart (`check-env`, `build:circuit`, `chain`, `deploy:local`, frontend dev, tests, e2e), screenshots optional. ARCHITECTURE: circuit signals table, contract phases, data flow diagram (text). SECURITY: dev-only trusted setup, weak Sybil resistance, tree-root freezing rationale, localStorage secret loss/backup, creator-trust assumptions (creator can close early), no timing/network anonymity (tx sender is visible at register time, vote relayer absent, so vote txs can be linked by gas payer — state plainly).

- [ ] **Step 1:** Write docs. **Step 2:** Follow the README quickstart verbatim on a clean shell and confirm each command works.
- [ ] **Step 3:** Commit: `docs: readme, architecture and security notes`.

### Task 22: CI and publish

**Files:** Create `.github/workflows/ci.yml`.

**CI:** Node 20; installs circom from source release (cached); runs `build:circuit`, circuit tests, `hardhat test`, frontend tests, `e2e`.

- [ ] **Step 1:** Write workflow. **Step 2:** Run all of: `npm run test:circuits`, `npx hardhat test`, `npm --prefix frontend test`, `npm run e2e`; Expected: all green; fix before continuing.
- [ ] **Step 3:** Commit: `ci: github actions workflow`. Verify `git rev-list --count HEAD` prints `22`.
- [ ] **Step 4:** Check `gh auth status`. Create the repo: `gh repo create anonymous-voting-zk --private --source=. --remote=origin --push` (private by default; tell the user and how to make it public). Verify with `gh repo view` and `git status -sb`.
