# Onchain Escrow (Base Sepolia)

Buyer locks ETH → seller delivers → buyer releases. If nothing is delivered, the buyer reclaims after the deadline. No middleman.

**Contract address:** <!--ADDR-->NOT DEPLOYED YET (npm run deploy fills this in)<!--/ADDR-->

## Setup
1. `cp .env.example .env` and fill in the values
2. `npm install && npm test`
3. `npm run deploy` (deploys, verifies on Basescan, writes the address above)
4. Set `VITE_ESCROW_ADDRESS` + other `VITE_*` vars in Vercel, then deploy the repo

## Trust model
Only the buyer can release or reclaim. The seller has no on-chain power: they rely on the buyer releasing in time. Reclaim is allowed after the deadline even if the seller delivered, so deadlines should be generous. Native ETH only. Deadlines are 1 hour to 365 days, measured on-chain from creation.

## Known limitations (accepted)
- ETH force-sent to the contract (selfdestruct/coinbase) is unrecoverable; per-deal accounting means it cannot affect any deal.
- A seller that cannot receive ETH makes `release` revert; the buyer reclaims after the deadline.
- Anyone can name you as seller (spam deals). The UI shows your newest 20-50 only.
- The UI uses your device clock to enable the Reclaim button; the contract is the real judge.
