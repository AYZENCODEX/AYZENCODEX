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

## Sidebar Tab Deep-Linking Pattern
Pages with an internal tab switcher (e.g. `teams.tsx`, `developer.tsx`) sync tab state to the URL `?tab=` query param via `useSearch()`/`useLocation()` from `wouter`, so sidebar sub-items can link directly to a specific tab and the page highlights the right one on load.

**Why:** Sidebar nav groups need a stable href per sub-item to support active-state highlighting and direct navigation; without URL sync, clicking a sub-item lands on the default tab.

**How to apply:** When adding a new sidebar sub-item that maps to an in-page tab, check whether the target page already reads `?tab=` — if not, add a `useState` initializer that reads `urlTab` plus a `useEffect` that re-syncs on URL change (see `developer.tsx` and `teams.tsx`). When building a typed tab-options array with a `.filter()`, declare the typed array as a separate `const` first — annotating the array literal then chaining `.filter()` directly loses the literal string-union typing on `id`.

## Team-Scoped Enroll Endpoints (project/vault/task)
`POST /api/teams/:id/enroll-project`, `POST /api/teams/:id/vault`, `POST /api/teams/:id/tasks/:taskId/enroll` (leader-only) bulk-join active team members into a project, create a shared vault entity, or bulk-create pending task submissions.

**Why:** `vault_entries.team_id` and `task_submissions.entity_ids` columns exist in Postgres (added via raw `ALTER TABLE` in the startup migrations array) but were never added to the Drizzle table schema objects in `lib/db/src/schema/`. Passing these as camelCase keys to `db.insert(table).values({...})` silently fails to compile/persist since Drizzle doesn't know the column exists.

**How to apply:** For any column that's in the DB via a raw-SQL startup migration but missing from the Drizzle schema file, write/update it with `db.execute(sql\`...\`)` raw SQL instead of the Drizzle query builder — don't add it to `.values()`. Before adding a new field to an insert/update on `vaultEntriesTable` or `taskSubmissionsTable`, grep the schema file first to confirm the field is actually declared.
