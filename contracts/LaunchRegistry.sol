// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./BoardRegistry.sol";
import "./FeeRouter.sol";

/**
 * @title LaunchRegistry
 * @notice On-chain index of norr.fun launches, so the app can discover them.
 *
 * Without this, the frontend can only show launches whose addresses were baked
 * into a build artifact at deploy time — anything created from the UI would be
 * invisible. Registering makes a launch discoverable to every client at once,
 * with no server and no indexer.
 *
 * The registry is permissionless and deliberately unopinionated: it records who
 * registered what, and never asserts that a launch is safe or endorsed. Clients
 * are expected to read the referenced contracts directly for live state; the
 * strings here are presentation metadata only.
 */
contract LaunchRegistry {
    struct Launch {
        address projectToken;
        address ido;
        address feeRouter;
        address contributionAsset;
        address creator;
        uint64 createdAt;
        /// @notice Publisher environment this raise is published under; 0 for none.
        uint256 boardId;
        string name;
        string symbol;
        string description;
        /// @notice Image for the launch. A URL or data URI supplied by the
        ///         creator -- the protocol pins nothing and hosts nothing.
        string logoURI;
    }

    /// @notice Presentation fields, grouped so `register` stays within the
    ///         EVM's stack limits and gains a self-describing call site.
    struct Metadata {
        string name;
        string symbol;
        string description;
        string logoURI;
    }

    BoardRegistry public immutable boards;

    Launch[] private _launches;

    /// @notice Ids of launches published under each board.
    mapping(uint256 => uint256[]) private _byBoard;

    /// @notice Indices into `_launches`, per creator.
    mapping(address => uint256[]) private _byCreator;

    /// @notice Guards against the same IDO being indexed twice.
    mapping(address => bool) public isRegistered;

    event LaunchRegistered(
        uint256 indexed id,
        address indexed creator,
        address indexed ido,
        address projectToken,
        address feeRouter
    );

    error AlreadyRegistered();
    error ZeroAddress();
    error EmptyField();
    error OutOfRange();
    error UnknownBoard();
    error NotAllowedOnBoard();
    error BoardShareTooLow(uint256 required, uint256 provided);

    constructor(BoardRegistry boardRegistry) {
        if (address(boardRegistry) == address(0)) revert ZeroAddress();
        boards = boardRegistry;
    }

    /**
     * @notice Index a deployed launch.
     * @dev Callable by anyone. The caller is recorded as `creator` rather than
     *      trusting a supplied address, so attribution cannot be forged.
     */
    function register(
        address projectToken,
        address ido,
        address feeRouter,
        address contributionAsset,
        uint256 boardId,
        Metadata calldata meta
    ) external returns (uint256 id) {
        if (
            projectToken == address(0) ||
            ido == address(0) ||
            feeRouter == address(0) ||
            contributionAsset == address(0)
        ) revert ZeroAddress();
        if (bytes(meta.name).length == 0 || bytes(meta.symbol).length == 0) revert EmptyField();
        if (isRegistered[ido]) revert AlreadyRegistered();

        // Board terms are enforced here rather than in the client, so a raise
        // cannot be published under someone's board on terms they never set.
        if (boardId != 0) {
            if (!boards.exists(boardId)) revert UnknownBoard();
            if (!boards.canPublish(boardId, msg.sender)) revert NotAllowedOnBoard();

            (address boardOwner, uint16 minBps) = boards.terms(boardId);
            if (minBps > 0) {
                uint256 routed = FeeRouter(feeRouter).bpsOf(boardOwner);
                if (routed < minBps) revert BoardShareTooLow(minBps, routed);
            }
        }

        isRegistered[ido] = true;
        id = _launches.length;

        _launches.push(
            Launch({
                projectToken: projectToken,
                ido: ido,
                feeRouter: feeRouter,
                contributionAsset: contributionAsset,
                creator: msg.sender,
                createdAt: uint64(block.timestamp),
                boardId: boardId,
                name: meta.name,
                symbol: meta.symbol,
                description: meta.description,
                logoURI: meta.logoURI
            })
        );
        _byCreator[msg.sender].push(id);
        if (boardId != 0) _byBoard[boardId].push(id);

        emit LaunchRegistered(id, msg.sender, ido, projectToken, feeRouter);
    }

    function count() external view returns (uint256) {
        return _launches.length;
    }

    function at(uint256 id) external view returns (Launch memory) {
        if (id >= _launches.length) revert OutOfRange();
        return _launches[id];
    }

    /// @notice Newest-first page. Feeds render most-recent first, and reversing
    ///         an unbounded array client-side would mean fetching all of it.
    function page(uint256 offset, uint256 limit)
        external
        view
        returns (Launch[] memory items, uint256 total)
    {
        total = _launches.length;
        if (offset >= total) return (new Launch[](0), total);

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;
        items = new Launch[](size);
        for (uint256 i = 0; i < size; i++) {
            items[i] = _launches[total - 1 - offset - i];
        }
    }

    function idsByCreator(address creator) external view returns (uint256[] memory) {
        return _byCreator[creator];
    }

    function idsByBoard(uint256 boardId) external view returns (uint256[] memory) {
        return _byBoard[boardId];
    }

    /// @notice Newest-first launches published under one board.
    function pageByBoard(uint256 boardId, uint256 offset, uint256 limit)
        external
        view
        returns (Launch[] memory items, uint256 total)
    {
        uint256[] storage ids = _byBoard[boardId];
        total = ids.length;
        if (offset >= total) return (new Launch[](0), total);

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;
        items = new Launch[](size);
        for (uint256 i = 0; i < size; i++) {
            items[i] = _launches[ids[total - 1 - offset - i]];
        }
    }
}
