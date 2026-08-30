// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LiquidityPair
 * @notice Minimal constant-product pool for one token pair.
 *
 * A graduated launch needs somewhere for its released reserves to live, and
 * calling an external venue's factory would bind this protocol to that venue's
 * interface and deployment. Owning a small pair keeps graduation self-contained
 * and verifiable end to end; a launch that would rather graduate elsewhere can
 * still point its recipient at an external router.
 *
 * Deliberately minimal: add liquidity, swap, remove liquidity. No oracle, no
 * flash swaps, no protocol cut — the launch's own FeeRouter already handles
 * revenue, and a second fee layer here would double-charge.
 */
contract LiquidityPair is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Locked forever on the first mint so total supply can never return
    ///      to zero, which would let someone re-seed the pool at any price.
    uint256 public constant MINIMUM_LIQUIDITY = 1_000;
    uint256 public constant FEE_BPS = 30; // 0.3% to liquidity providers
    uint256 private constant BPS = 10_000;

    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Minted(address indexed to, uint256 amount0, uint256 amount1, uint256 shares);
    event Burned(address indexed to, uint256 amount0, uint256 amount1, uint256 shares);
    event Swapped(address indexed to, uint256 amountIn, uint256 amountOut, bool zeroForOne);

    error ZeroAddress();
    error IdenticalTokens();
    error InsufficientLiquidity();
    error InsufficientInput();
    error InsufficientOutput();
    error SlippageExceeded(uint256 got, uint256 wanted);
    /// @dev A token delivered fewer units than were requested -- see `_pullExact`.
    error UnsupportedToken();

    constructor(address _token0, address _token1) {
        if (_token0 == address(0) || _token1 == address(0)) revert ZeroAddress();
        if (_token0 == _token1) revert IdenticalTokens();
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @notice Deposit both sides and receive LP shares.
     * @dev The first deposit sets the price; later ones are credited on the
     *      scarcer side, so depositing off-ratio donates the excess rather
     *      than moving the price.
     */
    /**
     * @dev Pull exactly `amount` of `asset` from `from`, or revert.
     *
     * Reserves are tracked in storage rather than read from balances, so a token
     * that delivers less than it was asked for -- fee-on-transfer, or a rebase --
     * would have the shortfall credited to reserves anyway. The pool would then
     * quote and pay out against liquidity it does not hold, and the last LP to
     * withdraw absorbs the whole accumulated gap.
     *
     * Failing here states the constraint plainly: pairs assume standard ERC20
     * behaviour on both sides.
     */
    function _pullExact(IERC20 asset, address from, uint256 amount) private {
        uint256 balanceBefore = asset.balanceOf(address(this));
        asset.safeTransferFrom(from, address(this), amount);
        if (asset.balanceOf(address(this)) - balanceBefore != amount) revert UnsupportedToken();
    }

    function addLiquidity(uint256 amount0, uint256 amount1, address to)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount0 == 0 || amount1 == 0) revert InsufficientInput();

        _pullExact(token0, msg.sender, amount0);
        _pullExact(token1, msg.sender, amount1);

        if (totalSupply == 0) {
            shares = _sqrt(amount0 * amount1);
            if (shares <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            shares -= MINIMUM_LIQUIDITY;
            totalSupply += MINIMUM_LIQUIDITY; // burned: no holder, never redeemable
        } else {
            shares = _min(
                (amount0 * totalSupply) / reserve0,
                (amount1 * totalSupply) / reserve1
            );
        }
        if (shares == 0) revert InsufficientLiquidity();

        totalSupply += shares;
        balanceOf[to] += shares;
        reserve0 += amount0;
        reserve1 += amount1;

        emit Minted(to, amount0, amount1, shares);
    }

    function removeLiquidity(uint256 shares, address to)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        if (to == address(0)) revert ZeroAddress();
        if (shares == 0 || balanceOf[msg.sender] < shares) revert InsufficientLiquidity();

        amount0 = (shares * reserve0) / totalSupply;
        amount1 = (shares * reserve1) / totalSupply;
        if (amount0 == 0 || amount1 == 0) revert InsufficientOutput();

        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;
        reserve0 -= amount0;
        reserve1 -= amount1;

        token0.safeTransfer(to, amount0);
        token1.safeTransfer(to, amount1);

        emit Burned(to, amount0, amount1, shares);
    }

    /// @notice Output for `amountIn`, fee already deducted.
    function quote(uint256 amountIn, bool zeroForOne) public view returns (uint256) {
        if (amountIn == 0 || reserve0 == 0 || reserve1 == 0) return 0;
        (uint256 rIn, uint256 rOut) = zeroForOne ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 netIn = (amountIn * (BPS - FEE_BPS)) / BPS;
        return (netIn * rOut) / (rIn + netIn);
    }

    function swap(uint256 amountIn, uint256 minOut, bool zeroForOne, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert InsufficientInput();

        amountOut = quote(amountIn, zeroForOne);
        if (amountOut == 0) revert InsufficientOutput();
        if (amountOut < minOut) revert SlippageExceeded(amountOut, minOut);

        if (zeroForOne) {
            _pullExact(token0, msg.sender, amountIn);
            reserve0 += amountIn;
            reserve1 -= amountOut;
            token1.safeTransfer(to, amountOut);
        } else {
            _pullExact(token1, msg.sender, amountIn);
            reserve1 += amountIn;
            reserve0 -= amountOut;
            token0.safeTransfer(to, amountOut);
        }

        emit Swapped(to, amountIn, amountOut, zeroForOne);
    }

    /// @notice Marginal price of token0 in token1, scaled by 1e18.
    function priceX18() external view returns (uint256) {
        if (reserve0 == 0) return 0;
        return (reserve1 * 1e18) / reserve0;
    }
}
