// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title SpoofedFeeRouter
 * @notice An attacker's counterfeit `FeeRouter`, kept in-tree so the defence
 *         against it stays honest.
 *
 * This is not a mock standing in for a real dependency -- it is the adversary,
 * written out. It answers `locked()` and `bpsOf()` exactly as a fully-committed,
 * maximally-generous router would, while holding nothing, routing nothing, and
 * implementing none of the rest of `FeeRouter`. It cost its author ten lines.
 *
 * `LaunchRegistry` used to read a board's revenue share straight off whatever
 * address a creator handed it, which made this contract sufficient to satisfy
 * any board's terms while paying its owner precisely zero. The registry now
 * requires the canonical `FeeRouterFactory`'s provenance attestation before it
 * will believe a word a router says about itself, which is what this contract
 * exists to demonstrate it cannot obtain.
 */
contract SpoofedFeeRouter {
    /// @notice Always claims to be permanently frozen.
    bool public constant locked = true;

    /// @notice Claims the entire fee take routes to whoever is asking.
    function bpsOf(address) external pure returns (uint256) {
        return 10_000;
    }
}
