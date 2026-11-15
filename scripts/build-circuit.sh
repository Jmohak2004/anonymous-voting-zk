#!/usr/bin/env bash
# Compiles the vote circuit, runs a DEV-ONLY trusted setup (single local
# contribution; NOT safe for real elections), and exports the Solidity verifier.
set -euo pipefail
cd "$(dirname "$0")/.."
SNARKJS="npx --no-install snarkjs"
B=circuits/build
POWER=14
mkdir -p "$B"

circom circuits/vote.circom --r1cs --wasm --sym -o "$B"
cp "$B/vote_js/vote.wasm" "$B/vote.wasm"
$SNARKJS r1cs info "$B/vote.r1cs"

if [ ! -f "$B/pot${POWER}_final.ptau" ]; then
  $SNARKJS powersoftau new bn128 $POWER "$B/pot${POWER}_0000.ptau"
  $SNARKJS powersoftau contribute "$B/pot${POWER}_0000.ptau" "$B/pot${POWER}_0001.ptau" \
    --name="dev contribution" -e="$(openssl rand -hex 32)"
  $SNARKJS powersoftau prepare phase2 "$B/pot${POWER}_0001.ptau" "$B/pot${POWER}_final.ptau"
  rm -f "$B/pot${POWER}_0000.ptau" "$B/pot${POWER}_0001.ptau"
fi

$SNARKJS groth16 setup "$B/vote.r1cs" "$B/pot${POWER}_final.ptau" "$B/vote_0000.zkey"
$SNARKJS zkey contribute "$B/vote_0000.zkey" "$B/vote_final.zkey" \
  --name="dev contribution" -e="$(openssl rand -hex 32)"
rm -f "$B/vote_0000.zkey"
$SNARKJS zkey export verificationkey "$B/vote_final.zkey" "$B/verification_key.json"
$SNARKJS zkey export solidityverifier "$B/vote_final.zkey" contracts/Verifier.sol
echo "build-circuit: OK"
