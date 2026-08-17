import { expect } from "chai";
import { ethers } from "hardhat";
import type { SocialGraph } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SocialGraph", () => {
  let graph: SocialGraph;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  const raiseA = "0x00000000000000000000000000000000000000A1";
  const raiseB = "0x00000000000000000000000000000000000000B2";

  beforeEach(async () => {
    [alice, bob, carol] = await ethers.getSigners();
    graph = await (await ethers.getContractFactory("SocialGraph")).deploy();
  });

  describe("follows", () => {
    it("records a follow on both sides of the edge", async () => {
      await graph.connect(alice).follow(bob.address);

      expect(await graph.follows(alice.address, bob.address)).to.equal(true);
      expect(await graph.followerCount(bob.address)).to.equal(1n);
      expect(await graph.followingCount(alice.address)).to.equal(1n);
      // The edge is directed: bob does not follow alice back.
      expect(await graph.follows(bob.address, alice.address)).to.equal(false);
      expect(await graph.followerCount(alice.address)).to.equal(0n);
    });

    it("refuses self-follows and zero", async () => {
      await expect(
        graph.connect(alice).follow(alice.address),
      ).to.be.revertedWithCustomError(graph, "CannotFollowSelf");
      await expect(
        graph.connect(alice).follow(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(graph, "ZeroAddress");
    });

    it("refuses a duplicate follow, so counts cannot be inflated", async () => {
      await graph.connect(alice).follow(bob.address);
      await expect(
        graph.connect(alice).follow(bob.address),
      ).to.be.revertedWithCustomError(graph, "AlreadyFollowing");
      expect(await graph.followerCount(bob.address)).to.equal(1n);
    });

    it("unfollows and decrements both counts", async () => {
      await graph.connect(alice).follow(bob.address);
      await graph.connect(alice).unfollow(bob.address);

      expect(await graph.follows(alice.address, bob.address)).to.equal(false);
      expect(await graph.followerCount(bob.address)).to.equal(0n);
      expect(await graph.followingCount(alice.address)).to.equal(0n);
    });

    it("refuses to unfollow someone not followed, so counts cannot underflow", async () => {
      await expect(
        graph.connect(alice).unfollow(bob.address),
      ).to.be.revertedWithCustomError(graph, "NotFollowing");
    });

    it("accumulates followers from several accounts", async () => {
      await graph.connect(alice).follow(carol.address);
      await graph.connect(bob).follow(carol.address);
      expect(await graph.followerCount(carol.address)).to.equal(2n);

      await graph.connect(alice).unfollow(carol.address);
      expect(await graph.followerCount(carol.address)).to.equal(1n);
    });

    it("batch-reads follow state", async () => {
      await graph.connect(alice).follow(bob.address);
      expect(
        await graph.followsMany(alice.address, [bob.address, carol.address]),
      ).to.deep.equal([true, false]);
    });
  });

  describe("watchlist", () => {
    it("saves a raise and counts it on both sides", async () => {
      await graph.connect(alice).save(raiseA);

      expect(await graph.saved(alice.address, raiseA)).to.equal(true);
      expect(await graph.savedCount(alice.address)).to.equal(1n);
      expect(await graph.saveCount(raiseA)).to.equal(1n);
    });

    it("refuses a duplicate save", async () => {
      await graph.connect(alice).save(raiseA);
      await expect(
        graph.connect(alice).save(raiseA),
      ).to.be.revertedWithCustomError(graph, "AlreadySaved");
    });

    it("unsaves and refuses to unsave twice", async () => {
      await graph.connect(alice).save(raiseA);
      await graph.connect(alice).unsave(raiseA);

      expect(await graph.saved(alice.address, raiseA)).to.equal(false);
      expect(await graph.savedCount(alice.address)).to.equal(0n);
      expect(await graph.saveCount(raiseA)).to.equal(0n);

      await expect(
        graph.connect(alice).unsave(raiseA),
      ).to.be.revertedWithCustomError(graph, "NotSaved");
    });

    it("keeps watchlists independent per account", async () => {
      await graph.connect(alice).save(raiseA);
      await graph.connect(bob).save(raiseA);
      await graph.connect(bob).save(raiseB);

      expect(await graph.savedCount(alice.address)).to.equal(1n);
      expect(await graph.savedCount(bob.address)).to.equal(2n);
      expect(await graph.saveCount(raiseA)).to.equal(2n);
      expect(await graph.saveCount(raiseB)).to.equal(1n);
    });

    it("batch-reads save state for a feed", async () => {
      await graph.connect(alice).save(raiseB);
      expect(
        await graph.savedMany(alice.address, [raiseA, raiseB]),
      ).to.deep.equal([false, true]);
    });
  });
});
