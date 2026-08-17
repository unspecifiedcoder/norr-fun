// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title BoardRegistry
 * @notice Publisher environments: a named surface someone runs, that raises can
 *         be published under, and that earns a share of what they raise.
 *
 * A board turns distribution into infrastructure. Instead of promoting a raise
 * for a one-off payment, the operator runs a board, sets its terms once, and
 * earns from every raise published through it.
 *
 * Two things are enforced here rather than left to the client:
 *  - who may publish under a board (open to all, or owner-only), and
 *  - the minimum share of a raise that must route to the board operator.
 * `LaunchRegistry` consults both at registration time, so a client cannot
 * publish under someone's board on terms they never agreed to.
 */
contract BoardRegistry {
    struct Board {
        address owner;
        string slug;
        string name;
        string description;
        /// @notice Minimum basis points a raise must route to `owner`.
        uint16 minPartnerBps;
        /// @notice When false, only `owner` may publish under this board.
        bool open;
        uint64 createdAt;
    }

    /// @notice Boards by id. Id 0 is never used, so 0 can mean "no board".
    Board[] private _boards;

    /// @notice slug (lowercased by convention) -> board id + 1, so 0 reads as absent.
    mapping(string => uint256) private _idBySlug;

    mapping(address => uint256[]) private _byOwner;

    event BoardCreated(uint256 indexed id, address indexed owner, string slug);
    event BoardUpdated(uint256 indexed id);
    event BoardTransferred(uint256 indexed id, address indexed from, address indexed to);

    error SlugTaken();
    error EmptyField();
    error SlugTooLong();
    error ShareTooHigh();
    error NotBoardOwner();
    error UnknownBoard();
    error ZeroAddress();

    /// @dev A board taking everything would leave nothing for the project itself.
    uint16 public constant MAX_PARTNER_BPS = 5_000;
    uint256 public constant MAX_SLUG_LENGTH = 32;

    constructor() {
        // Burn index 0 so a zero id is unambiguously "no board".
        _boards.push(
            Board({
                owner: address(0),
                slug: "",
                name: "",
                description: "",
                minPartnerBps: 0,
                open: true,
                createdAt: 0
            })
        );
    }

    function create(
        string calldata slug,
        string calldata name,
        string calldata description,
        uint16 minPartnerBps,
        bool open
    ) external returns (uint256 id) {
        if (bytes(slug).length == 0 || bytes(name).length == 0) revert EmptyField();
        if (bytes(slug).length > MAX_SLUG_LENGTH) revert SlugTooLong();
        if (minPartnerBps > MAX_PARTNER_BPS) revert ShareTooHigh();
        if (_idBySlug[slug] != 0) revert SlugTaken();

        id = _boards.length;
        _boards.push(
            Board({
                owner: msg.sender,
                slug: slug,
                name: name,
                description: description,
                minPartnerBps: minPartnerBps,
                open: open,
                createdAt: uint64(block.timestamp)
            })
        );
        _idBySlug[slug] = id;
        _byOwner[msg.sender].push(id);

        emit BoardCreated(id, msg.sender, slug);
    }

    /**
     * @notice Update a board's terms.
     * @dev The slug is deliberately immutable: it is the board's public
     *      identifier, and letting it move would break every link to it and
     *      free the old name for someone else to take.
     */
    function update(
        uint256 id,
        string calldata name,
        string calldata description,
        uint16 minPartnerBps,
        bool open
    ) external {
        Board storage b = _requireOwned(id);
        if (bytes(name).length == 0) revert EmptyField();
        if (minPartnerBps > MAX_PARTNER_BPS) revert ShareTooHigh();

        b.name = name;
        b.description = description;
        b.minPartnerBps = minPartnerBps;
        b.open = open;
        emit BoardUpdated(id);
    }

    function transferBoard(uint256 id, address to) external {
        if (to == address(0)) revert ZeroAddress();
        Board storage b = _requireOwned(id);
        emit BoardTransferred(id, b.owner, to);
        b.owner = to;
        _byOwner[to].push(id);
    }

    // --- views used by LaunchRegistry ---

    /// @notice Whether `who` may publish under `id`. Board 0 means no board.
    function canPublish(uint256 id, address who) external view returns (bool) {
        if (id == 0) return true;
        if (id >= _boards.length) return false;
        Board storage b = _boards[id];
        return b.open || b.owner == who;
    }

    /// @notice Terms a raise must satisfy to publish under `id`.
    function terms(uint256 id) external view returns (address owner, uint16 minPartnerBps) {
        if (id == 0) return (address(0), 0);
        if (id >= _boards.length) revert UnknownBoard();
        Board storage b = _boards[id];
        return (b.owner, b.minPartnerBps);
    }

    function exists(uint256 id) external view returns (bool) {
        return id != 0 && id < _boards.length;
    }

    // --- reads ---

    function count() external view returns (uint256) {
        // Index 0 is the burned sentinel, not a real board.
        return _boards.length - 1;
    }

    function at(uint256 id) external view returns (Board memory) {
        if (id == 0 || id >= _boards.length) revert UnknownBoard();
        return _boards[id];
    }

    function idBySlug(string calldata slug) external view returns (uint256) {
        return _idBySlug[slug];
    }

    function all() external view returns (Board[] memory items, uint256[] memory ids) {
        uint256 n = _boards.length - 1;
        items = new Board[](n);
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            items[i] = _boards[i + 1];
            ids[i] = i + 1;
        }
    }

    function idsByOwner(address owner) external view returns (uint256[] memory) {
        return _byOwner[owner];
    }

    function _requireOwned(uint256 id) private view returns (Board storage b) {
        if (id == 0 || id >= _boards.length) revert UnknownBoard();
        b = _boards[id];
        if (b.owner != msg.sender) revert NotBoardOwner();
    }
}
