const deal = [
  { name: "id", type: "uint256" }, { name: "buyer", type: "address" }, { name: "seller", type: "address" },
  { name: "amount", type: "uint256" }, { name: "deadline", type: "uint64" }, { name: "status", type: "uint8" },
];
export const escrowAbi = [
  { type: "function", name: "createDeal", stateMutability: "payable", inputs: [{ name: "seller", type: "address" }, { name: "duration", type: "uint64" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "reclaim", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "dealCountOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "dealsOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "start", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [{ type: "tuple[]", components: deal }] },
];
export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS;
export const EXPLORER = "https://sepolia.basescan.org";
