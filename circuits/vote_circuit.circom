pragma circom 2.1.0;

include "identity.circom";
include "merkle.circom";

// Proves: "I know (nullifier, trapdoor) whose commitment is a leaf under `root`,
// and `nullifierHash` is the nullifier scoped to `pollId`." The chosen `vote`
// and the `pollId` are public inputs, so a proof cannot be reused for another
// option or another poll.
template Vote(depth) {
    // public
    signal input root;
    signal input nullifierHash;
    signal input pollId;
    signal input vote;
    // private
    signal input nullifier;
    signal input trapdoor;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    component id = Identity();
    id.nullifier <== nullifier;
    id.trapdoor <== trapdoor;
    id.pollId <== pollId;

    // nullifier published by the voter must be the one derived from the secret
    nullifierHash === id.nullifierHash;

    component tree = MerkleProof(depth);
    tree.leaf <== id.commitment;
    for (var i = 0; i < depth; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    root === tree.root;

    // Bind `vote` into the proof so it cannot be optimised away.
    signal voteSquare;
    voteSquare <== vote * vote;
}
