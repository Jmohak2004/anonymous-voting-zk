pragma circom 2.1.0;

include "vote_circuit.circom";

// Public signals order: [root, nullifierHash, pollId, vote]
component main {public [root, nullifierHash, pollId, vote]} = Vote(20);
