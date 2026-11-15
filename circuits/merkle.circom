pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Computes the Merkle root from a leaf and its authentication path.
// pathIndices[i] == 1 means the running node is the RIGHT child at level i.
template MerkleProof(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    signal cur[depth + 1];
    signal left[depth];
    signal right[depth];
    component hashers[depth];

    cur[0] <== leaf;
    for (var i = 0; i < depth; i++) {
        // enforce boolean index
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        left[i] <== cur[i] + pathIndices[i] * (pathElements[i] - cur[i]);
        right[i] <== pathElements[i] + pathIndices[i] * (cur[i] - pathElements[i]);

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        cur[i + 1] <== hashers[i].out;
    }
    root <== cur[depth];
}
