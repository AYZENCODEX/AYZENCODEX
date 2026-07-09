---
name: AYZEN Role System
description: All 5 roles, their demo accounts, sidebar nav constants, and routing rules.
---

# AYZEN Role System

## Roles & demo email accounts
| Role | Demo Email | Redirect after login |
|------|-----------|---------------------|
| admin | demoadmin@ayzen.io | /admin/dashboard |
| dev | demodev@ayzen.io | /admin/developer |
| moderator | demomod@ayzen.io | /dashboard |
| teamleader | demoteam@ayzen.io | /teams |
| user | demo@ayzen.io | /home |

Demo password is the same for all accounts (not stored here — see replit.md Demo Accounts table).

## Demo account seeding
All 5 demo accounts are seeded in the MIGRATIONS array in `artifacts/api-server/src/index.ts` using `INSERT … WHERE NOT EXISTS` so they are idempotent on any fresh database.
The hash in the INSERT is SHA-256 of (password + "ayzen_salt") — same algorithm as `hashPassword()` in `artifacts/api-server/src/routes/auth.ts`.

**Why:** Pre-computed static hash in SQL avoids requiring the pgcrypto extension.

## Sidebar nav constants (app-sidebar.tsx)
- ADMIN_NAV → admin role
- DEV_NAV → dev role (AI Agent group: Assistant / Agent / Model / Skill / Settings)
- MODERATOR_NAV → moderator role (user features only, NO vault, NO marketplace)
- TEAM_LEADER_NAV → teamleader role (full user features + Team Overview / Progress / Finance / Panel groups)
- USER_NAV → user role (default)

Selection logic: `isAdmin ? ADMIN_NAV : isDev ? DEV_NAV : isModerator ? MODERATOR_NAV : isTeamLeader ? TEAM_LEADER_NAV : USER_NAV`

## Auth context flags (use-auth.tsx)
isAdmin, isDev, isModerator, isTeamLeader — all derived from user.role string.

## Login page
4 init buttons in 2×2 grid under "Demo Override": Admin Init, Developer Init, Moderator Init, Team Leader Init.
