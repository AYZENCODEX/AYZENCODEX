# AYZEN — Master Implementation Prompt

> **Purpose of this file**: This is the single consolidated spec for everything discussed for the AYZEN platform. Feed this whole file to a coding agent (Claude Code, etc.) as the implementation brief — no need to re-explain requirements turn by turn. Each module below is independent enough to implement in its own pass. Build order is suggested in the **Implementation Phases** section at the end.
>
> **Non-negotiable architecture rule for ALL modules**: Nothing in this spec should be hardcoded if it can instead be a row in a database table or a config object an admin/user can edit. Dropdown options, categories, metric labels, thresholds, gating rules — all DB-driven. This is referenced throughout as **[CONFIGURABLE]**.

---

## 0. Current State (verified from codebase, AYZENCODEX)

- Monorepo: pnpm workspaces, Node 24, TypeScript, React+Vite+Tailwind frontend, Express 5 API, Postgres + Drizzle ORM, Zod validation, Orval codegen.
- Existing tables relevant here: `projects`, `user_projects`, `project_enrollments`, `vault_entries`, `local_accounts` (raw SQL, not yet in Drizzle schema file), `wallets`, `email_accounts`, `subscriptions`, `credits`/`credit_transactions`, `settings`, `plugins` (slug/name/enabled/config — metadata only, not a real loader), `error_logs`.
- `tools.ts`: gas price for **Ethereum only** is real (Etherscan gas oracle + llamarpc RPC fallback). The other 23 networks listed in `NETWORKS` are **derived/randomized**: `n.baseGas * scaleFactor * variation` where `variation = 1 + (Math.random() - 0.4) * 0.15` — this is the simulated part to fix.
- `telemetry.ts`: `FUNCTION_REGISTRY` is a hardcoded list, and `callCount24h`, `callCount7d`, `errorRate`, `avgLatencyMs` are all `Math.random()`. `/telemetry/errors` returns a hardcoded synthetic array, not real `error_logs` rows.

---

## 1. Plugin System — "Upload a Plugin, It Just Works"

### Goal
Drop in a plugin package → it registers itself (backend routes + frontend UI panel + DB needs) without manually wiring code into the core app.

### Plugin package format
A plugin is a `.zip` containing:
```
plugin.json        # manifest
backend/index.ts    # exports an Express Router (default export)
frontend/index.tsx  # exports a React component (default export) — the plugin's UI panel
migrations/*.sql     # optional — plugin's own tables, namespaced (e.g. plugin_<slug>_*)
```

`plugin.json` manifest fields:
```json
{
  "slug": "candydrop-tracker",
  "name": "CandyDrop Tracker",
  "version": "1.0.0",
  "sidebarLabel": "CandyDrop",
  "sidebarIcon": "gift",
  "mountPoint": "project.exchange",      // where in the app this plugin attaches
  "settingsSchema": { "...": "json-schema for plugin's own config form" },
  "permissions": ["read:projects", "read:entities"]
}
```

### Upload flow (admin only)
1. Admin uploads zip via `POST /api/plugins/upload`.
2. Server extracts to `plugins/<slug>/`, validates manifest against a schema, runs any `migrations/*.sql` inside a transaction.
3. Backend: dynamically `import()` the plugin's `backend/index.ts` (compiled) and `app.use('/api/plugins/<slug>', router)` — mounted at runtime, no server restart needed if using a dynamic router registry (see below).
4. Frontend: plugin's bundle is built separately (esbuild) into `plugins/<slug>/frontend/bundle.js`, served statically, and lazy-loaded via `React.lazy(() => import(/* webpackIgnore */ '/plugins/<slug>/frontend/bundle.js'))` based on `mountPoint`.
5. Row inserted into existing `plugins` table — `config` column stores manifest + settings.
6. **[CONFIGURABLE]** Enable/disable toggle already exists (`plugins.enabled`) — wire it to actually skip mounting the router/UI when false, not just a cosmetic flag.

### Dynamic router registry (backend)
Implement a `PluginRouterRegistry` singleton:
- `register(slug, router)` / `unregister(slug)`
- One catch-all Express middleware: `app.use('/api/plugins/:slug', (req, res, next) => registry.get(req.params.slug)?.(req, res, next) ?? next())`
- This avoids needing `app.use()` calls baked in at server boot for every plugin.

### Security requirement (must address, not optional)
Uploaded code = arbitrary code execution risk. Minimum bar before shipping this:
- Run plugin backend code in a **separate worker process / vm context** with restricted permissions (no raw `fs`, no arbitrary network unless declared in `permissions`), OR
- Restrict plugin "backend" to a declarative config (no arbitrary JS) for v1, and only allow real code execution once a sandboxing layer exists.
- Validate `migrations/*.sql` against an allow-list of statement types (no `DROP`, no access to other plugins' tables) before executing.
- Plugin upload should be **admin-only**, never exposed to regular users.

---

## 2. Dashboard Hierarchy — Project view & Entity view

Two drill-down hierarchies over the same underlying data (`vault_entries` = "Entity", `project_enrollments` = the link between an Entity and a Project).

### Project tab
- Project list → click → full entity-wise breakdown for that project: per-entity progress %, ROI, plus aggregate stat cards (total entities enrolled, avg ROI, completion %).
- Graphs: ROI trend, task-completion rate, entity growth over time.
- Activity heatmap scoped to the project (extend existing `activity-heatmap.tsx` to accept a `projectId` filter).

### Entity tab
- Entity list → click → that entity's summary across **all** projects it's enrolled in: overall ROI (sum), overall progress %, per-project breakdown table + comparison graph.
- New endpoint needed: `GET /api/entities/:id/summary` — joins `project_enrollments` → `projects` → `entity_project_roi` (see §4) and aggregates.

---

## 3. Project Sidebar Categories — Exchange / Instant / Web3 / Content / Task

`projects` table needs new columns: `type` (`exchange|instant|web3|content`), `category`, `subCategory`, `accountTypeFilter` (`new|old|both`). **[CONFIGURABLE]** — all values for `category`/`subCategory` come from a `categories` table (see §5), not enums.

- **Exchange**: campaign projects (CandyDrop, CandyBomb, Booster, Trading Volume types). First-level filter is New Account / Old Account / Both, then category → sub-category.
- **Instant**: instant-reward game-style projects (Zar/meme-type). Simpler task structure — one-time claim, no long-term holding tracked.
- **Web3**: social farming projects (Twitter farming, Farcaster farming). Track posting frequency/schedule per project.
- **Content**: not a project type — an AI tool (see §9).
- **Task**: shows tasks for the user's enrolled projects only (existing `tasks` + `task_submissions` tables already support this — no schema change needed, just a filtered view).

---

## 4. ROI Attribution — Entity vs Project (kept separate, not double-counted)

New table:
```sql
entity_project_roi (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER NOT NULL REFERENCES vault_entries(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  roi_amount REAL NOT NULL DEFAULT 0,
  progress_percent REAL NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(entity_id, project_id)
)
```
- Project-level ROI = `SUM(roi_amount) WHERE project_id = X` (replaces/derives the existing `projects.totalRoiDistributed`).
- Entity-level ROI = `SUM(roi_amount) WHERE entity_id = X`.
- Never store ROI only at the project level again — always write through this join table so both views stay consistent.

---

## 5. Category Template System

```sql
category_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,              -- exchange|instant|web3|content
  sub_categories JSONB NOT NULL,   -- array of {name, ...}
  created_by INTEGER REFERENCES users(id),
  is_global BOOLEAN NOT NULL DEFAULT false
)

categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id),  -- self-referencing for sub-category
  type TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT true
)
```
- "Apply Template" dropdown on project creation; user can edit after applying.
- `is_global = true` (admin-created) → visible to all users. Otherwise personal to creator.
- This same `categories` table should also back **§3's** category/sub-category dropdowns and **Local Accounts'** platform categories (§7) — one configurable taxonomy, reused everywhere, instead of three separate hardcoded lists.

---

## 6. Entity Health Flag

- `vault_entries` needs: `status` (`active|warning|banned|suspended`), `last_activity_at`.
- Computed badge (🟢/🟡/🔴) driven by a rules table, **[CONFIGURABLE]** thresholds (not if/else in code):
```sql
health_rules (
  id SERIAL PRIMARY KEY,
  rule_key TEXT NOT NULL,        -- e.g. "missing_2fa", "inactive_days"
  threshold_value TEXT,          -- e.g. "30" for days
  severity TEXT NOT NULL,        -- warning|critical
  enabled BOOLEAN NOT NULL DEFAULT true
)
```
- Background job (or computed on-read) evaluates each entity against enabled rules → returns worst severity as the badge.
- Entity Dashboard tab shows aggregate: "X entities missing 2FA", "Y entities missing wallet", etc. — driven by the same rule evaluation, just counted instead of per-row.

---

## 7. Bulk Actions

Build one reusable multi-select component (checkbox column + sticky action bar) and reuse across:
- Local Accounts, Entities, Wallets: bulk category assign, bulk status update, bulk delete.
- Project detail: bulk-enroll multiple entities into one project.
- CSV import/export for Local Accounts, Entities, Wallets.

No new schema needed — these are batch versions of existing single-row CRUD endpoints. Add `POST /api/<resource>/bulk` endpoints that accept an array of IDs + an action payload.

---

## 8. Vault Hub — Local / Entity / Wallet / 2FA / Mail

### Local
- Sidebar: Dashboard, Account.
- Dashboard tabs: **Overview** (ROI + progress summed across all categories) and **Category** (select a platform → see that platform's specific metric: Gmail→points, Facebook/Instagram→followers, LinkedIn→connections, GitHub→repositories, Reddit→followers, + progress + ROI).
- Existing `local_accounts` table already has `category`, `followers`, `account_worth`, `buy_price` — good ROI source (`account_worth - buy_price`).
- **Required change**: replace the single `followers` text field with a generic `metric_type TEXT, metric_value REAL` pair **[CONFIGURABLE]** so each category's metric label/unit is defined once in the `categories` table (§5) instead of hardcoded per-platform logic in the React component (`local-accounts.tsx`'s `PlatformMeta`).
- New table for trend/progress: `local_account_snapshots (id, local_account_id, metric_value, captured_at)` — periodic snapshot so "progress" can mean growth-over-time, not just a static number.

### Entity
- Dashboard tab = the completeness checker from §6 (missing-field audit), scoped to entities.

### Wallet
- All entities' seed phrases centralized here for real-time use (connect, check balance, sign).
- **Required schema addition**: `vault_entries` needs `encrypted_seed_phrase TEXT` (does not exist yet — only `walletAddresses`, which is just addresses, not the phrase).
- Extend `use-wallet-connect.ts` to load a phrase from a given entity and connect it live (ethers/web3 provider) rather than only handling a standalone `wallets` row.
- Minimum security bar (do this regardless of priority placed on it elsewhere): encrypt the phrase at rest with a server-side key (e.g. AES-256-GCM via `crypto`), never log it, never return it in list endpoints — only on an explicit single-entity "reveal" call. This is the same baseline every password manager applies; it doesn't block "real-time use," it just means decrypt-on-demand instead of storing plaintext.

### 2FA — 3 tabs
- **Local**: auto-pulled from `local_accounts.twofa`.
- **Entity**: auto-pulled and flattened from `vault_entries`' per-platform 2FA fields (`twitter2fa`, `discord2fa`, etc.) — one row per entity per platform.
- **Other**: manual entries. New table: `other_two_factor_codes (id, user_id, label, secret, notes, created_at)`.
- Stretch feature: if a stored secret is a valid TOTP secret (otpauth format), generate a live rotating 6-digit code client-side instead of showing the static secret.

### Mail
- Aggregates all email addresses configured under Entity (`vault_entries.email`, `twitterEmail`, `discordEmail`, `telegramLinkedEmail`) and Local (`local_accounts.email`/`recoveryEmail`).
- `email_accounts` needs `source_type TEXT` (`entity|local|standalone`) and `source_id INTEGER` so an actual IMAP/SMTP config can be linked back to the account it belongs to, avoiding duplicate/unlinked entries.

---

## 9. Content Tab — AI Generation Tool

Not a project category — a content tool that attaches to Web3-farming projects.

```sql
project_memory (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  content_type TEXT NOT NULL,   -- context|post|hashtag|question
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)

generated_content (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL,           -- post|reply|comment
  prompt_used TEXT,
  output TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)
```
- On project creation: optional memory upload (context, tone, sample posts, keywords) → stored in `project_memory`.
- Generation calls (post/reply/comment) read all `project_memory` rows for that project as context, call the AI API, log result to `generated_content`.
- Memory is additive — user can append more at any time, not just at creation.
- Gate generation behind the existing `credits` system (one credit = one generation call, or per-token cost — reuse `credit_transactions` for the ledger).
- Recommended (not required) safety step: a review/approve queue before anything is auto-posted externally, so a bad generation doesn't go out unreviewed.

---

## 10. Free Tier / Subscription Gating

Uses existing `subscriptions.plan` + `credits` + `plugins.enabled` pattern — extend, don't replace.

**[CONFIGURABLE]** — gating limits should live in a `plan_limits` table, not hardcoded constants:
```sql
plan_limits (
  id SERIAL PRIMARY KEY,
  plan TEXT NOT NULL,            -- free|paid
  feature_key TEXT NOT NULL,     -- e.g. "max_entities", "ai_generations_per_month"
  limit_value INTEGER            -- NULL = unlimited
)
```
Suggested starting limits (adjust via the table above, not by editing code):

| Feature | Free | Paid |
|---|---|---|
| Entities | 5 | unlimited |
| Project enrollments per category | limited | unlimited |
| AI content generations / month | small credit allotment | larger/unlimited |
| Bulk actions | disabled or small batch cap | full |
| Custom category templates (create) | view-only | can create |
| Health-rule customization | basic flags only | configurable thresholds |
| Real-time wallet sync | throttled | real-time |

Enforce at the **backend middleware** level (check plan before the route handler runs), not just hidden in the UI.

---

## 11. Real-Time Conversion: Gas Price & Telemetry

### Gas price (`artifacts/api-server/src/routes/tools.ts`)
Current state: Ethereum is real (Etherscan oracle + llamarpc fallback). The other 23 networks use `n.baseGas * scaleFactor * variation` with `Math.random()` — this is the part to replace.

Fix plan:
1. **[CONFIGURABLE]** Move the `NETWORKS` array (currently hardcoded in `tools.ts`) into a `networks` DB table: `name, network_id, chain, symbol, coingecko_id, rpc_url, gas_oracle_url, enabled`. Adding a new chain becomes an admin action, not a code change.
2. For each EVM network with an `rpc_url` set, fetch real gas the same way Ethereum already does it: `eth_gasPrice` JSON-RPC call (pattern already exists in `fetchEthGwei`'s fallback — generalize it to take any RPC URL). Use a public RPC per chain (e.g. Polygon: `polygon-rpc.com`, BSC: `bsc-dataseed.binance.org`, Arbitrum: `arb1.arbitrum.io/rpc`, etc.) or a paid provider (Alchemy/Infura) if uptime needs to be higher than public RPCs.
3. Remove `Math.random()` entirely from `buildGasData()`. Keep the existing 30s cache (`GAS_TTL`) — that part is fine, it's just rate-limiting, not faking data.
4. Where a chain has no reliable public RPC/oracle, mark `source: "unavailable"` and show "—" in the UI rather than inventing a number.
5. Keep the existing Coingecko price-fetching as is — that part is already real.

### Telemetry (`artifacts/api-server/src/routes/telemetry.ts`)
Current state: `FUNCTION_REGISTRY` is a hardcoded array; `callCount24h/7d`, `errorRate`, `avgLatencyMs` are `Math.random()`; `/telemetry/errors` returns a hardcoded synthetic array instead of reading `error_logs`.

Fix plan:
1. Add a lightweight request-logging **middleware** (mounted once in `app.ts`, before routes) that records, per request: route pattern, method, status code, duration. Write to a new table:
```sql
request_metrics (
  id SERIAL PRIMARY KEY,
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms REAL NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)
```
2. `GET /telemetry/functions` should compute `callCount24h/7d`, `errorRate`, `avgLatencyMs` from real `request_metrics` rows grouped by route (`WHERE created_at > now() - interval '24 hours'`), not `Math.random()`.
3. `GET /telemetry/errors` should query the existing `error_logs` table directly (it already exists in the schema — it's just not being read from). Wire the existing `errors-handler.ts` middleware to actually `INSERT INTO error_logs` on every 4xx/5xx instead of (or in addition to) whatever it currently does.
4. **[CONFIGURABLE]** `FUNCTION_REGISTRY`'s static list can stay as a route inventory (useful for showing "not-wired" endpoints), but its dynamic stats (`callCount`, `errorRate`, `avgLatencyMs`) must always come from `request_metrics`, never be invented.
5. For routes with zero real traffic, show `0` / `—`, not a fake nonzero number — an empty real metric is more useful than a populated fake one.

---

## 12. Team Features

Goal: the platform stays single-system, but a group of users can share one workspace ("Team") — shared Vault visibility, shared Project visibility, a team chat, and a Team Leader role that manages the team (not the platform).

### Important distinction — do not conflate these two roles
- **Platform Admin**: the only role that can create Projects/Tasks platform-wide (see Permission Rule below). Unaffected by teams.
- **Team Leader**: scoped only to their own team — manages members, shared-resource visibility, and team settings. A Team Leader is still a regular platform "user" and still cannot create platform Projects/Tasks just by being a leader.

### Schema
```sql
teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),   -- the leader
  created_at TIMESTAMP NOT NULL DEFAULT now()
)

team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',   -- leader|member
  joined_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
)

team_messages (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)
```
- `vault_entries` and `projects` need a nullable `team_id` so a resource can be owned by an individual user (`team_id IS NULL`) or shared with a team (`team_id` set). Visibility rule: a team member can see any `vault_entries`/`projects` row where `team_id` matches a team they belong to.

### Team sidebar
- **Vault**: same Vault hub as §8, scoped to `team_id` — shows entries shared to the team by any member.
- **Project**: same Project view as §2, scoped to `team_id`.
- **Overview**: team-level stat cards — combined ROI/progress across all team-shared projects and entities, member count, activity feed.
- **Chat**: simple message list + input, backed by `team_messages`. Reuse the existing `use-realtime.ts` hook / SSE pattern (already used elsewhere in the app) for live updates instead of building a new transport.
- **Settings** (Team Leader only): rename team, invite/remove members, promote/demote member↔leader, toggle which resource types are shared by default.

### Permission Rule (apply globally, not just in Team module)
**Users cannot create Projects or Tasks. Only platform Admin can.**
This is a fix to an existing gap, not just a new feature — see §14 Bug Audit, item B2: `POST /projects` and `POST /tasks` currently have **no role check at all**. Add a `requireAdmin` middleware and apply it to both routes (and any other admin-only write route missing the same check — audit all `POST/PATCH/DELETE` handlers in `projects.ts` and `tasks.ts`).

---

## 13. UI Design System ("Skinprint") — Master Aesthetic

Baseline already established in `replit.md`: dark terminal theme, cyan/violet accents. This section formalizes it into a reusable, advanced-but-minimal system rather than per-page improvisation.

### Principles
- **Minimal surface, advanced depth**: flat dark backgrounds, sparse borders (1px, low-opacity), no heavy drop shadows — depth comes from subtle elevation (slightly lighter panel background) not shadow blur.
- **One accent pair, used consistently**: cyan = primary/active/positive, violet = secondary/highlight. No new colors introduced ad hoc per page — every new component should pick from the existing token set.
- **Typography scale fixed, not per-component**: a single defined scale (e.g. 12/14/16/20/24/32px) reused everywhere; numbers/stats get a monospace font for that "terminal" data feel, body text stays a standard sans.
- **Motion is functional, not decorative**: transitions communicate state change (loading, success, error) — no animation that exists purely for flourish. Keep durations short (150–250ms).
- **Density over whitespace-for-its-own-sake**: this is an operator dashboard (airdrop farming control center), not a marketing site — favor compact tables/cards that show more data per screen, but keep consistent padding tokens so "compact" doesn't become "cluttered."

### Concrete deliverables
1. A single `design-tokens.css` (or Tailwind theme extension) — colors, spacing scale, radius scale, font sizes — referenced everywhere instead of one-off hex codes/px values in components.
2. Component audit: ensure `components/ui/*` (existing shadcn-based primitives) are the only source of buttons/inputs/dialogs — no inline-styled one-off buttons in feature components.
3. A documented state-pattern for empty/loading/error states (skeleton style, icon style, copy tone) so every new module (Team, Vault hub, etc.) looks like it belongs to the same product instead of each being styled independently.
4. Icon set discipline: stick to `lucide-react` (already used) — no mixing icon libraries.

---

## 14. Bug & Security Audit (found while reading the live codebase)

| ID | Area | Issue | Why it matters |
|---|---|---|---|
| **B1** | All API routes | Every route's `getUserId()`/auth-extraction helper (duplicated in ~10+ files: `projects.ts`, `tasks.ts`, `local-accounts.ts`, `email-accounts.ts`, `subscriptions.ts`, `ai.ts`, `ai-actions.ts`, `support.ts`, `events.ts`, etc.) **silently falls back to `userId = 1`** when no `Authorization` header is present or the token fails to parse. There is no real auth-enforcement middleware. | This means the API is effectively callable without authentication and acts as user 1 by default — a critical access-control gap, not just a style issue. |
| **B2** | `projects.ts`, `tasks.ts` | `POST /projects` and `POST /tasks` have **zero role/permission check**. Any caller (including the unauthenticated-defaults-to-user-1 case above) can create projects/tasks today. | Directly contradicts the "only Admin creates Projects/Tasks" rule — this isn't a future feature, it's a present bug. |
| **B3** | 11 route files (`tasks.ts`, `projects.ts`, `local-accounts.ts`, `vault.ts`, `auth.ts`, `subscriptions.ts`, `history.ts`, `earn-links.ts`, `ai-actions.ts`, `messages.ts`, `referrals.ts`) | Heavy use of `sql.raw()` with manual string interpolation (some with a hand-rolled `safe()` quote-escaping helper, some without). | Manual escaping is fragile — one missed field and it's a SQL-injection hole. Should move to Drizzle's parameterized query builder or tagged `sql` templates with bound parameters, not string concatenation. |
| **B4** | `local_accounts` table | Defined and queried only via raw SQL in the route file — **not declared anywhere in `lib/db/src/schema/`**. | No Drizzle type-safety, no migration tracking through the normal schema pipeline — risk of schema drift between environments. |
| **B5** | `vault_entries` | Most credential fields (`twitterPassword`, `discordPassword`, etc.) and the planned `encrypted_seed_phrase` (§8) are stored as plain `text` columns with no application-level encryption — confirmed already in `replit.md`'s own architecture notes. | Not new news, but worth keeping in this audit since the Wallet module (§8) is adding a seed phrase field to the same table — encrypt before that ships, not after. |
| **B6** | `telemetry.ts` | `/telemetry/errors` returns a **hardcoded synthetic array** regardless of what's actually in `error_logs` — looks live, isn't. | Covered in detail in §11, listed here because it's a correctness bug, not just a "simulated data" nice-to-have. |
| **B7** | `tools.ts` | 23 of 24 networks' gas prices include a `Math.random()` term — output changes every cache cycle even with no real network change. | Same as above — covered in §11, flagged here as a data-integrity bug since it could mislead a user about real gas conditions. |

---

## 15. Not-Wired Inventory (expanded)

The existing `FUNCTION_REGISTRY` in `telemetry.ts` already self-reports these as `"not-wired"`:
- `telegramWebhook` — `/api/telegram/webhook`
- `walletNFTAnalysis` — `/api/tools/wallet/nft`
- `walletDeFiAnalysis` — `/api/tools/wallet/defi`
- `exportUserData` — `/api/users/export`
- `bulkBan` — `/api/users/bulk-ban`

**Everything specified in this document that doesn't exist yet should be added to that same registry as `"not-wired"` until it's actually built**, so the telemetry dashboard stays an honest source of truth as features ship one at a time:
- `entity-project-roi` endpoints (§4)
- `categories` / `category_templates` CRUD (§5)
- `health_rules` CRUD + entity health evaluation endpoint (§6)
- Bulk-action endpoints for Local/Entity/Wallet/Projects (§7)
- Wallet seed-phrase reveal/connect endpoints (§8)
- 2FA "Other" manual CRUD (§8)
- `email_accounts` source-linking (§8)
- `project_memory` + `generated_content` endpoints (§9)
- `plan_limits` CRUD + plan-gating middleware (§10)
- Per-network real gas RPC calls + `networks` table CRUD (§11)
- `request_metrics`-backed telemetry (§11)
- Plugin upload/register/unregister endpoints (§1)
- Team endpoints: teams, members, messages, settings (§12)
- `requireAdmin` middleware itself (§12/B2) — doesn't exist yet anywhere in `middlewares/`

---

## 16. Implementation Phases (suggested order)

0. **Critical security fixes — do this before anything else, regardless of feature priority**: B1 (real `requireAuth` middleware, remove the silent `userId ?? 1` fallback everywhere) and B2 (`requireAdmin` middleware, applied to `POST/PATCH/DELETE /projects` and `/tasks`). Every other phase below assumes these exist, since Team sharing, plan gating, and admin-only project/task creation all depend on auth actually being enforced.
1. **Foundation**: `categories` + `category_templates` tables (§5) — everything else (project types, local account categories, health rules) reads from this, so it should exist first.
2. **Data integrity**: `entity_project_roi` (§4), entity `status`/`last_activity_at` + `health_rules` (§6).
3. **Vault hub**: Wallet seed-phrase field + encryption (also fixes B5), 2FA aggregation tabs, Mail linking (§8).
4. **Real-time fixes**: Gas price networks table + real RPC calls, telemetry real metrics (§11) — also fixes B6/B7, high value, contained scope, no dependency on other modules.
5. **Bulk actions** (§7) — mechanical, can be done in parallel with anything above.
6. **Team features** (§12) — depends on Phase 0 auth being real (team visibility rules are meaningless without real per-user auth) and on Vault/Project modules already existing to be scoped by `team_id`.
7. **Content tab / AI generation** (§9) — depends on credits system being wired to it.
8. **Free tier gating** (§10) — apply once the features it gates actually exist.
9. **Plugin system** (§1) — highest complexity and the only item with a real security design requirement; do this last once the "shape" of the app's modules is stable, so the plugin manifest's `mountPoint` options are settled.
10. **Ongoing, not a phase**: raw-SQL → parameterized-query migration (B3) and `local_accounts` Drizzle-schema migration (B4) should happen incrementally as each touched route is worked on in the phases above, not as one separate big-bang rewrite.

> Also update the UI Design System (§13) tokens once, early — ideally during Phase 1 — so every module built afterward (Team, Vault hub, etc.) is styled consistently from the start instead of needing a visual pass at the end.
