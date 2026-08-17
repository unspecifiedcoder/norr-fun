// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeeRouter
 * @notice Programmable, multi-recipient routing of IDO proceeds.
 *
 * An IDO raises funds into a single vault today, which leaves every downstream
 * split (creator revenue, distribution partners, community rewards, buybacks,
 * liquidity, treasury) to off-chain trust. FeeRouter makes that split explicit
 * and enforceable on-chain: a launch declares who earns what, in basis points,
 * and recipients pull their own share.
 *
 * Design notes:
 *  - Splits are basis points and MUST total exactly 10_000. Rejecting anything
 *    else is deliberate -- a split that silently under-allocates would leave
 *    dust stranded in the contract with no owner.
 *  - Recipients *pull* via `release`. Push-on-deposit would let one reverting
 *    or gas-hungry recipient brick every deposit for everyone else.
 *  - Accounting is cumulative (`totalReceived`), so a deposit that arrives
 *    after some recipients have already withdrawn is still divided correctly.
 *    Each recipient's entitlement is always
 *        totalReceived * bps / 10_000 - released[recipient]
 *    which is monotonic and independent of withdrawal ordering.
 *  - `lock()` is one-way. Contributors need to be able to verify that the
 *    economics they bought into cannot be rewritten after the fact.
 */
contract FeeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Categories mirror how launch proceeds are actually earmarked.
    enum Category {
        Creator,
        Partner,
        Rewards,
        Marketing,
        Buyback,
        Liquidity,
        Treasury,
        Custom
    }

    struct Split {
        address recipient;
        uint96 bps;
        Category category;
        string label;
    }

    /// @notice Asset being routed. Immutable so recipients cannot be rugged
    ///         into a worthless token after configuring their share.
    IERC20 public immutable asset;

    address public owner;

    /// @notice Once locked the split is permanently immutable.
    bool public locked;

    Split[] private _splits;

    /// @notice bps per recipient, aggregated across duplicate entries.
    mapping(address => uint256) public bpsOf;

    /// @notice Cumulative asset ever recognised by this router.
    uint256 public totalReceived;

    /// @notice Cumulative asset already paid out, per recipient.
    mapping(address => uint256) public released;

    /// @notice Cumulative asset paid out across all recipients.
    uint256 public totalReleased;

    event SplitsUpdated(uint256 count);
    event Locked();
    event Deposited(address indexed from, uint256 amount, uint256 totalReceived);
    event Released(address indexed recipient, uint256 amount);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error AlreadyLocked();
    error NoSplits();
    error BpsMustTotalDenominator(uint256 provided);
    error ZeroRecipient();
    error ZeroBps();
    error ZeroAmount();
    error NothingToRelease();
    error NotARecipient();
    error ZeroAddress();

    constructor(address _asset, address _owner, Split[] memory splits_) {
        if (_asset == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();

        asset = IERC20(_asset);
        owner = _owner;
        _setSplits(splits_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // --- configuration ---

    /**
     * @notice Replace the split table. Only callable before `lock()`.
     * @dev Rewriting splits after funds have arrived would retroactively change
     *      what already-accrued value is owed, so this is restricted to the
     *      pre-lock window and IDO integrations are expected to lock at
     *      finalize time.
     */
    function setSplits(Split[] calldata splits_) external onlyOwner {
        if (locked) revert AlreadyLocked();
        _setSplits(splits_);
    }

    function _setSplits(Split[] memory splits_) private {
        if (splits_.length == 0) revert NoSplits();

        // Clear prior aggregation before rebuilding it.
        uint256 existing = _splits.length;
        for (uint256 i = 0; i < existing; i++) {
            bpsOf[_splits[i].recipient] = 0;
        }
        delete _splits;

        uint256 total;
        for (uint256 i = 0; i < splits_.length; i++) {
            Split memory s = splits_[i];
            if (s.recipient == address(0)) revert ZeroRecipient();
            if (s.bps == 0) revert ZeroBps();

            total += s.bps;
            // Duplicate recipients are summed rather than rejected, so a single
            // address can legitimately hold e.g. both a creator and a treasury
            // allocation without needing two wallets.
            bpsOf[s.recipient] += s.bps;
            _splits.push(s);
        }

        if (total != BPS_DENOMINATOR) revert BpsMustTotalDenominator(total);

        emit SplitsUpdated(splits_.length);
    }

    /// @notice Permanently freeze the split table.
    function lock() external onlyOwner {
        if (locked) revert AlreadyLocked();
        locked = true;
        emit Locked();
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    // --- funding ---

    /**
     * @notice Pull `amount` of `asset` from the caller and recognise it.
     * @dev Recognises the amount actually received rather than the amount
     *      requested, so fee-on-transfer assets cannot inflate `totalReceived`
     *      beyond the contract's real balance and strand the last withdrawer.
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 before = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = asset.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        totalReceived += received;
        emit Deposited(msg.sender, received, totalReceived);
    }

    /**
     * @notice Recognise assets transferred in directly, without `deposit`.
     * @dev A plain ERC20 transfer cannot notify this contract, so proceeds sent
     *      straight to this address would otherwise never become claimable.
     *      Syncing the untracked balance makes those funds routable too.
     */
    function sync() external nonReentrant returns (uint256 recognised) {
        uint256 balance = asset.balanceOf(address(this));
        uint256 tracked = totalReceived - totalReleased;
        if (balance <= tracked) revert ZeroAmount();

        recognised = balance - tracked;
        totalReceived += recognised;
        emit Deposited(msg.sender, recognised, totalReceived);
    }

    // --- distribution ---

    /// @notice Asset currently claimable by `recipient`.
    function releasable(address recipient) public view returns (uint256) {
        uint256 bps = bpsOf[recipient];
        if (bps == 0) return 0;

        uint256 entitled = (totalReceived * bps) / BPS_DENOMINATOR;
        uint256 paid = released[recipient];
        return entitled > paid ? entitled - paid : 0;
    }

    /// @notice Withdraw everything currently owed to `recipient`.
    function release(address recipient) external nonReentrant returns (uint256 amount) {
        if (bpsOf[recipient] == 0) revert NotARecipient();

        amount = releasable(recipient);
        if (amount == 0) revert NothingToRelease();

        // Credit before transferring so a reentrant call sees the updated total.
        released[recipient] += amount;
        totalReleased += amount;

        asset.safeTransfer(recipient, amount);
        emit Released(recipient, amount);
    }

    // --- views ---

    function splitCount() external view returns (uint256) {
        return _splits.length;
    }

    function splits() external view returns (Split[] memory) {
        return _splits;
    }

    function splitAt(uint256 index) external view returns (Split memory) {
        return _splits[index];
    }

    /// @notice Recognised-but-unclaimed asset still held by the router.
    function pending() external view returns (uint256) {
        return totalReceived - totalReleased;
    }
}
