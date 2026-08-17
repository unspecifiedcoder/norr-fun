// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title SocialGraph
 * @notice Follows between accounts, and a per-account watchlist of raises.
 *
 * Both live on chain rather than in browser storage so they travel with the
 * wallet: the same follows and saved raises appear on any device, and follower
 * counts are verifiable rather than asserted by a server.
 *
 * Counts are stored alongside the sets. Deriving them by iterating would grow
 * unbounded with the graph, and a follower count is read on nearly every
 * profile render.
 */
contract SocialGraph {
    // --- follows ---

    mapping(address => mapping(address => bool)) public follows;
    mapping(address => uint256) public followerCount;
    mapping(address => uint256) public followingCount;

    // --- watchlist ---

    /// @notice Saved raises, keyed by follower then sale contract.
    mapping(address => mapping(address => bool)) public saved;
    mapping(address => uint256) public savedCount;
    /// @notice How many accounts have saved a given raise.
    mapping(address => uint256) public saveCount;

    event Followed(address indexed follower, address indexed target);
    event Unfollowed(address indexed follower, address indexed target);
    event Saved(address indexed account, address indexed subject);
    event Unsaved(address indexed account, address indexed subject);

    error CannotFollowSelf();
    error ZeroAddress();
    error AlreadyFollowing();
    error NotFollowing();
    error AlreadySaved();
    error NotSaved();

    function follow(address target) external {
        if (target == address(0)) revert ZeroAddress();
        if (target == msg.sender) revert CannotFollowSelf();
        if (follows[msg.sender][target]) revert AlreadyFollowing();

        follows[msg.sender][target] = true;
        followerCount[target] += 1;
        followingCount[msg.sender] += 1;
        emit Followed(msg.sender, target);
    }

    function unfollow(address target) external {
        if (!follows[msg.sender][target]) revert NotFollowing();

        follows[msg.sender][target] = false;
        followerCount[target] -= 1;
        followingCount[msg.sender] -= 1;
        emit Unfollowed(msg.sender, target);
    }

    function save(address subject) external {
        if (subject == address(0)) revert ZeroAddress();
        if (saved[msg.sender][subject]) revert AlreadySaved();

        saved[msg.sender][subject] = true;
        savedCount[msg.sender] += 1;
        saveCount[subject] += 1;
        emit Saved(msg.sender, subject);
    }

    function unsave(address subject) external {
        if (!saved[msg.sender][subject]) revert NotSaved();

        saved[msg.sender][subject] = false;
        savedCount[msg.sender] -= 1;
        saveCount[subject] -= 1;
        emit Unsaved(msg.sender, subject);
    }

    /// @notice Batch read, so a feed can render save state in one call.
    function savedMany(address account, address[] calldata subjects)
        external
        view
        returns (bool[] memory flags)
    {
        flags = new bool[](subjects.length);
        for (uint256 i = 0; i < subjects.length; i++) {
            flags[i] = saved[account][subjects[i]];
        }
    }

    function followsMany(address follower, address[] calldata targets)
        external
        view
        returns (bool[] memory flags)
    {
        flags = new bool[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            flags[i] = follows[follower][targets[i]];
        }
    }
}
