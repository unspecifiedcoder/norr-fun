// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./LiquidityPair.sol";

/**
 * @title PairFactory
 * @notice Creates and indexes one pool per token pair.
 *
 * Pairs are keyed on the sorted token addresses, so (A,B) and (B,A) resolve to
 * the same pool. Without that, two pools could exist for one pair and split
 * liquidity between them, leaving both worse priced than one would be.
 */
contract PairFactory {
    mapping(address => mapping(address => address)) private _pairs;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair);

    error PairExists();
    error IdenticalTokens();
    error ZeroAddress();

    function _sort(address a, address b) private pure returns (address, address) {
        return a < b ? (a, b) : (b, a);
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        if (tokenA == tokenB) revert IdenticalTokens();

        (address t0, address t1) = _sort(tokenA, tokenB);
        if (_pairs[t0][t1] != address(0)) revert PairExists();

        pair = address(new LiquidityPair(t0, t1));
        _pairs[t0][t1] = pair;
        allPairs.push(pair);

        emit PairCreated(t0, t1, pair);
    }

    function getPair(address tokenA, address tokenB) public view returns (address) {
        (address t0, address t1) = _sort(tokenA, tokenB);
        return _pairs[t0][t1];
    }

    /// @notice Existing pool for the pair, or a newly created one.
    function ensurePair(address tokenA, address tokenB) external returns (address pair) {
        pair = getPair(tokenA, tokenB);
        if (pair != address(0)) return pair;

        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        if (tokenA == tokenB) revert IdenticalTokens();

        (address t0, address t1) = _sort(tokenA, tokenB);
        pair = address(new LiquidityPair(t0, t1));
        _pairs[t0][t1] = pair;
        allPairs.push(pair);

        emit PairCreated(t0, t1, pair);
    }

    function pairCount() external view returns (uint256) {
        return allPairs.length;
    }
}
