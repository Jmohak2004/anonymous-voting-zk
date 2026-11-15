# Security notes and limitations

This is a learning/demo project. Known limitations, stated plainly:

1. **Dev-only trusted setup.** `npm run build:circuit` runs a single-party powers-of-tau and phase-2 contribution on your machine. Whoever holds that toxic waste could forge proofs. A real deployment needs a public multi-party ceremony (or a transparent proof system).
2. **Weak Sybil resistance.** Registration is open; each *address* can register once per poll, but anyone can create many addresses. Real elections need an eligibility mechanism (allowlist, token, identity proof).
3. **Anonymity is only as good as the network layer.** Registration transactions reveal which address registered (that is public by design). Vote transactions reveal their sender, so voting from the same address you registered with links your vote to you. Vote from a fresh funded address (import your identity backup there) or use a relayer; this project ships no relayer.
4. **Secrets live in `localStorage`.** Losing browser data loses the right to vote unless you exported the backup. Anyone who gets the secret can vote as you.
5. **Creator trust.** The creator decides when registration closes and the poll ends. They can close early but cannot see or alter votes, or forge membership.
6. **Root frozen at close.** Votes verify against the root fixed by `closeRegistration`, so there are no stale-root or late-registration attacks.
7. **Replay protection.** `pollId` and `vote` are public inputs of the proof and the nullifier is per poll: a proof cannot be reused for another option, another poll or twice (all covered by tests).
8. **Unaudited.** No formal audit. Gas costs are not optimised.
9. The headless-browser check of the full UI flow was done on a local Hardhat chain only.
