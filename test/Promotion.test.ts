import { expect } from "chai";
import { ethers } from "hardhat";
import type { Promotion } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Promotion", () => {
  let promo: Promotion;
  let owner: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  const subject = "0x00000000000000000000000000000000000000A1";
  const DAY = 86_400;
  const PRICE = ethers.parseEther("0.05");

  beforeEach(async () => {
    [owner, buyer, treasury] = await ethers.getSigners();
    promo = await (await ethers.getContractFactory("Promotion")).deploy(treasury.address);
    await promo.addTier("Boosted", PRICE, DAY);
  });

  it("ships a free baseline tier so 'unpromoted' is a real choice", async () => {
    expect(await promo.tierCount()).to.equal(2n);
    const standard = await promo.tierAt(0);
    expect(standard.price).to.equal(0n);
    expect(standard.active).to.equal(true);
  });

  it("sells a slot and forwards the payment to the treasury", async () => {
    await expect(
      promo.connect(buyer).promote(subject, 1, { value: PRICE }),
    ).to.changeEtherBalance(treasury, PRICE);

    expect(await promo.isPromoted(subject)).to.equal(true);
    expect(await promo.tierOf(subject)).to.equal(1n);
  });

  it("rejects the wrong payment in either direction", async () => {
    await expect(
      promo.connect(buyer).promote(subject, 1, { value: PRICE - 1n }),
    ).to.be.revertedWithCustomError(promo, "WrongPayment");
    await expect(
      promo.connect(buyer).promote(subject, 1, { value: PRICE + 1n }),
    ).to.be.revertedWithCustomError(promo, "WrongPayment");
  });

  it("expires, so early launches cannot hold the feed forever", async () => {
    await promo.connect(buyer).promote(subject, 1, { value: PRICE });
    expect(await promo.isPromoted(subject)).to.equal(true);

    await ethers.provider.send("evm_increaseTime", [DAY + 1]);
    await ethers.provider.send("evm_mine", []);

    expect(await promo.isPromoted(subject)).to.equal(false);
    // The record survives; only the window lapses.
    expect(await promo.promotedUntil(subject)).to.be.greaterThan(0n);
  });

  it("stacks a second purchase onto the remaining time rather than discarding it", async () => {
    await promo.connect(buyer).promote(subject, 1, { value: PRICE });
    const first = await promo.promotedUntil(subject);

    await promo.connect(buyer).promote(subject, 1, { value: PRICE });
    expect(await promo.promotedUntil(subject)).to.equal(first + BigInt(DAY));
  });

  it("lets anyone pay for any launch, since the only effect is placement", async () => {
    await expect(promo.connect(buyer).promote(subject, 1, { value: PRICE })).to.not.be.reverted;
  });

  it("honours a deactivated tier and unknown ids", async () => {
    await promo.setTierActive(1, false);
    await expect(
      promo.connect(buyer).promote(subject, 1, { value: PRICE }),
    ).to.be.revertedWithCustomError(promo, "TierInactive");

    await expect(
      promo.connect(buyer).promote(subject, 99, { value: 0 }),
    ).to.be.revertedWithCustomError(promo, "UnknownTier");
  });

  it("only lets the owner manage tiers and the treasury", async () => {
    await expect(
      promo.connect(buyer).addTier("Sneaky", 0, DAY),
    ).to.be.revertedWithCustomError(promo, "NotOwner");
    await expect(
      promo.connect(buyer).setTreasury(buyer.address),
    ).to.be.revertedWithCustomError(promo, "NotOwner");
  });

  it("batch-reads promotion state for a feed", async () => {
    const other = "0x00000000000000000000000000000000000000B2";
    await promo.connect(buyer).promote(subject, 1, { value: PRICE });

    const [flags] = await promo.promotedMany([subject, other]);
    expect(flags).to.deep.equal([true, false]);
  });

  it("takes the free tier without payment", async () => {
    await expect(promo.connect(buyer).promote(subject, 0, { value: 0 })).to.not.be.reverted;
    // Zero duration means it confers nothing, which is the point of a baseline.
    expect(await promo.isPromoted(subject)).to.equal(false);
  });
});
