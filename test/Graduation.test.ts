import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E = (n: string) => ethers.parseUnits(n, 18);

/**
 * Graduation into a live pool, and the pool itself.
 *
 * Covers the path the curve tests deliberately skip by passing no factory:
 * that a graduated launch ends up with a real, tradeable pool rather than a
 * pile of tokens in someone's wallet.
 */
describe("PairFactory and graduation into a pool", () => {
  let factory: any, pair: any, curve: any;
  let token: any, base: any, fees: any;
  let deployer: HardhatEthersSigner;
  let trader: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let vault: HardhatEthersSigner;

  beforeEach(async () => {
    [deployer, trader, creator, vault] = await ethers.getSigners();
    factory = await (await ethers.getContractFactory("PairFactory")).deploy();
    base = await (await ethers.getContractFactory("SimpleERC20")).deploy("Base", "BASE", 18);
    token = await (await ethers.getContractFactory("ProjectToken")).deploy(E("1000000"));
    fees = await (await ethers.getContractFactory("FeeRouter")).deploy(
      await base.getAddress(),
      deployer.address,
      [{ recipient: creator.address, bps: 10_000n, category: 0n, label: "creator" }],
    );
  });

  describe("PairFactory", () => {
    it("creates one pool per pair regardless of argument order", async () => {
      const a = await token.getAddress();
      const b = await base.getAddress();

      await factory.createPair(a, b);
      const first = await factory.getPair(a, b);

      // Reversed order must resolve to the same pool, not a second one.
      expect(await factory.getPair(b, a)).to.equal(first);
      expect(await factory.pairCount()).to.equal(1n);

      await expect(factory.createPair(b, a)).to.be.revertedWithCustomError(
        factory,
        "PairExists",
      );
    });

    it("ensurePair returns the existing pool rather than failing", async () => {
      const a = await token.getAddress();
      const b = await base.getAddress();

      await factory.ensurePair(a, b);
      const before = await factory.pairCount();
      await factory.ensurePair(a, b);

      expect(await factory.pairCount()).to.equal(before);
    });

    it("rejects identical and zero tokens", async () => {
      const a = await token.getAddress();
      await expect(factory.createPair(a, a)).to.be.revertedWithCustomError(
        factory,
        "IdenticalTokens",
      );
      await expect(
        factory.createPair(a, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });
  });

  describe("LiquidityPair", () => {
    beforeEach(async () => {
      await factory.createPair(await token.getAddress(), await base.getAddress());
      pair = await ethers.getContractAt(
        "LiquidityPair",
        await factory.getPair(await token.getAddress(), await base.getAddress()),
      );
      await base.mint(deployer.address, E("10000"));
      await base.mint(trader.address, E("1000"));
      await token.approve(await pair.getAddress(), ethers.MaxUint256);
      await base.approve(await pair.getAddress(), ethers.MaxUint256);
      await base.connect(trader).approve(await pair.getAddress(), ethers.MaxUint256);
    });

    const seed = async () => {
      const t0 = await pair.token0();
      const tokenIsZero = t0.toLowerCase() === (await token.getAddress()).toLowerCase();
      const [a0, a1] = tokenIsZero ? [E("10000"), E("100")] : [E("100"), E("10000")];
      await pair.addLiquidity(a0, a1, deployer.address);
      return tokenIsZero;
    };

    it("locks a minimum on first deposit so supply can never return to zero", async () => {
      await seed();
      expect(await pair.totalSupply()).to.be.greaterThan(await pair.balanceOf(deployer.address));
      expect(await pair.balanceOf(ethers.ZeroAddress)).to.equal(0n);
    });

    it("swaps along the invariant and charges the LP fee", async () => {
      const tokenIsZero = await seed();
      const before = await token.balanceOf(trader.address);

      // Swap base -> token, whichever side that is.
      const zeroForOne = !tokenIsZero;
      const expected = await pair.quote(E("10"), zeroForOne);
      await pair.connect(trader).swap(E("10"), 0, zeroForOne, trader.address);

      expect((await token.balanceOf(trader.address)) - before).to.equal(expected);
      // The fee stays in the pool, so reserves grow faster than a fee-free swap.
      expect(await pair.priceX18()).to.be.greaterThan(0n);
    });

    it("honours slippage and refuses empty swaps", async () => {
      const tokenIsZero = await seed();
      const zeroForOne = !tokenIsZero;
      const expected = await pair.quote(E("10"), zeroForOne);

      await expect(
        pair.connect(trader).swap(E("10"), expected + 1n, zeroForOne, trader.address),
      ).to.be.revertedWithCustomError(pair, "SlippageExceeded");
      await expect(
        pair.connect(trader).swap(0, 0, zeroForOne, trader.address),
      ).to.be.revertedWithCustomError(pair, "InsufficientInput");
    });

    it("returns both sides on withdrawal", async () => {
      await seed();
      const shares = await pair.balanceOf(deployer.address);
      await pair.removeLiquidity(shares / 2n, deployer.address);

      expect(await pair.balanceOf(deployer.address)).to.equal(shares - shares / 2n);
      expect(await pair.reserve0()).to.be.greaterThan(0n);
      expect(await pair.reserve1()).to.be.greaterThan(0n);
    });
  });

  describe("graduation", () => {
    it("seeds a live pool and hands the LP position to the recipient", async () => {
      const curveSupply = E("800000");
      curve = await (await ethers.getContractFactory("BondingCurve")).deploy(
        await token.getAddress(),
        await base.getAddress(),
        await fees.getAddress(),
        E("30"),
        curveSupply,
        E("100"),
        100,
        vault.address,
        await factory.getAddress(),
      );
      await token.transfer(await curve.getAddress(), curveSupply);
      await base.mint(trader.address, E("500"));
      await base.connect(trader).approve(await curve.getAddress(), ethers.MaxUint256);

      await curve.connect(trader).buy(E("120"), 0);
      const reserve = await curve.baseReserve();
      const leftover = await curve.tokenReserve();

      await curve.graduate();

      const pairAddress = await curve.graduationPair();
      expect(pairAddress).to.not.equal(ethers.ZeroAddress);

      const pool = await ethers.getContractAt("LiquidityPair", pairAddress);
      // The pool actually holds the released reserves.
      const held0 = await pool.reserve0();
      const held1 = await pool.reserve1();
      expect(held0 + held1).to.equal(reserve + leftover);

      // The LP position belongs to the recipient, not the curve.
      expect(await pool.balanceOf(vault.address)).to.be.greaterThan(0n);
      expect(await pool.balanceOf(await curve.getAddress())).to.equal(0n);

      // And it is immediately tradeable.
      await base.mint(creator.address, E("10"));
      await base.connect(creator).approve(pairAddress, ethers.MaxUint256);
      const tokenIsZero =
        (await pool.token0()).toLowerCase() === (await token.getAddress()).toLowerCase();
      const out = await pool.quote(E("1"), !tokenIsZero);
      expect(out).to.be.greaterThan(0n);
      await pool.connect(creator).swap(E("1"), 0, !tokenIsZero, creator.address);
      expect(await token.balanceOf(creator.address)).to.equal(out);
    });
  });
});
