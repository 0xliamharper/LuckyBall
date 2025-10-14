// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title LuckyBall
/// @notice Encrypted lottery using Zama FHEVM on Sepolia
contract LuckyBall is SepoliaConfig {
    uint256 public constant TICKET_PRICE = 1e15; // 0.001 ether
    uint8 private constant MIN_NUMBER = 1;
    uint8 private constant MAX_NUMBER = 9;
    uint32 private constant WIN_REWARD = 10;

    struct Ticket {
        euint8 number;
        uint256 drawId;
        bool claimed;
    }

    struct Draw {
        uint8 winningNumber;
        uint256 executedAt;
        bool executed;
    }

    mapping(address => Ticket[]) private playerTickets;
    mapping(address => euint32) private playerScores;
    mapping(address => bool) private scoreInitialized;
    mapping(uint256 => Draw) private draws;

    uint256 public currentDrawId = 1;

    event TicketPurchased(address indexed player, uint256 indexed drawId, uint256 indexed ticketIndex);
    event DrawExecuted(uint256 indexed drawId, uint8 winningNumber);
    event TicketClaimProcessed(address indexed player, uint256 indexed drawId, uint256 indexed ticketIndex);

    constructor() {
        draws[currentDrawId] = Draw({winningNumber: 0, executedAt: block.timestamp, executed: false});
    }

    function buyTicket(externalEuint8 encryptedNumber, bytes calldata inputProof) external payable returns (uint256) {
        require(msg.value == TICKET_PRICE, "Invalid ticket price");
        Draw storage activeDraw = draws[currentDrawId];
        require(!activeDraw.executed, "Draw already executed");

        euint8 number = FHE.fromExternal(encryptedNumber, inputProof);

        _ensureScore(msg.sender);

        playerTickets[msg.sender].push();
        uint256 index = playerTickets[msg.sender].length - 1;
        Ticket storage ticket = playerTickets[msg.sender][index];
        ticket.number = number;
        ticket.drawId = currentDrawId;
        ticket.claimed = false;

        FHE.allowThis(ticket.number);
        FHE.allow(ticket.number, msg.sender);

        emit TicketPurchased(msg.sender, currentDrawId, index);
        return index;
    }

    function executeDraw() external returns (uint8) {
        Draw storage activeDraw = draws[currentDrawId];
        require(!activeDraw.executed, "Draw already executed");

        uint8 result = _generateWinningNumber();
        activeDraw.winningNumber = result;
        activeDraw.executedAt = block.timestamp;
        activeDraw.executed = true;

        emit DrawExecuted(currentDrawId, result);

        currentDrawId += 1;
        draws[currentDrawId] = Draw({winningNumber: 0, executedAt: block.timestamp, executed: false});

        return result;
    }

    function claimTicket(uint256 ticketIndex) external {
        require(ticketIndex < playerTickets[msg.sender].length, "Invalid ticket index");

        Ticket storage ticket = playerTickets[msg.sender][ticketIndex];
        require(!ticket.claimed, "Already processed");

        Draw storage settledDraw = draws[ticket.drawId];
        require(settledDraw.executed, "Draw not executed");

        euint8 winningEncrypted = FHE.asEuint8(settledDraw.winningNumber);
        ebool isWinner = FHE.eq(ticket.number, winningEncrypted);

        euint32 currentScore = playerScores[msg.sender];
        euint32 incremented = FHE.add(currentScore, FHE.asEuint32(WIN_REWARD));
        euint32 nextScore = FHE.select(isWinner, incremented, currentScore);

        playerScores[msg.sender] = nextScore;
        ticket.claimed = true;

        FHE.allowThis(nextScore);
        FHE.allow(nextScore, msg.sender);

        emit TicketClaimProcessed(msg.sender, ticket.drawId, ticketIndex);
    }

    function getScore(address player) external view returns (euint32) {
        return playerScores[player];
    }

    function getTickets(address player) external view returns (Ticket[] memory) {
        return playerTickets[player];
    }

    function getDraw(uint256 drawId) external view returns (Draw memory) {
        return draws[drawId];
    }

    function totalTickets(address player) external view returns (uint256) {
        return playerTickets[player].length;
    }

    function _ensureScore(address player) private {
        if (!scoreInitialized[player]) {
            euint32 zeroScore = FHE.asEuint32(0);
            playerScores[player] = zeroScore;
            FHE.allowThis(zeroScore);
            FHE.allow(zeroScore, player);
            scoreInitialized[player] = true;
        } else {
            FHE.allow(playerScores[player], player);
        }
    }

    function _generateWinningNumber() private view returns (uint8) {
        uint256 randomness = uint256(
            keccak256(
                abi.encodePacked(block.prevrandao, blockhash(block.number - 1), address(this), currentDrawId, block.timestamp)
            )
        );
        return uint8((randomness % MAX_NUMBER) + MIN_NUMBER);
    }
}
