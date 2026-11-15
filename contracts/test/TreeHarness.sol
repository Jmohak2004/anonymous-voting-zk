// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IncrementalTree} from "../lib/IncrementalTree.sol";

/// @dev Test-only wrapper exposing the tree library.
contract TreeHarness {
    using IncrementalTree for IncrementalTree.Tree;

    IncrementalTree.Tree internal tree;
    uint256[20] internal zeros;

    error TreeFull();

    constructor() {
        zeros = IncrementalTree.computeZeros();
    }

    function insert(uint256 leaf) external returns (uint256) {
        return tree.insert(zeros, leaf);
    }

    function root() external view returns (uint256) {
        return tree.root;
    }

    function size() external view returns (uint256) {
        return tree.size;
    }

    function forceSize(uint256 s) external {
        tree.size = s;
    }
}
