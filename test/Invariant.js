const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Invariant: contract balance equals the sum of funded deals", () => {
  it("holds across random create/release/reclaim sequences", async () => {
    const [a, b, c] = await ethers.getSigners();
    const e = await (await ethers.getContractFactory("Escrow")).deploy();
    const addr = await e.getAddress();
    const buyers = [a, b];
    let seed = 12345;
    const rnd = (n) => { seed = (seed * 48271) % 2147483647; return seed % n; };
    for (let i = 0; i < 60; i++) {
      const op = rnd(3);
      const n = Number(await e.dealCount());
      if (op === 0 || n === 0) {
        await e.connect(buyers[rnd(2)]).createDeal(c.address, 3600 + rnd(5000), { value: BigInt(1 + rnd(1000)) });
      } else {
        const id = 1 + rnd(n);
        const d = await e.getDeal(id);
        const who = buyers.find((s) => s.address === d.buyer);
        if (op === 1) await e.connect(who).release(id).catch(() => {});
        else { await time.increase(rnd(4000)); await e.connect(who).reclaim(id).catch(() => {}); }
      }
      let sum = 0n;
      const total = Number(await e.dealCount());
      for (let id = 1; id <= total; id++) { const d = await e.getDeal(id); if (d.status === 1n) sum += d.amount; }
      expect(await ethers.provider.getBalance(addr)).to.equal(sum);
    }
  });
});
