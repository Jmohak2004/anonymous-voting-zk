// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

/// @notice Append-only Poseidon Merkle tree (depth 20, empty leaf = 0).
library IncrementalTree {
    uint256 internal constant DEPTH = 20;

    struct Tree {
        uint256 size;
        uint256 root;
        uint256[20] filled; // left siblings awaiting a right neighbour, per level
    }

    error TreeFull();

    /// @dev zeros[0] = 0, zeros[i+1] = H(zeros[i], zeros[i]).
    function computeZeros() internal pure returns (uint256[20] memory zeros) {
        for (uint256 i = 1; i < DEPTH; i++) {
            zeros[i] = PoseidonT3.hash([zeros[i - 1], zeros[i - 1]]);
        }
    }

    function insert(Tree storage t, uint256[20] storage zeros, uint256 leaf)
        internal
        returns (uint256 index)
    {
        index = t.size;
        if (index >= (uint256(1) << DEPTH)) revert TreeFull();
        uint256 cur = leaf;
        uint256 idx = index;
        for (uint256 i = 0; i < DEPTH; i++) {
            if (idx & 1 == 0) {
                t.filled[i] = cur;
                cur = PoseidonT3.hash([cur, zeros[i]]);
            } else {
                cur = PoseidonT3.hash([t.filled[i], cur]);
            }
            idx >>= 1;
        }
        t.root = cur;
        t.size = index + 1;
    }
}
