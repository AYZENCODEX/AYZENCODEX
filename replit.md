# AYZEN — Crypto Airdrop Command Center

A full-stack Crypto Airdrop & Task Management Platform with Admin and User roles. Operators track airdrop projects, complete tasks for ROI, analyze wallets across 20+ blockchains, and store credentials in an encrypted vault.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/ayzen run dev` — run the frontend (port 23325)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Demo Accounts

| Role  | Email                  | Password      |
|-------|------------------------|---------------|
| Admin | support@ayzen.tech     | 1234578@Ba1   |
| User  | user@ayzen.io          | demo123       |

Or use the "Admin Init" / "User Init" quick-login buttons on the login page (they call the real API, not a mock).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (dark terminal theme, cyan/violet accents)
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Charts: Recharts
- Routing: Wouter
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI source of truth (50+ endpoints)
- `lib/db/src/schema/` — Drizzle schema (users, projects, tasks, vault, broadcasts, settings)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Generated Zod schemas for server validation
- `artifacts/api-server/src/routes/` — Express route handlers by domain
- `artifacts/ayzen/src/` — React frontend (pages, components, auth context)

## Architecture decisions

- **Mock auth with localStorage**: Auth tokens are base64-encoded JSON payloads (not real JWTs). Password hashing uses SHA-256 + static salt. Suitable for demo; swap for proper JWT + bcrypt before production.
- **Wallet analysis is simulated**: Gas prices and wallet metrics return randomized realistic data since external blockchain APIs require API keys. Wire up Alchemy/Infura for real data.
- **Vault storage**: Wallet addresses and backup codes are JSON-stringified in text columns (not AES-256 encrypted server-side). Add real encryption before storing sensitive data.
- **Telemetry is synthetic**: Error logs and function call counts are simulated. The function registry is a hardcoded list matching all registered routes.
- **Settings table**: Single-row table pattern (INSERT on first request, UPDATE thereafter).

## Product

- **Admin**: Global dashboard with ROI + activity charts, user management, project/task CRUD, gas tracker (20+ networks), wallet analysis, streak/spam tools, broadcast system, leaderboard, developer telemetry panel
- **User**: Personal dashboard, project browser + join flow, task center with submission, encrypted vault, leaderboard, broadcast inbox

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` before touching route files — schema names like `ListUsersQueryParams`, `CreateProjectBody` come from Orval.
- Tasks submissions route `/tasks/submissions` must be registered BEFORE `/tasks/:id` in Express or it matches as `id = "submissions"`.
- The `tasks` route for submissions is at GET `/tasks/submissions` (no id param) — register it before the `/:id` routes.
- Vault entries store arrays as JSON strings in text columns — parse on read, stringify on write.
- DB schema push: `pnpm --filter @workspace/db run push`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
