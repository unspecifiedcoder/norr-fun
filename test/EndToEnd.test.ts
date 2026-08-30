import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, solidityPacked, getAddress } from "ethers";
import { MerkleTree } from "merkletreejs";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E = (n: string) => ethers.parseUnits(n, 18);

/** Deploy a FeeRouter through the canonical factory and return it. */
async function deployRouter(
  factory: any,
  asset: string,
  owner: string,
  splits: any[],
) {
  const addr = await factory.getFunction("deploy").staticCall(asset, owner, splits);
  await factory.getFunction("deploy")(asset, owner, splits);
  return ethers.getContractAt("FeeRouter", addr);
}

/**
 * Full-protocol regression: every user-facing flow, in the order a real
 * participant would hit them, against a real chain.
 *
 * Per-contract suites prove each piece in isolation. This proves they compose —
 * that a desk's terms actually gate registration, that a raise's split actually
 * governs both sale proceeds and later trading fees, and that the read surfaces
 * the UI depends on report what the write path did.
 *
 * It runs as one sequential story rather than independent cases because the
 * flows genuinely depend on each other; isolating them would test a state that
 * never occurs in practice.
 */
describe("End-to-end: every flow", () => {
  let deployer: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let deskOwner: HardhatEthersSigner;
  let investor: HardhatEthersSigner;
  let trader: HardhatEthersSigner;

  // Shared state, threaded through the story.
  let boards: any, registry: any, comments: any, social: any, promo: any;
  let routerFactory: any;
  let base: any, projectToken: any, feeRouter: any, ido: any, curve: any;
  let deskId: bigint;

  before(async () => {
    [deployer, creator, deskOwner, investor, trader] = await ethers.getSigners();

    boards = await (await ethers.getContractFactory("BoardRegistry")).deploy();
    routerFactory = await (await ethers.getContractFactory("FeeRouterFactory")).deploy();
    registry = await (await ethers.getContractFactory("LaunchRegistry")).deploy(
      await boards.getAddress(),
      await routerFactory.getAddress(),
    );
    comments = await (await ethers.getContractFactory("LaunchComments")).deploy();
    social = await (await ethers.getContractFactory("SocialGraph")).deploy();
    promo = await (await ethers.getContractFactory("Promotion")).deploy(deployer.address);

    base = await (await ethers.getContractFactory("SimpleERC20")).deploy("AvaxTest", "AVAXTEST", 18);
    await base.mint(investor.address, E("5000"));
    await base.mint(trader.address, E("5000"));
  });

  it("1. an operator opens a desk with terms", async () => {
    await boards.connect(deskOwner).create("northlight", "Northlight", "Infra rounds", 1_000, true);
    deskId = await boards.idBySlug("northlight");

    const d = await boards.at(deskId);
    expect(d.owner).to.equal(deskOwner.address);
    expect(d.minPartnerBps).to.equal(1_000n);
  });

  it("2. a creator deploys a launch: token, router, sale", async () => {
    projectToken = await (await ethers.getContractFactory("ProjectToken")).deploy(E("1000000"));
    await projectToken.transfer(creator.address, E("1000000"));

    // Deployed through the canonical factory: LaunchRegistry will not accept a
    // board-scoped router it cannot attest the provenance of.
    feeRouter = await deployRouter(
      routerFactory,
      await base.getAddress(),
      creator.address,
      [
        { recipient: creator.address, bps: 7_000n, category: 0n, label: "Team" },
        { recipient: deskOwner.address, bps: 1_000n, category: 1n, label: "Desk" },
        { recipient: deployer.address, bps: 2_000n, category: 6n, label: "Treasury" },
      ],
    );
    // LaunchRegistry only trusts a board-scoped FeeRouter once its split is
    // permanently frozen -- lock it here, before it's ever used to register.
    await feeRouter.connect(creator).lock();

    const start = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    // Deployed by the creator, so the creator owns the sale -- the wizard does
    // the same, signing every deployment from the connected wallet.
    ido = await (await ethers.getContractFactory("IDO", creator)).deploy(
      await projectToken.getAddress(),
      await feeRouter.getAddress(),
      start,
      0n,
    );

    expect(await feeRouter.bpsOf(deskOwner.address)).to.equal(1_000n);
  });

  it("3. the desk's terms are enforced at registration", async () => {
    // A router paying the desk nothing must be refused.
    const stingy = await deployRouter(
      routerFactory,
      await base.getAddress(),
      creator.address,
      [{ recipient: creator.address, bps: 10_000n, category: 0n, label: "all" }],
    );
    await stingy.connect(creator).lock();
    await expect(
      registry.connect(creator).register(
        await projectToken.getAddress(),
        await ido.getAddress(),
        await stingy.getAddress(),
        await base.getAddress(),
        deskId,
        { name: "Bad", symbol: "BAD", description: "", logoURI: "" },
      ),
    ).to.be.revertedWithCustomError(registry, "BoardShareTooLow");

    // The compliant one registers and is indexed under the desk.
    await registry.connect(creator).register(
      await projectToken.getAddress(),
      await ido.getAddress(),
      await feeRouter.getAddress(),
      await base.getAddress(),
      deskId,
      {
        name: "Meridian",
        symbol: "MRDN",
        description: "Telemetry infrastructure",
        logoURI: "https://example.invalid/logo.png",
      },
    );

    const entry = await registry.at(0);
    expect(entry.creator).to.equal(creator.address);
    expect(entry.boardId).to.equal(deskId);
    expect(entry.logoURI).to.equal("https://example.invalid/logo.png");

    const [underDesk, total] = await registry.pageByBoard(deskId, 0, 10);
    expect(total).to.equal(1n);
    expect(underDesk[0].symbol).to.equal("MRDN");
  });

  it("4. proceeds route through the split and recipients pull their share", async () => {
    await base.connect(investor).approve(await feeRouter.getAddress(), E("1000"));
    await feeRouter.connect(investor).deposit(E("1000"));

    expect(await feeRouter.totalReceived()).to.equal(E("1000"));
    expect(await feeRouter.releasable(creator.address)).to.equal(E("700"));
    expect(await feeRouter.releasable(deskOwner.address)).to.equal(E("100"));

    await expect(feeRouter.release(deskOwner.address)).to.changeTokenBalance(
      base,
      deskOwner,
      E("100"),
    );
    expect(await feeRouter.releasable(deskOwner.address)).to.equal(0n);
  });

  it("5. the tally is published and an investor claims against a real proof", async () => {
    const allocation = E("50");
    const leaf = keccak256(
      solidityPacked(["address", "uint256"], [getAddress(investor.address), allocation]),
    );
    const tree = new MerkleTree([leaf], keccak256, { sortPairs: true });

    await ido.connect(creator).setMerkleRoot(tree.getHexRoot());
    await ido.connect(creator).finalize();

    await projectToken.connect(creator).approve(await ido.getAddress(), allocation);
    await ido.connect(creator).depositProjectTokens(allocation);

    await expect(
      ido.connect(investor).claim(investor.address, allocation, tree.getHexProof(leaf)),
    ).to.changeTokenBalance(projectToken, investor, allocation);

    // Claiming twice is refused, so an allocation cannot be drained.
    await expect(
      ido.connect(investor).claim(investor.address, allocation, tree.getHexProof(leaf)),
    ).to.be.revertedWithCustomError(ido, "NothingToClaim");
  });

  it("6. the public market opens and trading fees reuse the same split", async () => {
    const curveSupply = E("800000");
    curve = await (await ethers.getContractFactory("BondingCurve")).deploy(
      await projectToken.getAddress(),
      await base.getAddress(),
      await feeRouter.getAddress(),
      E("30"),
      curveSupply,
      E("100"),
      100,
      deployer.address,
      ethers.ZeroAddress,
    );
    await projectToken.connect(creator).transfer(await curve.getAddress(), curveSupply);

    const receivedBefore = await feeRouter.totalReceived();

    await base.connect(trader).approve(await curve.getAddress(), E("60"));
    const priceBefore = await curve.priceX18();
    await curve.connect(trader).buy(E("60"), 0);

    expect(await curve.priceX18()).to.be.greaterThan(priceBefore);
    // The 1% fee landed in the launch's own router, not somewhere new.
    expect(await feeRouter.totalReceived()).to.equal(receivedBefore + E("0.6"));
    expect(await projectToken.balanceOf(trader.address)).to.be.greaterThan(0n);
  });

  it("7. selling returns base and never pays out more than real reserve", async () => {
    const held = await projectToken.balanceOf(trader.address);
    const reserve = await curve.baseReserve();

    await projectToken.connect(trader).approve(await curve.getAddress(), held);
    const [out] = await curve.quoteSell(held / 2n);
    expect(out).to.be.lessThanOrEqual(reserve);

    await expect(curve.connect(trader).sell(held / 2n, 0)).to.changeTokenBalance(
      base,
      trader,
      out,
    );
  });

  it("8. graduation locks the curve once the target is met", async () => {
    await base.connect(trader).approve(await curve.getAddress(), E("2000"));
    await curve.connect(trader).buy(E("200"), 0);
    expect(await curve.graduationProgressBps()).to.equal(10_000n);

    await curve.graduate();
    expect(await curve.graduated()).to.equal(true);
    await expect(
      curve.connect(trader).buy(E("1"), 0),
    ).to.be.revertedWithCustomError(curve, "AlreadyGraduated");
  });

  it("9. discussion records a signed comment and only its author withdraws it", async () => {
    const sale = await ido.getAddress();
    await comments.connect(investor).post(sale, "Split looks fair.");

    expect(await comments.count(sale)).to.equal(1n);
    expect((await comments.at(sale, 0)).author).to.equal(investor.address);

    await expect(
      comments.connect(trader).hide(sale, 0),
    ).to.be.revertedWithCustomError(comments, "NotAuthor");

    await comments.connect(investor).hide(sale, 0);
    expect((await comments.at(sale, 0)).hidden).to.equal(true);
  });

  it("10. follows and the watchlist record on both sides", async () => {
    const sale = await ido.getAddress();
    await social.connect(investor).follow(creator.address);
    await social.connect(investor).save(sale);

    expect(await social.followerCount(creator.address)).to.equal(1n);
    expect(await social.followingCount(investor.address)).to.equal(1n);
    expect(await social.saved(investor.address, sale)).to.equal(true);
    expect(await social.saveCount(sale)).to.equal(1n);
  });

  it("11. promotion is paid for on-chain and expires", async () => {
    const sale = await ido.getAddress();
    const price = ethers.parseEther("0.05");
    await promo.addTier("Boosted", price, 86_400);

    await expect(
      promo.connect(creator).promote(sale, 1, { value: price }),
    ).to.changeEtherBalance(deployer, price);
    expect(await promo.isPromoted(sale)).to.equal(true);

    await ethers.provider.send("evm_increaseTime", [86_401]);
    await ethers.provider.send("evm_mine", []);
    expect(await promo.isPromoted(sale)).to.equal(false);
  });

  it("12. the read surfaces the UI depends on agree with what happened", async () => {
    const sale = await ido.getAddress();

    // Feed
    const [page, total] = await registry.page(0, 10);
    expect(total).to.equal(1n);
    expect(page[0].name).to.equal("Meridian");

    // Profile
    expect(await registry.idsByCreator(creator.address)).to.deep.equal([0n]);

    // Payouts: every recipient's accrual reconciles with the router totals.
    const received = await feeRouter.totalReceived();
    const released = await feeRouter.totalReleased();
    let owed = 0n;
    for (let i = 0; i < (await feeRouter.splitCount()); i++) {
      const s = await feeRouter.splitAt(i);
      owed += await feeRouter.releasable(s.recipient);
    }
    // Rounding dust may remain, so allow a wei-scale shortfall but no excess.
    expect(owed).to.be.lessThanOrEqual(received - released);
    expect(received - released - owed).to.be.lessThan(10n);

    // Activity is reconstructible: the events the feed reads were emitted.
    const releases = await feeRouter.queryFilter(feeRouter.filters.Released());
    const trades = await curve.queryFilter(curve.filters.Bought());
    const claims = await ido.queryFilter(ido.filters.Claimed());
    expect(releases.length).to.be.greaterThan(0);
    expect(trades.length).to.be.greaterThan(0);
    expect(claims.length).to.equal(1);

    // Holders are reconstructible from transfers.
    const transfers = await projectToken.queryFilter(projectToken.filters.Transfer());
    expect(transfers.length).to.be.greaterThan(0);

    expect(await comments.count(sale)).to.equal(1n);
  });
});
