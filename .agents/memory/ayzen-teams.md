---
name: AYZEN Teams Mega Feature
description: Teams approval flow, invite system, team_missions/reward_links/ad_tasks tables, route ordering, developer sidebar, AI fallback chain
---

## Teams Status Flow
- `teams.status` = 'pending' (new default, needs admin approval) | 'active' | 'rejected'
- `team_members.status` = 'active' (leader on creation) | 'pending' (pending invite) 
- Admin approves via PATCH /admin/teams/:id → { status: 'active' }
- Existing teams (before migration) default to 'active' (ALTER TABLE DEFAULT 'active')

## Route Order: CRITICAL
GET /teams/my-invites MUST be registered BEFORE GET /teams/:id or Express matches id="my-invites".
Same pattern as /tasks/submissions before /tasks/:id (documented in replit.md gotchas).

## New Tables Added (startup migrations)
- team_missions(id, team_id, title, description, status, target_value, current_value, reward_amount, deadline, created_by, created_at, updated_at)
- reward_links(id, title, description, url, reward_amount, is_published, view_duration_seconds, max_completions, created_by, created_at)
- link_completions(id, user_id, link_id, completed_at) UNIQUE(user_id, link_id)
- ad_tasks(id, title, description, ad_url, ad_image_url, reward_amount, view_duration_seconds, is_active, created_at)
- ad_completions(id, user_id, ad_task_id, completed_at) UNIQUE(user_id, ad_task_id)

## New Routes (registered in routes/index.ts)
- artifacts/api-server/src/routes/reward-links.ts: GET/POST /reward-links, GET/POST/PATCH/DELETE /admin/reward-links, POST /reward-links/:id/complete
- artifacts/api-server/src/routes/ad-tasks.ts: GET /ad-tasks, GET/POST/PATCH/DELETE /admin/ad-tasks, POST /ad-tasks/:id/complete

## Teams Page Tabs (user/teams.tsx)
Tabs: dashboard | members | vault | missions | leaderboard | projects | chat | panel(leader only)
- vault: team members' shared vault entries (GET /teams/:id/vault)
- missions: team goals with progress bars + leader can create/edit
- panel: replaces "settings", has team info edit + member invite with pending flow

## Developer Page
Converted from horizontal Tabs to left sidebar layout with 7 sections:
AI Assistant | Live Console | AI Models | Telemetry | Ping Test | Functions | Error Log
testModel() now stores results in state map (not alert()) — shows inline below table row.

## AI Fallback Chain
1. GROQ_API_KEY → Groq (fast, free)
2. OPENROUTER_API_KEY → OpenRouter (meta-llama free)
3. AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL → Replit AI (gpt-5-mini)
model param: max_completion_tokens (not max_tokens) for OpenAI integration.

## Wallet SSE Auto-Reconnect
Uses exponential backoff (2^retryCount * 1000ms, max 30s) with mounted flag to prevent reconnect after unmount.
Pattern: `let mounted = true; const connect = () => { if (!mounted) return; ... es.onerror = () => { if (mounted) setTimeout(connect, delay) } }; return () => { mounted = false; }`

## Completion Reward Pattern (reward_links + ad_tasks)
Insert into credits table on completion: (user_id, amount, azn_amount, source, description)
Also UPDATE users SET total_roi = total_roi + amount.
Both use UNIQUE constraint to prevent double-completion.
