# Security notes

Reviewed by hand and with Hardhat tests (reentrancy, same-block double calls, forced ETH, rejecting sellers, spam, random-sequence invariant). No independent audit. Testnet only.

## Trust model
Only the buyer can release or reclaim. The seller has no on-chain power. A buyer can reclaim as soon as the deadline passes, even if the seller delivered, so sellers must check the deadline first (the app shows a countdown and a warning on short deadlines).

## Known limitations (cannot be fixed without redeploying)
- A seller contract that rejects ETH blocks Release until the deadline (the app warns when the seller is a contract).
- ETH force-sent to the contract is unrecoverable; it cannot affect any deal.
- Anyone can name you as seller (spam). The app pages the list and can hide tiny deals; the contract still stores them.
- A lost buyer key means locked funds until the key is recovered.
- The minimum deadline is 1 hour, so a scam buyer can still use a short window; sellers should ship only against long deadlines or buyers they trust.
- The Alchemy domain allowlist only checks the browser origin header; it reduces abuse but is not strong security.

## Keys
Never store a key that holds real funds in .env. Rotate any key that appeared in a screenshot.
