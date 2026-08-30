import { expect } from "chai";
import { ethers } from "hardhat";
import type { LaunchRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("LaunchRegistry", () => {
  let registry: LaunchRegistry;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

  const entry = (n: number) => [
    addr(n * 4 + 1), // projectToken
    addr(n * 4 + 2), // ido
    addr(n * 4 + 3), // feeRouter
    addr(n * 4 + 4), // contributionAsset
    0, // boardId -- no publisher environment
    { name: `Launch ${n}`, symbol: `L${n}`, description: `description ${n}`, logoURI: "" },
  ] as const;

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    const boards = await (await ethers.getContractFactory("BoardRegistry")).deploy();
    const routerFactory = await (await ethers.getContractFactory("FeeRouterFactory")).deploy();
    registry = await (
      await ethers.getContractFactory("LaunchRegistry")
    ).deploy(await boards.getAddress(), await routerFactory.getAddress());
  });

  it("indexes a launch and attributes it to the caller", async () => {
    await registry.connect(alice).register(...entry(1));

    expect(await registry.count()).to.equal(1n);
    const stored = await registry.at(0);
    expect(stored.creator).to.equal(alice.address);
    expect(stored.name).to.equal("Launch 1");
    expect(stored.symbol).to.equal("L1");
    expect(stored.ido).to.equal(ethers.getAddress(addr(6)));
    expect(stored.boardId).to.equal(0n);
    expect(stored.createdAt).to.be.greaterThan(0n);
  });

  it("attributes to the caller, not a supplied address", async () => {
    // Bob registers a launch whose addresses are otherwise unrelated to him.
    await registry.connect(bob).register(...entry(2));
    expect((await registry.at(0)).creator).to.equal(bob.address);
  });

  it("refuses to index the same IDO twice", async () => {
    await registry.connect(alice).register(...entry(1));
    await expect(
      registry.connect(bob).register(...entry(1)),
    ).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
  });

  it("rejects zero addresses and empty identity fields", async () => {
    const base = entry(1);

    await expect(
      registry.register(ethers.ZeroAddress, base[1], base[2], base[3], base[4], base[5]),
    ).to.be.revertedWithCustomError(registry, "ZeroAddress");

    await expect(
      registry.register(base[0], base[1], base[2], base[3], base[4], { ...base[5], name: "" }),
    ).to.be.revertedWithCustomError(registry, "EmptyField");

    await expect(
      registry.register(base[0], base[1], base[2], base[3], base[4], { ...base[5], symbol: "" }),
    ).to.be.revertedWithCustomError(registry, "EmptyField");
  });

  it("pages newest-first", async () => {
    for (let i = 1; i <= 5; i++) await registry.register(...entry(i));

    const [firstPage, total] = await registry.page(0, 2);
    expect(total).to.equal(5n);
    expect(firstPage.map((l) => l.name)).to.deep.equal(["Launch 5", "Launch 4"]);

    const [secondPage] = await registry.page(2, 2);
    expect(secondPage.map((l) => l.name)).to.deep.equal(["Launch 3", "Launch 2"]);

    // Trailing partial page returns only what remains.
    const [lastPage] = await registry.page(4, 2);
    expect(lastPage.map((l) => l.name)).to.deep.equal(["Launch 1"]);
  });

  it("returns an empty page past the end rather than reverting", async () => {
    await registry.register(...entry(1));
    const [items, total] = await registry.page(10, 5);
    expect(items.length).to.equal(0);
    expect(total).to.equal(1n);
  });

  it("tracks ids per creator", async () => {
    await registry.connect(alice).register(...entry(1));
    await registry.connect(bob).register(...entry(2));
    await registry.connect(alice).register(...entry(3));

    expect(await registry.idsByCreator(alice.address)).to.deep.equal([0n, 2n]);
    expect(await registry.idsByCreator(bob.address)).to.deep.equal([1n]);
  });

  it("reverts reading past the end", async () => {
    await expect(registry.at(0)).to.be.revertedWithCustomError(registry, "OutOfRange");
  });

  /**
   * Regression for a High finding: registering under a board used to accept
   * any FeeRouter that happened to satisfy the board's minimum share at the
   * moment of the register() call, even if that FeeRouter's split could still
   * be rewritten afterwards. A launch creator could pass the board's check and
   * then immediately strip the board owner's share, since nothing tied the
   * check to the split actually being frozen.
   */
  describe("desk-terms enforcement against a live FeeRouter", () => {
    it("refuses to register under a board if the FeeRouter split is not locked", async () => {
      const boards = await (await ethers.getContractFactory("BoardRegistry")).deploy();
      const routerFactory = await (await ethers.getContractFactory("FeeRouterFactory")).deploy();
      const reg = await (
        await ethers.getContractFactory("LaunchRegistry")
      ).deploy(await boards.getAddress(), await routerFactory.getAddress());

      const boardOwner = bob;
      await boards.connect(boardOwner).create("board", "Board", "desc", 500, true); // 5% min
      const boardId = 1n;

      const asset = await (
        await ethers.getContractFactory("SimpleERC20")
      ).deploy("Base", "BASE", 18);
      const routerArgs = [
        await asset.getAddress(),
        alice.address, // alice (the launch creator) owns the FeeRouter
        [
          { recipient: boardOwner.address, bps: 500n, category: 0n, label: "board" },
          { recipient: alice.address, bps: 9_500n, category: 0n, label: "creator" },
        ],
      ] as const;
      const feesAddr = await routerFactory
        .getFunction("deploy")
        .staticCall(...routerArgs);
      await routerFactory.getFunction("deploy")(...routerArgs);
      const fees = await ethers.getContractAt("FeeRouter", feesAddr);

      const base = entry(1);
      const args = [
        base[0],
        base[1],
        await fees.getAddress(),
        await asset.getAddress(),
        boardId,
        base[5],
      ] as const;

      // FeeRouter is not locked yet -- satisfies minBps today, but nothing
      // stops the creator from rewriting it after this call.
      await expect(reg.connect(alice).register(...args)).to.be.revertedWithCustomError(
        reg,
        "FeeRouterNotLocked",
      );

      // Once locked, the same registration succeeds...
      await fees.connect(alice).lock();
      await reg.connect(alice).register(...args);
      expect(await reg.count()).to.equal(1n);

      // ...and the split can no longer be rewritten out from under the board,
      // because FeeRouter.setSplits() itself reverts once locked.
      await expect(
        fees
          .connect(alice)
          .setSplits([{ recipient: alice.address, bps: 10_000n, category: 0n, label: "solo" }]),
      ).to.be.revertedWithCustomError(fees, "AlreadyLocked");
    });

    /**
     * Regression for a High finding: the checks above read `locked()` and
     * `bpsOf()` off an address the *creator* supplies -- the very party the
     * board's terms constrain. A counterfeit router answering both calls
     * generously satisfied any board's terms while routing nothing, so freezing
     * the split only ever froze a number the attacker chose. Registration now
     * requires the canonical factory's provenance attestation before it will
     * read anything off a router.
     */
    it("refuses a counterfeit FeeRouter that only claims to pay the board", async () => {
      const boards = await (await ethers.getContractFactory("BoardRegistry")).deploy();
      const routerFactory = await (await ethers.getContractFactory("FeeRouterFactory")).deploy();
      const reg = await (
        await ethers.getContractFactory("LaunchRegistry")
      ).deploy(await boards.getAddress(), await routerFactory.getAddress());

      const boardOwner = bob;
      await boards.connect(boardOwner).create("board", "Board", "desc", 500, true); // 5% min
      const boardId = 1n;

      const asset = await (
        await ethers.getContractFactory("SimpleERC20")
      ).deploy("Base", "BASE", 18);

      // Ten lines of attacker bytecode: permanently locked, pays everyone 100%,
      // holds nothing, routes nothing.
      const spoof = await (await ethers.getContractFactory("SpoofedFeeRouter")).deploy();
      expect(await spoof.locked()).to.equal(true);
      expect(await spoof.bpsOf(boardOwner.address)).to.equal(10_000n);

      const base = entry(1);
      const args = [
        base[0],
        base[1],
        await spoof.getAddress(),
        await asset.getAddress(),
        boardId,
        base[5],
      ] as const;

      // It satisfies every check the registry used to make, and is still refused.
      await expect(reg.connect(alice).register(...args)).to.be.revertedWithCustomError(
        reg,
        "FeeRouterNotCanonical",
      );
      expect(await reg.count()).to.equal(0n);

      // A genuine, factory-minted router with the same terms is accepted.
      const routerArgs = [
        await asset.getAddress(),
        alice.address,
        [
          { recipient: boardOwner.address, bps: 500n, category: 0n, label: "board" },
          { recipient: alice.address, bps: 9_500n, category: 0n, label: "creator" },
        ],
      ] as const;
      const realAddr = await routerFactory.getFunction("deploy").staticCall(...routerArgs);
      await routerFactory.getFunction("deploy")(...routerArgs);
      const real = await ethers.getContractAt("FeeRouter", realAddr);
      await real.connect(alice).lock();

      await reg
        .connect(alice)
        .register(base[0], base[1], realAddr, await asset.getAddress(), boardId, base[5]);
      expect(await reg.count()).to.equal(1n);
    });
  });
});
