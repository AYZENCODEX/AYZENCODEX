---
name: AYZEN Wallet Hub
description: Standalone /wallet route (separate from Vault) with balance cards and AZN/USDT/XP/BDT transfers
---

## Rule
Wallet is now a **standalone sidebar group** at `/wallet` (not a tab inside Vault). The Vault group only has Entity / Local / 2FA.

**Why:** User wanted wallet operations decoupled from vault entity management.

## Implementation
- `artifacts/ayzen/src/pages/user/wallet-hub.tsx` — new page with:
  - Balance cards: AZN, USDT, XP, BDT (from GET /api/wallets/tokens)
  - Transfer form with currency selector, recipient username, amount + "Max" button, preview
  - Transfer history from GET /api/wallets/transfers
- App.tsx has lazy `/wallet` route pointing to `WalletHub`.
- `_txLoading` state is prefixed with `_` (unused skeleton toggle); if wiring is needed later, hook it to the transfers fetch.

## API
- GET /api/wallets/tokens → { azn, usdt, credits }
- POST /api/wallets/transfer → { toUsername, currency, amount }
- GET /api/wallets/transfers → array of transfer history rows
