pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// A voter identity is (nullifier, trapdoor). Registered on-chain as the
// commitment; the nullifierHash is revealed when voting, scoped to one poll.
template Identity() {
    signal input nullifier;
    signal input trapdoor;
    signal input pollId;
    signal output commitment;
    signal output nullifierHash;

    component c = Poseidon(2);
    c.inputs[0] <== nullifier;
    c.inputs[1] <== trapdoor;
    commitment <== c.out;

    component n = Poseidon(2);
    n.inputs[0] <== nullifier;
    n.inputs[1] <== pollId;
    nullifierHash <== n.out;
}
