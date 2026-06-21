---
name: AYZEN DB Schema Migration
description: What to do when DATABASE_URL points to a different Supabase project with wrong schema
---

## Rule
The AYZEN app expects these tables with **integer serial** primary keys:
- `users` (id serial, username, email, password_hash, role, ...)
- `projects` (id serial, name, twitter_handle, discord_url, website_url, tutorial_link, experience_level, tier, funding_amount, reward_estimate, thumbnail_url, total_roi_distributed, created_at)
- `tasks` (id serial, project_id int, name, description, reward_amount, verification_type, task_type, completion_count, created_at)
- `user_projects` (id serial, user_id int, project_id int, joined_at)
- `project_enrollments` (id serial, user_id int, project_id int, vault_entry_id int, status, enrolled_at)
- `task_submissions` (id serial, task_id int, user_id int, status, proof_url, notes, rejection_reason, submitted_at, reviewed_at)
- `vault_entries` (id serial, user_id int, entity_serial, category, project_name, email, ..., wallet_addresses, backup_codes, notes, created_at, updated_at)

**Why:** When a user sets a new DATABASE_URL pointing to a different Supabase project, the existing tables may use UUID ids (incompatible with Drizzle integer serial schema), have wrong column names, or have completely different schemas from another app. Drizzle's error will be "column X does not exist" (revealed via `.cause.message`).

**How to apply:**
1. Check actual column types: `SELECT column_name, udt_name FROM information_schema.columns WHERE table_name='projects'`
2. If UUIDs or wrong columns: DROP and recreate the conflicting tables (projects, tasks, users, user_projects, project_enrollments, task_submissions) keeping vault_entries if compatible
3. After recreating, insert admin user: `INSERT INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@ayzen.io', '<sha256(admin123+ayzen_salt)>', 'admin')`
4. SHA-256 hash of "admin123" + "ayzen_salt" = `a131f76f4724fbaf633d392f345a09fa12eb86be07564e9ff3ffc476b03ad05c`
