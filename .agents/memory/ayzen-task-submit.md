---
name: AYZEN Task Submit Modal
description: Full multilayer task submit UI — location, tab structure, and Cost/ROI category constants
---

## Rule
`TaskSubmitDialog` in `project-detail.tsx` uses a full inline multilayer modal (not shadcn Dialog) with 5 tabs: Guide (shown only when task has steps), Details, Cost/ROI, Points, Settings.

**Why:** The simple 2-field Dialog was replaced with parity to the SubmitModal in tasks.tsx. Both UIs share the same API: POST /api/tasks/:id/submit with { proofUrl, notes, costEntries, entityIds }.

## How to apply
- `COST_CATEGORIES` / `PROFIT_CATEGORIES` constants are defined at the top of project-detail.tsx (alongside `CostEntry` interface and `newCostEntry` helper).
- `SubmitTab` type includes `"guide" | "details" | "cost-roi" | "points" | "settings"`.
- Guide tab only shows when `task.steps` (array) is non-empty.
- `confetti` fires on successful submit (canvas-confetti already in package.json).
- Task interface in project-detail.tsx now includes: `steps`, `xpAmount`, `projectName`, `taskLink`.

## Backend
- `POST /tasks` and `PATCH /tasks/:id` handle: priority, difficultyLevel, estimatedCost, estimatedProfit.
- DB columns added via Phase 14 migration: `difficulty_level TEXT DEFAULT 'medium'`, `estimated_cost REAL DEFAULT 0`, `estimated_profit REAL DEFAULT 0`.
- `formatTask()` returns all new fields.
