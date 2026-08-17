import { expect } from "chai";
import { ethers } from "hardhat";
import type { BoardRegistry, LaunchComments, LaunchRegistry, ProjectToken } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("BoardRegistry", () => {
  let boards: BoardRegistry;
  let owner: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, outsider] = await ethers.getSigners();
    boards = await (await ethers.getContractFactory("BoardRegistry")).deploy();
  });

  it("creates a board and indexes it by slug", async () => {
    await boards.create("aurora", "Aurora Desk", "Curated raises", 500, true);

    expect(await boards.count()).to.equal(1n);
    const id = await boards.idBySlug("aurora");
    expect(id).to.equal(1n);

    const b = await boards.at(id);
    expect(b.owner).to.equal(owner.address);
    expect(b.name).to.equal("Aurora Desk");
    expect(b.minPartnerBps).to.equal(500n);
    expect(b.open).to.equal(true);
  });

  it("treats id 0 as no board rather than a real one", async () => {
    expect(await boards.count()).to.equal(0n);
    expect(await boards.exists(0)).to.equal(false);
    expect(await boards.canPublish(0, outsider.address)).to.equal(true);
    await expect(boards.at(0)).to.be.revertedWithCustomError(boards, "UnknownBoard");
  });

  it("refuses a duplicate slug", async () => {
    await boards.create("aurora", "Aurora Desk", "", 0, true);
    await expect(
      boards.connect(outsider).create("aurora", "Impostor", "", 0, true),
    ).to.be.revertedWithCustomError(boards, "SlugTaken");
  });

  it("rejects empty fields and an over-large share", async () => {
    await expect(boards.create("", "Name", "", 0, true)).to.be.revertedWithCustomError(
      boards,
      "EmptyField",
    );
    await expect(boards.create("slug", "", "", 0, true)).to.be.revertedWithCustomError(
      boards,
      "EmptyField",
    );
    await expect(
      boards.create("slug", "Name", "", 5001, true),
    ).to.be.revertedWithCustomError(boards, "ShareTooHigh");
  });

  it("gates publishing on a closed board to its owner", async () => {
    await boards.create("closed", "Closed Desk", "", 0, false);
    const id = await boards.idBySlug("closed");

    expect(await boards.canPublish(id, owner.address)).to.equal(true);
    expect(await boards.canPublish(id, outsider.address)).to.equal(false);
  });

  it("only lets the owner change terms", async () => {
    await boards.create("aurora", "Aurora Desk", "", 0, true);
    const id = await boards.idBySlug("aurora");

    await expect(
      boards.connect(outsider).update(id, "Hijacked", "", 0, true),
    ).to.be.revertedWithCustomError(boards, "NotBoardOwner");

    await boards.update(id, "Aurora Desk v2", "Updated", 250, false);
    const b = await boards.at(id);
    expect(b.name).to.equal("Aurora Desk v2");
    expect(b.minPartnerBps).to.equal(250n);
    expect(b.open).to.equal(false);
    // The slug is the public identifier and must survive an update.
    expect(b.slug).to.equal("aurora");
  });

  it("moves ownership", async () => {
    await boards.create("aurora", "Aurora Desk", "", 0, true);
    const id = await boards.idBySlug("aurora");

    await boards.transferBoard(id, outsider.address);
    expect((await boards.at(id)).owner).to.equal(outsider.address);
    await expect(
      boards.update(id, "Nope", "", 0, true),
    ).to.be.revertedWithCustomError(boards, "NotBoardOwner");
  });
});

describe("LaunchRegistry + boards", () => {
  let boards: BoardRegistry;
  let registry: LaunchRegistry;
  let asset: ProjectToken;
  let creator: HardhatEthersSigner;
  let boardOwner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const deployRouter = async (splits: { recipient: string; bps: bigint; label: string }[]) =>
    (await ethers.getContractFactory("FeeRouter")).deploy(
      await asset.getAddress(),
      creator.address,
      splits.map((s) => ({ ...s, category: 0n })),
    );

  beforeEach(async () => {
    [creator, boardOwner, other] = await ethers.getSigners();
    boards = await (await ethers.getContractFactory("BoardRegistry")).deploy();
    registry = await (await ethers.getContractFactory("LaunchRegistry")).deploy(
      await boards.getAddress(),
    );
    asset = await (await ethers.getContractFactory("ProjectToken")).deploy(
      ethers.parseUnits("1000", 18),
    );
  });

  const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

  it("publishes under no board when boardId is 0", async () => {
    const router = await deployRouter([
      { recipient: creator.address, bps: 10_000n, label: "all" },
    ]);
    await registry.register(
      addr(1), addr(2), await router.getAddress(), addr(4), 0,
      "Solo", "SOLO", "",
    );
    expect((await registry.at(0)).boardId).to.equal(0n);
  });

  it("rejects publishing under a board that does not exist", async () => {
    const router = await deployRouter([
      { recipient: creator.address, bps: 10_000n, label: "all" },
    ]);
    await expect(
      registry.register(addr(1), addr(2), await router.getAddress(), addr(4), 99, "X", "X", ""),
    ).to.be.revertedWithCustomError(registry, "UnknownBoard");
  });

  it("blocks a non-owner from publishing under a closed board", async () => {
    await boards.connect(boardOwner).create("closed", "Closed", "", 0, false);
    const id = await boards.idBySlug("closed");
    const router = await deployRouter([
      { recipient: creator.address, bps: 10_000n, label: "all" },
    ]);

    await expect(
      registry.register(addr(1), addr(2), await router.getAddress(), addr(4), id, "X", "X", ""),
    ).to.be.revertedWithCustomError(registry, "NotAllowedOnBoard");
  });

  it("enforces the board's minimum share against the actual fee router", async () => {
    await boards.connect(boardOwner).create("desk", "Desk", "", 1_000, true); // 10%
    const id = await boards.idBySlug("desk");

    // Routes only 5% to the board owner -- below the board's terms.
    const stingy = await deployRouter([
      { recipient: boardOwner.address, bps: 500n, label: "board" },
      { recipient: creator.address, bps: 9_500n, label: "team" },
    ]);
    await expect(
      registry.register(addr(1), addr(2), await stingy.getAddress(), addr(4), id, "X", "X", ""),
    ).to.be.revertedWithCustomError(registry, "BoardShareTooLow");

    // Meeting the terms succeeds, and the raise is indexed under the board.
    const fair = await deployRouter([
      { recipient: boardOwner.address, bps: 1_000n, label: "board" },
      { recipient: creator.address, bps: 9_000n, label: "team" },
    ]);
    await registry.register(
      addr(5), addr(6), await fair.getAddress(), addr(8), id, "Fair", "FAIR", "",
    );

    expect(await registry.idsByBoard(id)).to.deep.equal([0n]);
    const [items, total] = await registry.pageByBoard(id, 0, 10);
    expect(total).to.equal(1n);
    expect(items[0].name).to.equal("Fair");
  });

  it("counts a share split across two entries to the same board owner", async () => {
    await boards.connect(boardOwner).create("desk", "Desk", "", 1_000, true);
    const id = await boards.idBySlug("desk");

    // FeeRouter aggregates duplicate recipients, so 6% + 4% satisfies 10%.
    const split = await deployRouter([
      { recipient: boardOwner.address, bps: 600n, label: "board" },
      { recipient: boardOwner.address, bps: 400n, label: "board bonus" },
      { recipient: other.address, bps: 9_000n, label: "team" },
    ]);
    await registry.register(
      addr(1), addr(2), await split.getAddress(), addr(4), id, "Split", "SPL", "",
    );
    expect((await registry.at(0)).boardId).to.equal(id);
  });
});

describe("LaunchComments", () => {
  let comments: LaunchComments;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  const subject = "0x00000000000000000000000000000000000000AA";

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    comments = await (await ethers.getContractFactory("LaunchComments")).deploy();
  });

  it("records a comment against its signer", async () => {
    await comments.connect(alice).post(subject, "Looks solid.");

    expect(await comments.count(subject)).to.equal(1n);
    const c = await comments.at(subject, 0);
    expect(c.author).to.equal(alice.address);
    expect(c.body).to.equal("Looks solid.");
    expect(c.hidden).to.equal(false);
    expect(await comments.postCount(alice.address)).to.equal(1n);
  });

  it("keeps threads separate per subject", async () => {
    const other = "0x00000000000000000000000000000000000000BB";
    await comments.post(subject, "one");
    await comments.post(other, "two");

    expect(await comments.count(subject)).to.equal(1n);
    expect(await comments.count(other)).to.equal(1n);
    expect((await comments.at(other, 0)).body).to.equal("two");
  });

  it("rejects empty and over-long bodies", async () => {
    await expect(comments.post(subject, "")).to.be.revertedWithCustomError(
      comments,
      "EmptyBody",
    );
    await expect(
      comments.post(subject, "x".repeat(1001)),
    ).to.be.revertedWithCustomError(comments, "BodyTooLong");
  });

  it("pages newest-first", async () => {
    for (const body of ["first", "second", "third"]) await comments.post(subject, body);

    const [items, total] = await comments.page(subject, 0, 2);
    expect(total).to.equal(3n);
    expect(items.map((c) => c.body)).to.deep.equal(["third", "second"]);

    const [rest] = await comments.page(subject, 2, 2);
    expect(rest.map((c) => c.body)).to.deep.equal(["first"]);
  });

  it("lets only the author withdraw, and keeps the index stable", async () => {
    await comments.connect(alice).post(subject, "one");
    await comments.connect(alice).post(subject, "two");

    await expect(
      comments.connect(bob).hide(subject, 0),
    ).to.be.revertedWithCustomError(comments, "NotAuthor");

    await comments.connect(alice).hide(subject, 0);
    const c = await comments.at(subject, 0);
    expect(c.hidden).to.equal(true);
    expect(c.body).to.equal("");
    // Length is unchanged, so later indices still resolve.
    expect(await comments.count(subject)).to.equal(2n);
    expect((await comments.at(subject, 1)).body).to.equal("two");

    await expect(
      comments.connect(alice).hide(subject, 0),
    ).to.be.revertedWithCustomError(comments, "AlreadyHidden");
  });

  it("returns an empty page past the end", async () => {
    const [items, total] = await comments.page(subject, 5, 5);
    expect(items.length).to.equal(0);
    expect(total).to.equal(0n);
  });
});
