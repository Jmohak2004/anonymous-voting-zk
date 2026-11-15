#!/usr/bin/env bash
# Verifies the tools required to build and test the circuits are installed.
set -u
fail() { echo "MISSING: $1" >&2; exit 1; }
command -v node >/dev/null || fail node
echo "node $(node --version)"
command -v circom >/dev/null || fail "circom (see README Prerequisites)"
echo "$(circom --version)"
node -e "require('snarkjs')" >/dev/null 2>&1 || fail "snarkjs (run npm install)"
echo "snarkjs $(node -e "console.log(JSON.parse(require('fs').readFileSync('node_modules/snarkjs/package.json')).version)")"
