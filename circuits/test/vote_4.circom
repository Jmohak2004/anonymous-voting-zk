pragma circom 2.1.0;

include "../vote_circuit.circom";

component main {public [root, nullifierHash, pollId, vote]} = Vote(4);
