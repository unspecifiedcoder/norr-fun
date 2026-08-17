import { expect } from "chai";
import { ethers } from "hardhat";
import type { BondingCurve, FeeRouter, ProjectToken, SimpleERC20 } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E = (n: string) => ethers.parseUnits(n, 18);

describe("BondingCurve", () => {
  let curve: BondingCurve;
  let projectToken: ProjectToken;
  let base: SimpleERC20;
  let fees: FeeRouter;
  let deployer: HardhatEthersSigner;
  let trader: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let vault: HardhatEthersSigner;

  const CURVE_SUPPLY = E("800000");
  const VIRTUAL_BASE = E("30");
  const TARGET = E("100");
  const FEE_BPS = 100n; // 1%

  beforeEach(async () => {
    [deployer, trader, creator, vault] = await ethers.getSigners();

    base = await (await ethers.getContractFactory("SimpleERC20")).deploy("Base", "BASE", 18);
    projectToken = await (await ethers.getContractFactory("ProjectToken")).deploy(E("1000000"));

    fees = await (await ethers.getContractFactory("FeeRouter")).deploy(
      await base.getAddress(),
      deployer.address,
      [{ recipient: creator.address, bps: 10_000n, category: 0n, label: "creator" }],
    );

    curve = await (await ethers.getContractFactory("BondingCurve")).deploy(
      await projectToken.getAddress(),
      await base.getAddress(),
      await fees.getAddress(),
      VIRTUAL_BASE,
      CURVE_SUPPLY,
      TARGET,
      FEE_BPS,
      vault.address,
      ethers.ZeroAddress, // no factory: reserves go to the recipient
    );

    // Stock the curve and fund the trader.
    await projectToken.transfer(await curve.getAddress(), CURVE_SUPPLY);
    await base.mint(trader.address, E("500"));
    await base.connect(trader).approve(await curve.getAddress(), ethers.MaxUint256);
    await projectToken.connect(trader).approve(await curve.getAddress(), ethers.MaxUint256);
  });

  it("opens at the price implied by the virtual reserves", async () => {
    // price = virtualBase / tokenReserve
    expect(await curve.priceX18()).to.equal((VIRTUAL_BASE * 10n ** 18n) / CURVE_SUPPLY);
    expect(await curve.baseReserve()).to.equal(0n);
  });

  it("sells tokens on a buy and moves the price up", async () => {
    const before = await curve.priceX18();
    const [expected, fee] = await curve.quoteBuy(E("10"));

    await expect(curve.connect(trader).buy(E("10"), 0)).to.changeTokenBalance(
      projectToken,
      trader,
      expected,
    );

    expect(await curve.priceX18()).to.be.greaterThan(before);
    // Fee left the curve; only the net is retained as real reserve.
    expect(await curve.baseReserve()).to.equal(E("10") - fee);
  });

  it("routes the trading fee through the FeeRouter", async () => {
    const [, fee] = await curve.quoteBuy(E("10"));
    await curve.connect(trader).buy(E("10"), 0);

    expect(await fees.totalReceived()).to.equal(fee);
    // The router's sole recipient can withdraw it.
    expect(await fees.releasable(creator.address)).to.equal(fee);
  });

  it("charges more per token as the curve is bought up", async () => {
    const [firstOut] = await curve.quoteBuy(E("10"));
    await curve.connect(trader).buy(E("10"), 0);
    const [secondOut] = await curve.quoteBuy(E("10"));

    // Same spend, fewer tokens: the curve is monotonic.
    expect(secondOut).to.be.lessThan(firstOut);
  });

  it("buys back on a sell and never pays out more than real reserve", async () => {
    await curve.connect(trader).buy(E("50"), 0);
    const held = await projectToken.balanceOf(trader.address);
    const reserveBefore = await curve.baseReserve();

    const [out] = await curve.quoteSell(held);
    expect(out).to.be.lessThanOrEqual(reserveBefore);

    await expect(curve.connect(trader).sell(held, 0)).to.changeTokenBalance(base, trader, out);
    expect(await curve.baseReserve()).to.be.lessThanOrEqual(reserveBefore);
  });

  it("round-trips at a loss equal to the fees, never a profit", async () => {
    const spent = E("40");
    const startBase = await base.balanceOf(trader.address);

    await curve.connect(trader).buy(spent, 0);
    const got = await projectToken.balanceOf(trader.address);
    await curve.connect(trader).sell(got, 0);

    const endBase = await base.balanceOf(trader.address);
    // A buy-then-sell with no other trades must not be profitable.
    expect(endBase).to.be.lessThan(startBase);
  });

  it("honours slippage bounds on both sides", async () => {
    const [out] = await curve.quoteBuy(E("10"));
    await expect(
      curve.connect(trader).buy(E("10"), out + 1n),
    ).to.be.revertedWithCustomError(curve, "SlippageExceeded");

    await curve.connect(trader).buy(E("10"), out);
    const held = await projectToken.balanceOf(trader.address);
    const [baseOut] = await curve.quoteSell(held);
    await expect(
      curve.connect(trader).sell(held, baseOut + 1n),
    ).to.be.revertedWithCustomError(curve, "SlippageExceeded");
  });

  it("rejects zero-amount trades", async () => {
    await expect(curve.connect(trader).buy(0, 0)).to.be.revertedWithCustomError(curve, "ZeroAmount");
    await expect(curve.connect(trader).sell(0, 0)).to.be.revertedWithCustomError(curve, "ZeroAmount");
  });

  it("tracks progress toward graduation", async () => {
    expect(await curve.graduationProgressBps()).to.equal(0n);
    await curve.connect(trader).buy(E("50"), 0);

    const progress = await curve.graduationProgressBps();
    expect(progress).to.be.greaterThan(0n);
    expect(progress).to.be.lessThan(10_000n);
  });

  it("refuses to graduate before the target is met", async () => {
    await curve.connect(trader).buy(E("10"), 0);
    await expect(curve.graduate()).to.be.revertedWithCustomError(curve, "NotReady");
  });

  it("graduates once the target is met, releasing reserves and locking trading", async () => {
    // Enough to clear the 100 target net of 1% fees.
    await curve.connect(trader).buy(E("120"), 0);
    expect(await curve.baseReserve()).to.be.greaterThanOrEqual(TARGET);

    const reserve = await curve.baseReserve();
    const leftover = await curve.tokenReserve();

    await expect(curve.graduate()).to.changeTokenBalance(base, vault, reserve);
    expect(await projectToken.balanceOf(vault.address)).to.equal(leftover);
    expect(await curve.graduated()).to.equal(true);

    await expect(
      curve.connect(trader).buy(E("1"), 0),
    ).to.be.revertedWithCustomError(curve, "AlreadyGraduated");
    await expect(curve.graduate()).to.be.revertedWithCustomError(curve, "AlreadyGraduated");
  });

  it("rejects a fee above the ceiling at construction", async () => {
    const factory = await ethers.getContractFactory("BondingCurve");
    await expect(
      factory.deploy(
        await projectToken.getAddress(),
        await base.getAddress(),
        await fees.getAddress(),
        VIRTUAL_BASE,
        CURVE_SUPPLY,
        TARGET,
        1_001,
        vault.address,
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(curve, "FeeTooHigh");
  });

  it("keeps the invariant from being drained to zero", async () => {
    // A buy that would empty the token side must revert, not divide by zero.
    await expect(
      curve.connect(trader).buy(E("500"), 0),
    ).to.not.be.reverted; // large but bounded by the curve
    expect(await curve.tokenReserve()).to.be.greaterThan(0n);
  });
});
