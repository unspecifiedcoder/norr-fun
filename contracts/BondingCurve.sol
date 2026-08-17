// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FeeRouter.sol";

/**
 * @title BondingCurve
 * @notice Continuous market for a project token, opened after its sale settles.
 *
 * This does not touch the sealed contribution round. Who contributed how much
 * stays private in the eERC layer; this is the public phase that follows, where
 * anyone can trade the token that was already distributed. The two are
 * sequential, not alternatives.
 *
 * Pricing is constant-product over *virtual* reserves. Virtual reserves let the
 * curve open with a sane starting price and no seeded liquidity — the launch
 * does not have to fund a pool before anyone can trade.
 *
 *     k = (virtualBase + baseReserve) * (tokenReserve)
 *
 * Trading fees route through a `FeeRouter`, so the same split that governed the
 * raise also governs trading revenue.
 *
 * Once `baseReserve` reaches `graduationTarget` the curve locks. Graduation is
 * terminal: reserves are released to the configured recipient to seed a real
 * pool, and no further trading happens here.
 */
contract BondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    /// @dev Both sides must keep a floor so the invariant can never divide by zero.
    uint256 public constant MIN_RESERVE = 1_000;

    IERC20 public immutable token;
    IERC20 public immutable base;
    FeeRouter public immutable fees;

    /// @notice Synthetic base liquidity, setting the opening price.
    uint256 public immutable virtualBase;
    /// @notice Project tokens held by the curve and available to buy.
    uint256 public tokenReserve;
    /// @notice Real base asset paid in by buyers, net of fees.
    uint256 public baseReserve;

    uint256 public immutable graduationTarget;
    uint16 public immutable feeBps;
    address public immutable graduationRecipient;

    bool public graduated;

    event Bought(address indexed buyer, uint256 baseIn, uint256 tokensOut, uint256 fee, uint256 priceX18);
    event Sold(address indexed seller, uint256 tokensIn, uint256 baseOut, uint256 fee, uint256 priceX18);
    event Graduated(uint256 baseReleased, uint256 tokensRemaining);

    error AlreadyGraduated();
    error ZeroAmount();
    error SlippageExceeded(uint256 got, uint256 wanted);
    error InsufficientReserve();
    error ZeroAddress();
    error FeeTooHigh();
    error NotReady();

    constructor(
        address _token,
        address _base,
        address _fees,
        uint256 _virtualBase,
        uint256 _tokenSupplyForCurve,
        uint256 _graduationTarget,
        uint16 _feeBps,
        address _graduationRecipient
    ) {
        if (_token == address(0) || _base == address(0) || _fees == address(0)) revert ZeroAddress();
        if (_graduationRecipient == address(0)) revert ZeroAddress();
        if (_feeBps > 1_000) revert FeeTooHigh(); // 10% ceiling
        if (_virtualBase < MIN_RESERVE || _tokenSupplyForCurve < MIN_RESERVE) revert InsufficientReserve();

        token = IERC20(_token);
        base = IERC20(_base);
        fees = FeeRouter(_fees);
        virtualBase = _virtualBase;
        tokenReserve = _tokenSupplyForCurve;
        graduationTarget = _graduationTarget;
        feeBps = _feeBps;
        graduationRecipient = _graduationRecipient;
    }

    /// @notice Base side of the invariant, including the virtual portion.
    function effectiveBase() public view returns (uint256) {
        return virtualBase + baseReserve;
    }

    /// @notice Current marginal price, scaled by 1e18.
    function priceX18() public view returns (uint256) {
        return (effectiveBase() * 1e18) / tokenReserve;
    }

    /// @notice Tokens received for `baseIn`, fee already deducted.
    function quoteBuy(uint256 baseIn) public view returns (uint256 tokensOut, uint256 fee) {
        if (baseIn == 0) return (0, 0);
        fee = (baseIn * feeBps) / BPS;
        uint256 net = baseIn - fee;

        uint256 x = effectiveBase();
        uint256 k = x * tokenReserve;
        uint256 newX = x + net;
        uint256 newTokenReserve = k / newX;
        tokensOut = tokenReserve - newTokenReserve;
    }

    /// @notice Base returned for `tokensIn`, fee already deducted.
    function quoteSell(uint256 tokensIn) public view returns (uint256 baseOut, uint256 fee) {
        if (tokensIn == 0) return (0, 0);

        uint256 x = effectiveBase();
        uint256 k = x * tokenReserve;
        uint256 newTokenReserve = tokenReserve + tokensIn;
        uint256 newX = k / newTokenReserve;
        uint256 gross = x - newX;

        // A seller can never withdraw the virtual portion; it is not real money.
        if (gross > baseReserve) gross = baseReserve;

        fee = (gross * feeBps) / BPS;
        baseOut = gross - fee;
    }

    function buy(uint256 baseIn, uint256 minTokensOut) external nonReentrant returns (uint256 tokensOut) {
        if (graduated) revert AlreadyGraduated();
        if (baseIn == 0) revert ZeroAmount();

        uint256 fee;
        (tokensOut, fee) = quoteBuy(baseIn);
        if (tokensOut == 0) revert ZeroAmount();
        if (tokensOut < minTokensOut) revert SlippageExceeded(tokensOut, minTokensOut);
        if (tokenReserve - tokensOut < MIN_RESERVE) revert InsufficientReserve();

        base.safeTransferFrom(msg.sender, address(this), baseIn);

        tokenReserve -= tokensOut;
        baseReserve += baseIn - fee;

        if (fee > 0) {
            base.forceApprove(address(fees), fee);
            fees.deposit(fee);
        }

        token.safeTransfer(msg.sender, tokensOut);
        emit Bought(msg.sender, baseIn, tokensOut, fee, priceX18());
    }

    function sell(uint256 tokensIn, uint256 minBaseOut) external nonReentrant returns (uint256 baseOut) {
        if (graduated) revert AlreadyGraduated();
        if (tokensIn == 0) revert ZeroAmount();

        uint256 fee;
        (baseOut, fee) = quoteSell(tokensIn);
        if (baseOut == 0) revert ZeroAmount();
        if (baseOut < minBaseOut) revert SlippageExceeded(baseOut, minBaseOut);

        token.safeTransferFrom(msg.sender, address(this), tokensIn);

        tokenReserve += tokensIn;
        baseReserve -= (baseOut + fee);

        if (fee > 0) {
            base.forceApprove(address(fees), fee);
            fees.deposit(fee);
        }

        base.safeTransfer(msg.sender, baseOut);
        emit Sold(msg.sender, tokensIn, baseOut, fee, priceX18());
    }

    /**
     * @notice Lock the curve once the target is met and release reserves.
     * @dev Permissionless: the condition is objective, and requiring an owner
     *      to call it would let them stall a launch that has already qualified.
     */
    function graduate() external nonReentrant {
        if (graduated) revert AlreadyGraduated();
        if (graduationTarget == 0 || baseReserve < graduationTarget) revert NotReady();

        graduated = true;
        uint256 releasedBase = baseReserve;
        uint256 remainingTokens = tokenReserve;
        baseReserve = 0;
        tokenReserve = 0;

        if (releasedBase > 0) base.safeTransfer(graduationRecipient, releasedBase);
        if (remainingTokens > 0) token.safeTransfer(graduationRecipient, remainingTokens);

        emit Graduated(releasedBase, remainingTokens);
    }

    /// @notice Progress toward graduation, in basis points.
    function graduationProgressBps() external view returns (uint256) {
        if (graduationTarget == 0) return 0;
        if (baseReserve >= graduationTarget) return BPS;
        return (baseReserve * BPS) / graduationTarget;
    }
}
