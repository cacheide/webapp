// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Escrow - buyer locks ETH, releases to seller, or reclaims after deadline.
contract Escrow {
    enum Status { None, Funded, Released, Refunded }

    struct Deal {
        uint256 id;
        address buyer;
        address seller;
        uint256 amount;
        uint64 deadline;
        Status status;
    }

    uint64 public constant MIN_DURATION = 1 hours;
    uint64 public constant MAX_DURATION = 365 days;
    uint256 public constant MAX_PAGE = 50;
    uint256 public dealCount;
    mapping(uint256 => Deal) private _deals;
    mapping(address => uint256[]) private _idsOf;

    event DealCreated(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount, uint64 deadline);
    event DealReleased(uint256 indexed id, address indexed seller, uint256 amount);
    event DealRefunded(uint256 indexed id, address indexed buyer, uint256 amount);

    error ZeroAmount();
    error InvalidSeller();
    error InvalidDuration();
    error NotBuyer();
    error NotFunded();
    error DeadlineNotReached();
    error TransferFailed();

    function createDeal(address seller, uint64 duration) external payable returns (uint256 id) {
        // checks
        if (msg.value == 0) revert ZeroAmount();
        if (seller == address(0) || seller == msg.sender) revert InvalidSeller();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();
        // effects
        uint64 deadline = uint64(block.timestamp) + duration;
        id = ++dealCount;
        _deals[id] = Deal(id, msg.sender, seller, msg.value, deadline, Status.Funded);
        _idsOf[msg.sender].push(id);
        _idsOf[seller].push(id);
        emit DealCreated(id, msg.sender, seller, msg.value, deadline);
    }

    function release(uint256 id) external {
        Deal storage d = _deals[id];
        // checks (unknown id: buyer is address(0), so this always reverts)
        if (msg.sender != d.buyer) revert NotBuyer();
        if (d.status != Status.Funded) revert NotFunded();
        // effects
        d.status = Status.Released;
        emit DealReleased(id, d.seller, d.amount);
        // interactions
        (bool ok, ) = d.seller.call{value: d.amount}("");
        if (!ok) revert TransferFailed();
    }

    function reclaim(uint256 id) external {
        Deal storage d = _deals[id];
        // checks
        if (msg.sender != d.buyer) revert NotBuyer();
        if (d.status != Status.Funded) revert NotFunded();
        if (block.timestamp < d.deadline) revert DeadlineNotReached();
        // effects
        d.status = Status.Refunded;
        emit DealRefunded(id, d.buyer, d.amount);
        // interactions
        (bool ok, ) = d.buyer.call{value: d.amount}("");
        if (!ok) revert TransferFailed();
    }

    function getDeal(uint256 id) external view returns (Deal memory) { return _deals[id]; }

    function dealCountOf(address user) external view returns (uint256) { return _idsOf[user].length; }

    /// Paged on purpose: anyone can name you as seller, so the list is unbounded.
    function dealsOf(address user, uint256 start, uint256 limit) external view returns (Deal[] memory out) {
        uint256[] storage ids = _idsOf[user];
        uint256 n = ids.length;
        if (start >= n) return out;
        if (limit > MAX_PAGE) limit = MAX_PAGE;
        uint256 end = start + limit > n ? n : start + limit;
        out = new Deal[](end - start);
        for (uint256 i = start; i < end; i++) out[i - start] = _deals[ids[i]];
    }
}
