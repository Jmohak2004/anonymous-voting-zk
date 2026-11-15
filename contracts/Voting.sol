// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IncrementalTree} from "./lib/IncrementalTree.sol";

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata pubSignals
    ) external view returns (bool);
}

/// @title Anonymous voting with zero-knowledge membership proofs.
/// @notice Voters register a Poseidon commitment, then vote with a Groth16 proof
///         that they own a registered commitment, without revealing which one.
contract Voting {
    using IncrementalTree for IncrementalTree.Tree;

    enum Phase { Registration, Voting, Ended }

    struct Poll {
        address creator;
        string question;
        string[] options;
        Phase phase;
        uint256 root; // frozen when registration closes
        IncrementalTree.Tree tree;
        uint256[] commitments;
        uint256[] tally;
        mapping(address => bool) registered;
        mapping(uint256 => bool) hasCommitment;
        mapping(uint256 => bool) usedNullifiers;
    }

    uint256 internal constant FIELD_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant MIN_OPTIONS = 2;
    uint256 internal constant MAX_OPTIONS = 8;

    IGroth16Verifier public immutable verifier;
    uint256 public pollCount;
    uint256[20] internal zeros;
    mapping(uint256 => Poll) internal polls;

    event PollCreated(uint256 indexed pollId, address indexed creator);
    event MemberRegistered(uint256 indexed pollId, uint256 commitment, uint256 index);
    event RegistrationClosed(uint256 indexed pollId, uint256 root);
    event PollEnded(uint256 indexed pollId);

    error InvalidOptions();
    error InvalidQuestion();
    error PollNotFound();
    error WrongPhase();
    error AlreadyRegistered();
    error InvalidCommitment();
    error DuplicateCommitment();
    error NotCreator();
    error NoMembers();

    constructor(address verifier_) {
        verifier = IGroth16Verifier(verifier_);
        zeros = IncrementalTree.computeZeros();
    }

    function createPoll(string calldata question, string[] calldata options)
        external
        returns (uint256 pollId)
    {
        if (bytes(question).length == 0) revert InvalidQuestion();
        if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) revert InvalidOptions();

        pollId = pollCount++;
        Poll storage p = polls[pollId];
        p.creator = msg.sender;
        p.question = question;
        for (uint256 i = 0; i < options.length; i++) {
            p.options.push(options[i]);
            p.tally.push(0);
        }
        emit PollCreated(pollId, msg.sender);
    }

    function register(uint256 pollId, uint256 commitment) external {
        Poll storage p = _poll(pollId);
        if (p.phase != Phase.Registration) revert WrongPhase();
        if (commitment == 0 || commitment >= FIELD_ORDER) revert InvalidCommitment();
        if (p.registered[msg.sender]) revert AlreadyRegistered();
        if (p.hasCommitment[commitment]) revert DuplicateCommitment();

        p.registered[msg.sender] = true;
        p.hasCommitment[commitment] = true;
        uint256 index = p.tree.insert(zeros, commitment);
        p.commitments.push(commitment);
        emit MemberRegistered(pollId, commitment, index);
    }

    /// @notice Freezes the member set and opens voting. Creator only, needs >= 1 member.
    function closeRegistration(uint256 pollId) external {
        Poll storage p = _poll(pollId);
        if (msg.sender != p.creator) revert NotCreator();
        if (p.phase != Phase.Registration) revert WrongPhase();
        if (p.tree.size == 0) revert NoMembers();
        p.phase = Phase.Voting;
        p.root = p.tree.root;
        emit RegistrationClosed(pollId, p.root);
    }

    /// @notice Ends voting. Creator only.
    function endPoll(uint256 pollId) external {
        Poll storage p = _poll(pollId);
        if (msg.sender != p.creator) revert NotCreator();
        if (p.phase != Phase.Voting) revert WrongPhase();
        p.phase = Phase.Ended;
        emit PollEnded(pollId);
    }

    function _poll(uint256 pollId) internal view returns (Poll storage p) {
        if (pollId >= pollCount) revert PollNotFound();
        p = polls[pollId];
    }
}
