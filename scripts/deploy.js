const hre = require("hardhat");
const fs = require("fs");
async function main() {
  const c = await (await hre.ethers.getContractFactory("Escrow")).deploy();
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("Escrow deployed:", addr);
  const readme = fs.readFileSync("README.md", "utf8").replace(
    /<!--ADDR-->[\s\S]*?<!--\/ADDR-->/,
    `<!--ADDR-->[${addr}](https://sepolia.basescan.org/address/${addr}#code)<!--/ADDR-->`);
  fs.writeFileSync("README.md", readme);
  console.log("README updated. Set VITE_ESCROW_ADDRESS=" + addr + " in Vercel");
  await c.deploymentTransaction().wait(5);
  await hre.run("verify:verify", { address: addr, constructorArguments: [] });
}
main().catch((e) => { console.error(e); process.exit(1); });
