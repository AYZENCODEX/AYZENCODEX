---
name: AYZEN Teams Mega Feature
description: Teams page structure, API routing quirk, and feature notes
---

## CRITICAL: customFetch URL Prefix
All manual `customFetch(...)` calls in `artifacts/ayzen/src/pages/user/teams.tsx` MUST use `/api/teams/...` NOT `/teams/...`.

**Why:** `setBaseUrl` is never called in the web app. Vite's proxy only maps `/api/*` to the backend (port 8000). Without the `/api` prefix, `customFetch("/teams")` hits the Vite frontend server and gets HTML back, causing JSON parse errors. Teams create/load/invite silently fail.

**How to apply:** Every new `customFetch` call in teams.tsx must start with `/api/...`. This is unique to manual fetch calls — generated hooks from `@workspace/api-client-react` already include `/api/` in their paths via the orval-generated client.

## Feature Notes
- Teams use `pending`/`active` status (admin must approve)
- `team_members.status` for invite flow: `pending` invite → `active` member
- `GET /api/teams/my-invites` MUST be before `GET /api/teams/:id` in the router
- Groq → OpenRouter → AI fallback for AI features

## Vault Wallet Tab
- Vault sidebar group contains: Entity / Local / 2FA / Wallet (all four)
- Standalone `/wallet` route (`WalletHub`) also exists in USER_NAV as a separate "Wallet" group
- Both coexist — they are NOT mutually exclusive

## Email @ Icon
- `AtSign` icon is in the sidebar header icon row for ALL users (admin and non-admin)
- Links to `/ayzen-email` via `navigate()`
