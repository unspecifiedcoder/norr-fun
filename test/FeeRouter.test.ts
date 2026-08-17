import { expect } from "chai";
import { ethers } from "hardhat";
import type { FeeRouter, ProjectToken } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const BPS = 10_000n;

enum Category {
  Creator,
  Partner,
  Rewards,
  Marketing,
  Buyback,
  Liquidity,
  Treasury,
  Custom,
}

describe("FeeRouter", () => {
  let asset: ProjectToken;
  let owner: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let partner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  const SUPPLY = ethers.parseUnits("1000000", 18);

  beforeEach(async () => {
    [owner, creator, partner, treasury, outsider] = await ethers.getSigners();
    asset = await (await ethers.getContractFactory("ProjectToken")).deploy(SUPPLY);
  });

  /** 60 / 25 / 15 across creator / partner / treasury. */
  const defaultSplits = () => [
    { recipient: creator.address, bps: 6000n, category: Category.Creator, label: "creator" },
    { recipient: partner.address, bps: 2500n, category: Category.Partner, label: "kol" },
    { recipient: treasury.address, bps: 1500n, category: Category.Treasury, label: "treasury" },
  ];

  const deployRouter = async (splits = defaultSplits()): Promise<FeeRouter> =>
    (await ethers.getContractFactory("FeeRouter")).deploy(
      await asset.getAddress(),
      owner.address,
      splits,
    );

  const fund = async (router: FeeRouter, amount: bigint) => {
    await asset.approve(await router.getAddress(), amount);
    await router.deposit(amount);
  };

  describe("configuration", () => {
    it("stores the split table and aggregates bps per recipient", async () => {
      const router = await deployRouter();

      expect(await router.splitCount()).to.equal(3n);
      expect(await router.bpsOf(creator.address)).to.equal(6000n);
      expect(await router.bpsOf(partner.address)).to.equal(2500n);
      expect(await router.bpsOf(treasury.address)).to.equal(1500n);
    });

    it("rejects splits that do not total exactly 10000 bps", async () => {
      const under = [
        { recipient: creator.address, bps: 5000n, category: Category.Creator, label: "c" },
      ];
      await expect(deployRouter(under)).to.be.revertedWithCustomError(
        await ethers.getContractFactory("FeeRouter"),
        "BpsMustTotalDenominator",
      );

      const over = [
        { recipient: creator.address, bps: 6000n, category: Category.Creator, label: "c" },
        { recipient: partner.address, bps: 5000n, category: Category.Partner, label: "p" },
      ];
      await expect(deployRouter(over)).to.be.revertedWithCustomError(
        await ethers.getContractFactory("FeeRouter"),
        "BpsMustTotalDenominator",
      );
    });

    it("sums duplicate recipients rather than rejecting them", async () => {
      const router = await deployRouter([
        { recipient: creator.address, bps: 4000n, category: Category.Creator, label: "creator" },
        { recipient: creator.address, bps: 1000n, category: Category.Treasury, label: "treasury" },
        { recipient: partner.address, bps: 5000n, category: Category.Partner, label: "kol" },
      ]);

      expect(await router.bpsOf(creator.address)).to.equal(5000n);
    });

    it("clears prior aggregation when splits are replaced", async () => {
      const router = await deployRouter();

      await router.setSplits([
        { recipient: partner.address, bps: BPS, category: Category.Partner, label: "sole" },
      ]);

      expect(await router.bpsOf(creator.address)).to.equal(0n);
      expect(await router.bpsOf(partner.address)).to.equal(BPS);
      expect(await router.splitCount()).to.equal(1n);
    });

    it("only lets the owner reconfigure", async () => {
      const router = await deployRouter();
      await expect(
        router.connect(outsider).setSplits(defaultSplits()),
      ).to.be.revertedWithCustomError(router, "NotOwner");
    });

    it("makes splits permanently immutable once locked", async () => {
      const router = await deployRouter();
      await router.lock();

      expect(await router.locked()).to.equal(true);
      await expect(router.setSplits(defaultSplits())).to.be.revertedWithCustomError(
        router,
        "AlreadyLocked",
      );
      await expect(router.lock()).to.be.revertedWithCustomError(router, "AlreadyLocked");
    });
  });

  describe("routing", () => {
    it("divides a deposit across recipients by bps", async () => {
      const router = await deployRouter();
      const amount = ethers.parseUnits("1000", 18);
      await fund(router, amount);

      expect(await router.totalReceived()).to.equal(amount);
      expect(await router.releasable(creator.address)).to.equal((amount * 6000n) / BPS);
      expect(await router.releasable(partner.address)).to.equal((amount * 2500n) / BPS);
      expect(await router.releasable(treasury.address)).to.equal((amount * 1500n) / BPS);
    });

    it("actually transfers on release and zeroes the entitlement", async () => {
      const router = await deployRouter();
      const amount = ethers.parseUnits("1000", 18);
      await fund(router, amount);

      const expected = (amount * 6000n) / BPS;
      await expect(router.release(creator.address)).to.changeTokenBalance(
        asset,
        creator,
        expected,
      );

      expect(await router.released(creator.address)).to.equal(expected);
      expect(await router.releasable(creator.address)).to.equal(0n);
      await expect(router.release(creator.address)).to.be.revertedWithCustomError(
        router,
        "NothingToRelease",
      );
    });

    it("credits deposits that arrive after an earlier withdrawal", async () => {
      const router = await deployRouter();
      const first = ethers.parseUnits("1000", 18);
      const second = ethers.parseUnits("500", 18);

      await fund(router, first);
      await router.release(creator.address);
      await fund(router, second);

      // Entitlement is cumulative, so only the new tranche is owed.
      expect(await router.releasable(creator.address)).to.equal((second * 6000n) / BPS);
      // A recipient who never withdrew is owed their share of both tranches.
      expect(await router.releasable(partner.address)).to.equal(
        ((first + second) * 2500n) / BPS,
      );
    });

    it("distributes the full deposit with nothing stranded", async () => {
      const router = await deployRouter();
      const amount = ethers.parseUnits("1000", 18);
      await fund(router, amount);

      await router.release(creator.address);
      await router.release(partner.address);
      await router.release(treasury.address);

      expect(await router.totalReleased()).to.equal(amount);
      expect(await router.pending()).to.equal(0n);
      expect(await asset.balanceOf(await router.getAddress())).to.equal(0n);
    });

    it("recognises directly-transferred assets via sync", async () => {
      const router = await deployRouter();
      const amount = ethers.parseUnits("400", 18);

      // A plain transfer cannot notify the router.
      await asset.transfer(await router.getAddress(), amount);
      expect(await router.totalReceived()).to.equal(0n);
      expect(await router.releasable(creator.address)).to.equal(0n);

      await router.sync();

      expect(await router.totalReceived()).to.equal(amount);
      expect(await router.releasable(creator.address)).to.equal((amount * 6000n) / BPS);
    });

    it("rejects a sync with no untracked balance", async () => {
      const router = await deployRouter();
      await expect(router.sync()).to.be.revertedWithCustomError(router, "ZeroAmount");
    });

    it("refuses to release to a non-recipient", async () => {
      const router = await deployRouter();
      await fund(router, ethers.parseUnits("100", 18));

      await expect(router.release(outsider.address)).to.be.revertedWithCustomError(
        router,
        "NotARecipient",
      );
    });

    it("lets anyone trigger a release on a recipient's behalf", async () => {
      const router = await deployRouter();
      const amount = ethers.parseUnits("1000", 18);
      await fund(router, amount);

      // Permissionless pull: the funds still go to the recipient, not the caller.
      await expect(
        router.connect(outsider).release(creator.address),
      ).to.changeTokenBalance(asset, creator, (amount * 6000n) / BPS);
    });

    it("keeps rounding dust in the contract rather than over-paying", async () => {
      const router = await deployRouter([
        { recipient: creator.address, bps: 3333n, category: Category.Creator, label: "a" },
        { recipient: partner.address, bps: 3333n, category: Category.Partner, label: "b" },
        { recipient: treasury.address, bps: 3334n, category: Category.Treasury, label: "c" },
      ]);

      // 10 wei across thirds cannot divide evenly.
      await fund(router, 10n);
      await router.release(creator.address);
      await router.release(partner.address);
      await router.release(treasury.address);

      const paid = await router.totalReleased();
      expect(paid).to.be.lessThanOrEqual(10n);
      // Never pays out more than it took in.
      expect(await asset.balanceOf(await router.getAddress())).to.equal(10n - paid);
    });
  });
});
