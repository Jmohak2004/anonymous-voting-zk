# Anonymous Voting dApp (zk-SNARKs)

Anonymous, one-person-one-vote polls on an EVM chain. Voters register a hidden commitment, then prove in zero knowledge that they are a registered member and vote - without revealing which member they are.

> Work in progress. Full docs land at the end of the build.

## Prerequisites

- Node.js 20+
- circom 2.2.3 (prebuilt release binary from https://github.com/iden3/circom/releases, or build from source with Cargo); put it on your `PATH`
- Run `scripts/check-env.sh` to verify
