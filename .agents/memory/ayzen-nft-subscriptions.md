---
name: AYZEN NFT Subscription System
description: NFT-based subscription system where users mint tradeable NFTs with AZN to get platform subscriptions
---

## Architecture
- `nft_subscriptions` table (Phase 15 migration): token_id (unique), owner_id, original_owner_id, plan, metadata JSONB, expires_at, is_listed, list_price, transfer_count, is_burned
- Routes: `artifacts/api-server/src/routes/nft-subscriptions.ts` registered in routes/index.ts

## Key Design Decisions
- **All financial operations use pg transactions with FOR UPDATE locks** — mint and buy flows use `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` to prevent race conditions/double-spend
- **Mint**: deducts AZN from credits (locked), inserts NFT, activates subscription in subscriptions table, logs credit_transaction
- **Buy**: locks credits+NFT row, deducts buyer, credits seller, transfers ownership, renews expiry (30d from purchase), revokes seller's subscription if no remaining NFTs
- **AZN costs**: pro=30 AZN, enterprise=60 AZN; duration 30 days

## Frontend
- `/nft-marketplace` page: marketplace tab + my-nfts tab, mint modal, list modal
- `useAuth().user?.id` used for ownership detection (NOT raw token parsing)
- Route added in App.tsx; "NFT Market" in sidebar under Wallet group

**Why:** Subscription NFTs make subscriptions tradeable — buyer gets subscription, seller loses it. AZN flows between users for secondary market.
