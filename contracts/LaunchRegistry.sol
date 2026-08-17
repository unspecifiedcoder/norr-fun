// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

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
        string name;
        string symbol;
        string description;
    }

    Launch[] private _launches;

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
        string calldata name,
        string calldata symbol,
        string calldata description
    ) external returns (uint256 id) {
        if (
            projectToken == address(0) ||
            ido == address(0) ||
            feeRouter == address(0) ||
            contributionAsset == address(0)
        ) revert ZeroAddress();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert EmptyField();
        if (isRegistered[ido]) revert AlreadyRegistered();

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
                name: name,
                symbol: symbol,
                description: description
            })
        );
        _byCreator[msg.sender].push(id);

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
}
