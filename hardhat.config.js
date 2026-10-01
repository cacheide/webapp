require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { ALCHEMY_BASE_SEPOLIA_URL, DEPLOYER_PRIVATE_KEY, BASESCAN_API_KEY } = process.env;
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    baseSepolia: {
      url: ALCHEMY_BASE_SEPOLIA_URL || "",
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  etherscan: { apiKey: BASESCAN_API_KEY }, // Etherscan V2 key works for Basescan
};
