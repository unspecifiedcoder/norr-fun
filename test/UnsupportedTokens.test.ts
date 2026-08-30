import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E = (n: string) => ethers.parseUnits(n, 18);

/**
 * Curves and pairs track reserves in storage rather than reading balances, so a
 * token that delivers less than it was asked for silently credits the shortfall
 * to reserves. The contract then quotes and pays out against liquidity it does
 * not hold; repeated, the gap is absorbed by whoever exits last, who cannot be
 * paid at all.
 *
 * `FeeERC20` is the repo's real fee-taking token, driven here against real
 * deployed contracts -- not a stub standing in for one. These assert the
 * shortfall is refused at the door rather than discovered later by the last
 * seller.
 */
describe("Unsupported tokens (fee-on-transfer)", () => {
  let deployer: HardhatEthersSigner;
  let trader: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let vault: HardhatEthersSigner;
  let collector: HardhatEthersSigner;

  let feeToken: any; // takes 10% on every transferFrom
  let plain: any;

  beforeEach(async () => {
    [deployer, trader, creator, vault, collector] = await ethers.getSigners();

    feeToken = await (
      await ethers.getContractFactory("FeeERC20")
    ).deploy("Fee", "FEE", 18, 10n, collector.address);
    plain = await (await ethers.getContractFactory("SimpleERC20")).deploy("Base", "BASE", 18);
  });

  it("BondingCurve.buy refuses a base asset that shortchanges the transfer", async () => {
    const projectToken = await (
      await ethers.getContractFactory("ProjectToken")
    ).deploy(E("1000000"));

    const fees = await (await ethers.getContractFactory("FeeRouter")).deploy(
      await feeToken.getAddress(),
      deployer.address,
      [{ recipient: creator.address, bps: 10_000n, category: 0n, label: "creator" }],
    );

    const curve = await (await ethers.getContractFactory("BondingCurve")).deploy(
      await projectToken.getAddress(),
      await feeToken.getAddress(), // fee-on-transfer base
      await fees.getAddress(),
      E("30"),
      E("800000"),
      E("100"),
      100,
      vault.address,
      ethers.ZeroAddress,
    );
    await projectToken.transfer(await curve.getAddress(), E("800000"));

    await feeToken.mint(trader.address, E("500"));
    await feeToken.connect(trader).approve(await curve.getAddress(), ethers.MaxUint256);

    // Without the check this succeeds, crediting baseReserve with 10% more base
    // than the curve actually received.
    await expect(
      curve.connect(trader).buy(E("100"), 0),
    ).to.be.revertedWithCustomError(curve, "UnsupportedToken");

    expect(await curve.baseReserve()).to.equal(0n);
  });

  it("LiquidityPair.addLiquidity refuses a side that shortchanges the transfer", async () => {
    const factory = await (await ethers.getContractFactory("PairFactory")).deploy();
    const pairAddr = await factory.ensurePair.staticCall(
      await feeToken.getAddress(),
      await plain.getAddress(),
    );
    await factory.ensurePair(await feeToken.getAddress(), await plain.getAddress());
    const pair = await ethers.getContractAt("LiquidityPair", pairAddr);

    await feeToken.mint(deployer.address, E("1000"));
    await plain.mint(deployer.address, E("1000"));
    await feeToken.approve(pairAddr, ethers.MaxUint256);
    await plain.approve(pairAddr, ethers.MaxUint256);

    const feeIsZero =
      (await pair.token0()).toLowerCase() === (await feeToken.getAddress()).toLowerCase();
    const [a0, a1] = feeIsZero ? [E("100"), E("100")] : [E("100"), E("100")];

    await expect(
      pair.addLiquidity(a0, a1, deployer.address),
    ).to.be.revertedWithCustomError(pair, "UnsupportedToken");

    expect(await pair.totalSupply()).to.equal(0n);
  });

  it("a pool of well-behaved tokens is unaffected", async () => {
    const other = await (await ethers.getContractFactory("SimpleERC20")).deploy("Two", "TWO", 18);
    const factory = await (await ethers.getContractFactory("PairFactory")).deploy();
    const pairAddr = await factory.ensurePair.staticCall(
      await plain.getAddress(),
      await other.getAddress(),
    );
    await factory.ensurePair(await plain.getAddress(), await other.getAddress());
    const pair = await ethers.getContractAt("LiquidityPair", pairAddr);

    await plain.mint(deployer.address, E("1000"));
    await other.mint(deployer.address, E("1000"));
    await plain.approve(pairAddr, ethers.MaxUint256);
    await other.approve(pairAddr, ethers.MaxUint256);

    await pair.addLiquidity(E("100"), E("100"), deployer.address);
    expect(await pair.totalSupply()).to.be.greaterThan(0n);

    // Reserves match the contract's real balances -- the invariant the check protects.
    expect(await pair.reserve0()).to.equal(await plain.balanceOf(pairAddr));
    expect(await pair.reserve1()).to.equal(await other.balanceOf(pairAddr));
  });
});
