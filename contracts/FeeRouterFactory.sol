// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FeeRouter} from "./FeeRouter.sol";

/**
 * @title FeeRouterFactory
 * @notice Canonical deployer for `FeeRouter`, so a router's provenance is a
 *         fact on chain rather than something a caller asserts.
 *
 * `LaunchRegistry` enforces a board's minimum revenue share by reading `bpsOf`
 * and `locked` off a router address the registering creator hands it. Any
 * contract can answer those two calls with whatever it likes, so reading them
 * off an unattested address proves nothing: a creator could satisfy any board's
 * terms with a ten-line stub that reports a locked 100% share for the board
 * owner and routes not a single token. Enforcement that reads from an address
 * the adversary chose is not enforcement.
 *
 * Routers minted here are genuine `FeeRouter` bytecode, deployed by this
 * contract, in this transaction. `isRouter` is therefore a claim about
 * provenance that a stub cannot forge, which is what makes the registry's
 * `bpsOf`/`locked` reads meaningful.
 *
 * The factory is deliberately unowned and permissionless: it mints no
 * privilege, holds no funds, and gates nothing. Anyone may deploy a router
 * through it, exactly as anyone may deploy one directly today -- the only thing
 * it adds is an attestation of what the resulting bytecode is.
 */
contract FeeRouterFactory {
    /// @notice True for every router this factory deployed. Never cleared.
    mapping(address => bool) public isRouter;

    address[] private _routers;

    event RouterDeployed(address indexed router, address indexed owner, address indexed asset);

    /**
     * @notice Deploy a `FeeRouter` and attest it.
     * @param asset  Asset the router will distribute.
     * @param owner  Router owner, who may `setSplits` until `lock()`.
     * @param splits Initial split table; must total exactly 10_000 bps.
     * @return router The freshly deployed, attested router.
     */
    function deploy(address asset, address owner, FeeRouter.Split[] memory splits)
        external
        returns (FeeRouter router)
    {
        router = new FeeRouter(asset, owner, splits);

        isRouter[address(router)] = true;
        _routers.push(address(router));

        emit RouterDeployed(address(router), owner, asset);
    }

    /// @notice Number of routers deployed through this factory.
    function routerCount() external view returns (uint256) {
        return _routers.length;
    }

    /// @notice Router deployed at index `i`, newest last.
    function routerAt(uint256 i) external view returns (address) {
        return _routers[i];
    }
}
