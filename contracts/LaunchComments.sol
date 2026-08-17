// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title LaunchComments
 * @notice Discussion attached to a raise, stored on chain.
 *
 * The app is a static frontend with no backend, so a conventional comment
 * service would mean standing up a server and a database that every client has
 * to trust. Keeping threads on chain means authorship is signed rather than
 * asserted, nothing can be edited after the fact, and any client can read the
 * same history without asking a server for permission.
 *
 * The tradeoff is honest: posting costs gas, so this suits a low volume of
 * substantive comments rather than chat.
 */
contract LaunchComments {
    struct Comment {
        address author;
        uint64 postedAt;
        bool hidden;
        string body;
    }

    uint256 public constant MAX_BODY_LENGTH = 1000;

    /// @notice Threads keyed by the raise's sale contract.
    mapping(address => Comment[]) private _threads;

    /// @notice Comment counts per author, for lightweight reputation reads.
    mapping(address => uint256) public postCount;

    event Posted(address indexed subject, uint256 indexed index, address indexed author);
    event Hidden(address indexed subject, uint256 indexed index);

    error EmptyBody();
    error BodyTooLong();
    error OutOfRange();
    error NotAuthor();
    error AlreadyHidden();

    /// @param subject The sale contract the comment is attached to.
    function post(address subject, string calldata body) external returns (uint256 index) {
        uint256 len = bytes(body).length;
        if (len == 0) revert EmptyBody();
        if (len > MAX_BODY_LENGTH) revert BodyTooLong();

        index = _threads[subject].length;
        _threads[subject].push(
            Comment({
                author: msg.sender,
                postedAt: uint64(block.timestamp),
                hidden: false,
                body: body
            })
        );
        postCount[msg.sender] += 1;

        emit Posted(subject, index, msg.sender);
    }

    /**
     * @notice Withdraw your own comment.
     * @dev The entry is flagged rather than deleted. Removing it would shift
     *      every later index, breaking any link or reply that referenced one,
     *      and the original text remains in chain history regardless -- so
     *      pretending otherwise would be dishonest.
     */
    function hide(address subject, uint256 index) external {
        Comment[] storage thread = _threads[subject];
        if (index >= thread.length) revert OutOfRange();

        Comment storage c = thread[index];
        if (c.author != msg.sender) revert NotAuthor();
        if (c.hidden) revert AlreadyHidden();

        c.hidden = true;
        c.body = "";
        emit Hidden(subject, index);
    }

    function count(address subject) external view returns (uint256) {
        return _threads[subject].length;
    }

    /// @notice Newest-first page of a thread.
    function page(address subject, uint256 offset, uint256 limit)
        external
        view
        returns (Comment[] memory items, uint256 total)
    {
        Comment[] storage thread = _threads[subject];
        total = thread.length;
        if (offset >= total) return (new Comment[](0), total);

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;
        items = new Comment[](size);
        for (uint256 i = 0; i < size; i++) {
            items[i] = thread[total - 1 - offset - i];
        }
    }

    function at(address subject, uint256 index) external view returns (Comment memory) {
        if (index >= _threads[subject].length) revert OutOfRange();
        return _threads[subject][index];
    }
}
