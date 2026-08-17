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
    registry = await (
      await ethers.getContractFactory("LaunchRegistry")
    ).deploy(await boards.getAddress());
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
});
