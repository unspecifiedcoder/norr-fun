// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title Promotion
 * @notice Paid, time-limited promotion of a launch in the feed.
 *
 * Tiers are priced in native currency and bought on-chain, so "featured" is a
 * fact anyone can verify rather than a flag some backend sets. Promotion buys
 * *placement only*: it never changes a launch's economics, and the feed labels
 * promoted entries so a reader can tell paid placement from ranking.
 *
 * Slots expire. A permanent purchase would let early launches hold the top of
 * the feed forever, which makes the surface worthless to everyone after them.
 */
contract Promotion {
    struct Tier {
        uint128 price;
        uint64 duration;
        string name;
        bool active;
    }

    address public treasury;
    address public owner;

    Tier[] private _tiers;

    /// @notice Unix time each launch's promotion runs until.
    mapping(address => uint256) public promotedUntil;
    /// @notice Which tier bought the current slot, for display.
    mapping(address => uint256) public tierOf;

    event Promoted(address indexed subject, uint256 indexed tierId, uint256 until, uint256 paid);
    event TierSet(uint256 indexed id, string name, uint128 price, uint64 duration, bool active);
    event TreasuryChanged(address indexed to);

    error NotOwner();
    error UnknownTier();
    error TierInactive();
    error WrongPayment(uint256 sent, uint256 required);
    error ZeroAddress();
    error TransferFailed();

    constructor(address _treasury) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        owner = msg.sender;

        // A free baseline exists so an unpromoted launch is a real choice
        // rather than an absence, and so the tier list is never empty.
        _tiers.push(Tier({ price: 0, duration: 0, name: "Standard", active: true }));
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function addTier(string calldata name, uint128 price, uint64 duration)
        external
        onlyOwner
        returns (uint256 id)
    {
        id = _tiers.length;
        _tiers.push(Tier({ price: price, duration: duration, name: name, active: true }));
        emit TierSet(id, name, price, duration, true);
    }

    function setTierActive(uint256 id, bool active) external onlyOwner {
        if (id >= _tiers.length) revert UnknownTier();
        _tiers[id].active = active;
        Tier storage t = _tiers[id];
        emit TierSet(id, t.name, t.price, t.duration, active);
    }

    function setTreasury(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        treasury = to;
        emit TreasuryChanged(to);
    }

    /**
     * @notice Buy a promotion slot for `subject`.
     * @dev Anyone may pay for any launch -- a desk promoting a project it backs
     *      is legitimate, and gating it on ownership would block that for no
     *      security gain, since the only effect is placement.
     *
     *      Time extends from whichever is later: now, or an unexpired slot. So
     *      buying twice stacks rather than silently discarding the remainder.
     */
    function promote(address subject, uint256 tierId) external payable {
        if (subject == address(0)) revert ZeroAddress();
        if (tierId >= _tiers.length) revert UnknownTier();

        Tier storage t = _tiers[tierId];
        if (!t.active) revert TierInactive();
        if (msg.value != t.price) revert WrongPayment(msg.value, t.price);

        uint256 base = promotedUntil[subject] > block.timestamp
            ? promotedUntil[subject]
            : block.timestamp;
        uint256 until = base + t.duration;

        promotedUntil[subject] = until;
        tierOf[subject] = tierId;

        if (msg.value > 0) {
            (bool ok, ) = treasury.call{ value: msg.value }("");
            if (!ok) revert TransferFailed();
        }

        emit Promoted(subject, tierId, until, msg.value);
    }

    function isPromoted(address subject) external view returns (bool) {
        return promotedUntil[subject] > block.timestamp;
    }

    /// @notice Batch read so a feed can rank in one call.
    function promotedMany(address[] calldata subjects)
        external
        view
        returns (bool[] memory flags, uint256[] memory until)
    {
        flags = new bool[](subjects.length);
        until = new uint256[](subjects.length);
        for (uint256 i = 0; i < subjects.length; i++) {
            until[i] = promotedUntil[subjects[i]];
            flags[i] = until[i] > block.timestamp;
        }
    }

    function tierCount() external view returns (uint256) {
        return _tiers.length;
    }

    function tiers() external view returns (Tier[] memory) {
        return _tiers;
    }

    function tierAt(uint256 id) external view returns (Tier memory) {
        if (id >= _tiers.length) revert UnknownTier();
        return _tiers[id];
    }
}
