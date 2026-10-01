const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const E = ethers.parseEther("1");
const H = 3600;

describe("Escrow", () => {
  let c, buyer, seller, evil;
  beforeEach(async () => {
    [buyer, seller, evil] = await ethers.getSigners();
    c = await (await ethers.getContractFactory("Escrow")).deploy();
  });
  const mk = (d = H) => c.createDeal(seller.address, d, { value: E });

  it("creates a deal and emits", async () => {
    await expect(mk()).to.emit(c, "DealCreated");
    expect((await c.getDeal(1)).status).to.equal(1n);
    expect(await c.dealCountOf(seller.address)).to.equal(1n);
  });
  it("rejects bad input", async () => {
    await expect(c.createDeal(seller.address, H)).to.be.revertedWithCustomError(c, "ZeroAmount");
    await expect(c.createDeal(ethers.ZeroAddress, H, { value: E })).to.be.revertedWithCustomError(c, "InvalidSeller");
    await expect(c.createDeal(buyer.address, H, { value: E })).to.be.revertedWithCustomError(c, "InvalidSeller");
    await expect(mk(1)).to.be.revertedWithCustomError(c, "InvalidDuration"); // 1-second rug
    await expect(mk(H - 1)).to.be.revertedWithCustomError(c, "InvalidDuration");
    await expect(mk(366 * 24 * H)).to.be.revertedWithCustomError(c, "InvalidDuration");
  });
  it("only buyer releases; seller gets paid", async () => {
    await mk();
    await expect(c.connect(evil).release(1)).to.be.revertedWithCustomError(c, "NotBuyer");
    await expect(c.connect(seller).release(1)).to.be.revertedWithCustomError(c, "NotBuyer");
    await expect(c.release(1)).to.changeEtherBalance(seller, E);
  });
  it("settled deals are frozen", async () => {
    await mk(); await c.release(1);
    await expect(c.release(1)).to.be.revertedWithCustomError(c, "NotFunded");
    await time.increase(2 * H);
    await expect(c.reclaim(1)).to.be.revertedWithCustomError(c, "NotFunded");
  });
  it("reclaim only after deadline, only buyer, then frozen", async () => {
    await mk();
    await expect(c.reclaim(1)).to.be.revertedWithCustomError(c, "DeadlineNotReached");
    await time.increase(H + 1);
    await expect(c.connect(evil).reclaim(1)).to.be.revertedWithCustomError(c, "NotBuyer");
    await expect(c.reclaim(1)).to.changeEtherBalance(buyer, E);
    await expect(c.release(1)).to.be.revertedWithCustomError(c, "NotFunded");
  });
  it("unknown ids revert", async () => {
    await expect(c.release(0)).to.be.reverted;
    await expect(c.reclaim(999)).to.be.reverted;
  });
  it("same-block double release: second call fails", async () => {
    await mk();
    await network.provider.send("evm_setAutomine", [false]);
    const t1 = await c.release(1);
    const t2 = await c.release(1, { gasLimit: 200000 });
    await network.provider.send("evm_mine");
    await network.provider.send("evm_setAutomine", [true]);
    expect((await t1.wait()).status).to.equal(1);
    let failed = false;
    try { await t2.wait(); } catch { failed = true; }
    expect(failed).to.equal(true);
  });
  it("reentrancy cannot double-withdraw", async () => {
    const A = await (await ethers.getContractFactory("Attacker")).deploy(await c.getAddress());
    await mk();
    await A.open(seller.address, H, { value: E });
    await time.increase(H + 100);
    await A.attack();
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(E);
    expect(await A.hits()).to.equal(1n);
  });
  it("rejecting seller cannot lock funds forever", async () => {
    const R = await (await ethers.getContractFactory("Rejecter")).deploy();
    await c.createDeal(await R.getAddress(), H, { value: E });
    await expect(c.release(1)).to.be.revertedWithCustomError(c, "TransferFailed");
    await time.increase(H + 100);
    await expect(c.reclaim(1)).to.changeEtherBalance(buyer, E);
  });
  it("plain ETH sends are rejected", async () => {
    await expect(evil.sendTransaction({ to: await c.getAddress(), value: 1n })).to.be.reverted;
  });
  it("force-sent ETH cannot break accounting", async () => {
    await mk();
    const addr = await c.getAddress();
    await network.provider.send("hardhat_setBalance", [addr, ethers.toBeHex(E * 5n)]);
    await expect(c.release(1)).to.changeEtherBalance(seller, E);
    expect(await ethers.provider.getBalance(addr)).to.equal(E * 4n);
  });
  it("spam cannot break paging", async () => {
    for (let i = 0; i < 60; i++) await c.connect(evil).createDeal(seller.address, H, { value: 1n });
    expect(await c.dealCountOf(seller.address)).to.equal(60n);
    expect((await c.dealsOf(seller.address, 0, 1000)).length).to.equal(50);
    expect((await c.dealsOf(seller.address, 50, 50)).length).to.equal(10);
    expect((await c.dealsOf(seller.address, 99, 5)).length).to.equal(0);
  });
});
