import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { broadcastToUser } from "./events";

const router = Router();

// ── GET /teams — list user's teams ────────────────────────────────────────────
router.get("/teams", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const result = await db.execute(sql.raw(
    `SELECT t.*, tm.role as member_role,
       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ${userId}
     ORDER BY t.created_at DESC`
  ));
  res.json(result.rows);
});

// ── POST /teams — request a team (pending until admin approves) ───────────────
router.post("/teams", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { name, description } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const teamName = String(name).trim();
  const teamDesc = description ? String(description).trim() : null;
  try {
    const result = await db.execute(sql`
      INSERT INTO teams (name, description, owner_id, status)
      VALUES (${teamName}, ${teamDesc}, ${userId}, 'pending')
      RETURNING *
    `);
    const team = result.rows[0] as any;
    if (!team?.id) { res.status(500).json({ error: "Team creation failed" }); return; }
    await db.execute(sql`
      INSERT INTO team_members (team_id, user_id, role, status)
      VALUES (${team.id}, ${userId}, 'leader', 'active')
      ON CONFLICT (team_id, user_id) DO NOTHING
    `);
    // Notify all admins
    try {
      const admins = await db.execute(sql`SELECT id FROM users WHERE role = 'admin' LIMIT 20`);
      for (const admin of admins.rows as any[]) {
        await db.execute(sql`
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES (${admin.id}, 'team_request', 'New Team Request',
            ${'User #' + userId + ' requested to create team: ' + teamName},
            ${JSON.stringify({ teamId: team.id, ownerId: userId })})
        `);
      }
      broadcastToUser(-1, "team_request", { teamId: team.id, teamName, ownerId: userId });
    } catch { /* notification errors non-fatal */ }
    res.status(201).json(team);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create team", detail: err?.message });
  }
});

// ── GET /teams/my-invites — pending invites for current user (MUST be before /:id) ──
router.get("/teams/my-invites", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const result = await db.execute(sql.raw(
    `SELECT tm.id, tm.team_id, tm.role, tm.created_at as invited_at,
       t.name as team_name, t.description as team_description,
       u.username as invited_by_username
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     LEFT JOIN users u ON u.id = t.owner_id
     WHERE tm.user_id = ${userId} AND tm.status = 'pending'
     ORDER BY tm.created_at DESC`
  ));
  res.json(result.rows);
});

// ── GET /teams/:id — get team detail ─────────────────────────────────────────
router.get("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  const [teamResult, membersResult] = await Promise.all([
    db.execute(sql.raw(`SELECT * FROM teams WHERE id = ${teamId}`)),
    db.execute(sql.raw(
      `SELECT tm.*, u.username, u.avatar_url, u.email, u.total_roi, u.streak FROM team_members tm
       JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ${teamId} ORDER BY tm.joined_at ASC`
    )),
  ]);
  if (!teamResult.rows.length) { res.status(404).json({ error: "Team not found" }); return; }
  res.json({ ...teamResult.rows[0], members: membersResult.rows, myRole: (memberCheck.rows[0] as any).role });
});

// ── GET /teams/:id/stats — get team stats ────────────────────────────────────
router.get("/teams/:id/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }

  const [memberCount, msgCount, projectCount, totalRoi, recentActivity] = await Promise.all([
    db.execute(sql.raw(`SELECT COUNT(*) as count FROM team_members WHERE team_id = ${teamId}`)),
    db.execute(sql.raw(`SELECT COUNT(*) as count FROM team_messages WHERE team_id = ${teamId}`)),
    db.execute(sql.raw(`SELECT COUNT(*) as count FROM projects WHERE team_id = ${teamId}`)),
    db.execute(sql.raw(
      `SELECT COALESCE(SUM(u.total_roi), 0) as total FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ${teamId}`
    )),
    db.execute(sql.raw(
      `SELECT tm.id, tm.created_at as joined_at, u.username FROM team_messages tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ${teamId} ORDER BY tm.created_at DESC LIMIT 5`
    )),
  ]);

  res.json({
    memberCount: parseInt((memberCount.rows[0] as any).count, 10),
    messageCount: parseInt((msgCount.rows[0] as any).count, 10),
    projectCount: parseInt((projectCount.rows[0] as any).count, 10),
    totalRoi: parseFloat((totalRoi.rows[0] as any).total) || 0,
    recentActivity: recentActivity.rows,
  });
});

// ── GET /teams/:id/leaderboard — team member leaderboard ─────────────────────
router.get("/teams/:id/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }

  const result = await db.execute(sql.raw(
    `SELECT tm.user_id, tm.role, tm.joined_at,
       u.username, u.avatar_url, u.total_roi, u.streak,
       COALESCE((SELECT SUM(azn_amount) FROM credits WHERE user_id = u.id), 0) as azn_balance,
       COALESCE((SELECT COUNT(*) FROM task_submissions ts WHERE ts.user_id = u.id AND ts.status = 'approved'), 0) as tasks_completed,
       COALESCE((SELECT COUNT(*) FROM team_messages msg WHERE msg.team_id = ${teamId} AND msg.user_id = u.id), 0) as messages_sent
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ${teamId}
     ORDER BY u.total_roi DESC`
  ));

  const ranked = (result.rows as any[]).map((r, i) => ({ ...r, rank: i + 1 }));
  res.json(ranked);
});

// ── GET /teams/:id/projects — team projects ───────────────────────────────────
router.get("/teams/:id/projects", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }

  const result = await db.execute(sql.raw(
    `SELECT p.*, 
       (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
       (SELECT COUNT(*) FROM user_projects WHERE project_id = p.id) as participant_count
     FROM projects p WHERE p.team_id = ${teamId} ORDER BY p.created_at DESC LIMIT 20`
  ));
  res.json(result.rows);
});

// ── PATCH /teams/:id — update team (leader only) ──────────────────────────────
router.patch("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  const role = (memberCheck.rows[0] as any)?.role;
  if (!role || role !== "leader") { res.status(403).json({ error: "Only team leader can update" }); return; }
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const result = await db.execute(sql.raw(
    `UPDATE teams SET name = '${name.replace(/'/g, "''")}' WHERE id = ${teamId} RETURNING *`
  ));
  res.json(result.rows[0]);
});

// ── DELETE /teams/:id — disband team (leader only) ────────────────────────────
router.delete("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const teamResult = await db.execute(sql.raw(`SELECT owner_id FROM teams WHERE id = ${teamId}`));
  const team = teamResult.rows[0] as any;
  if (!team || team.owner_id !== userId) { res.status(403).json({ error: "Only team owner can disband" }); return; }
  await db.execute(sql.raw(`DELETE FROM team_messages WHERE team_id = ${teamId}`));
  await db.execute(sql.raw(`DELETE FROM team_members WHERE team_id = ${teamId}`));
  await db.execute(sql.raw(`DELETE FROM teams WHERE id = ${teamId}`));
  res.json({ ok: true });
});

// ── POST /teams/:id/invite — invite member ────────────────────────────────────
router.post("/teams/:id/invite", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  if ((memberCheck.rows[0] as any)?.role !== "leader") { res.status(403).json({ error: "Only leader can invite" }); return; }
  const { username } = req.body;
  if (!username) { res.status(400).json({ error: "username is required" }); return; }
  const userResult = await db.execute(sql.raw(`SELECT id FROM users WHERE username = '${username.replace(/'/g, "''")}' OR email = '${username.replace(/'/g, "''")}' LIMIT 1`));
  if (!userResult.rows.length) { res.status(404).json({ error: "User not found" }); return; }
  const inviteeId = (userResult.rows[0] as any).id;
  try {
    await db.execute(sql.raw(`INSERT INTO team_members (team_id, user_id, role) VALUES (${teamId}, ${inviteeId}, 'member')`));
    broadcastToUser(inviteeId, "team_invite", { teamId });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: "User already in team" });
  }
});

// ── DELETE /teams/:id/members/:userId — remove member ────────────────────────
router.delete("/teams/:id/members/:memberId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberId = parseInt(Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  const myRole = (memberCheck.rows[0] as any)?.role;
  if (myRole !== "leader" && userId !== memberId) { res.status(403).json({ error: "Not allowed" }); return; }
  await db.execute(sql.raw(`DELETE FROM team_members WHERE team_id = ${teamId} AND user_id = ${memberId}`));
  res.json({ ok: true });
});

// ── PATCH /teams/:id/members/:memberId/role — promote/demote ─────────────────
router.patch("/teams/:id/members/:memberId/role", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberId = parseInt(Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId, 10);
  const { role } = req.body;
  if (!["leader", "member"].includes(role)) { res.status(400).json({ error: "role must be leader or member" }); return; }
  const leaderCheck = await db.execute(sql.raw(`SELECT owner_id FROM teams WHERE id = ${teamId}`));
  if ((leaderCheck.rows[0] as any)?.owner_id !== userId) { res.status(403).json({ error: "Only owner can change roles" }); return; }
  await db.execute(sql.raw(`UPDATE team_members SET role = '${role}' WHERE team_id = ${teamId} AND user_id = ${memberId}`));
  res.json({ ok: true });
});

// ── GET /teams/:id/messages — get chat messages ───────────────────────────────
router.get("/teams/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { limit = "50", before } = req.query as Record<string, string>;
  const memberCheck = await db.execute(sql.raw(
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  let query = `SELECT tm.*, u.username, u.avatar_url FROM team_messages tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ${teamId}`;
  if (before) query += ` AND tm.id < ${parseInt(before, 10)}`;
  query += ` ORDER BY tm.created_at DESC LIMIT ${Math.min(parseInt(limit, 10), 100)}`;
  const result = await db.execute(sql.raw(query));
  res.json((result.rows as any[]).reverse());
});

// ── POST /teams/:id/messages — send message ───────────────────────────────────
router.post("/teams/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { message } = req.body;
  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }
  const memberCheck = await db.execute(sql.raw(
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId} AND status = 'active'`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  const result = await db.execute(sql.raw(
    `INSERT INTO team_messages (team_id, user_id, message) VALUES (${teamId}, ${userId}, '${message.replace(/'/g, "''")}') RETURNING *`
  ));
  res.status(201).json(result.rows[0]);
});

// ── GET /teams/:id/vault — team members' vault entries ────────────────────────
router.get("/teams/:id/vault", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId} AND status = 'active'`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  const result = await db.execute(sql.raw(
    `SELECT ve.id, ve.project_name, ve.category, ve.email, ve.twitter_username, ve.discord_username,
       ve.telegram_username, ve.entity_serial, ve.created_at, ve.user_id,
       u.username, u.avatar_url
     FROM vault_entries ve
     JOIN users u ON u.id = ve.user_id
     JOIN team_members tm ON tm.team_id = ${teamId} AND tm.user_id = ve.user_id AND tm.status = 'active'
     ORDER BY ve.created_at DESC LIMIT 100`
  ));
  res.json(result.rows);
});

// ── GET /teams/:id/missions ───────────────────────────────────────────────────
router.get("/teams/:id/missions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId} AND status = 'active'`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  const result = await db.execute(sql.raw(
    `SELECT m.*, u.username as created_by_username FROM team_missions m
     LEFT JOIN users u ON u.id = m.created_by
     WHERE m.team_id = ${teamId} ORDER BY m.created_at DESC`
  ));
  res.json(result.rows);
});

// ── POST /teams/:id/missions — create mission (leader only) ──────────────────
router.post("/teams/:id/missions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId} AND status = 'active'`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  const { title, description, target_value, reward_amount, deadline } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  const deadlineVal = deadline ? `'${deadline}'` : "NULL";
  const result = await db.execute(sql.raw(
    `INSERT INTO team_missions (team_id, title, description, target_value, reward_amount, deadline, created_by)
     VALUES (${teamId}, '${title.replace(/'/g, "''")}', ${description ? `'${description.replace(/'/g, "''")}'` : "NULL"},
       ${parseInt(target_value ?? "100", 10)}, ${parseFloat(reward_amount ?? "0")}, ${deadlineVal}, ${userId})
     RETURNING *`
  ));
  res.status(201).json(result.rows[0]);
});

// ── PATCH /teams/:id/missions/:missionId — update mission ────────────────────
router.patch("/teams/:id/missions/:missionId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const missionId = parseInt(Array.isArray(req.params.missionId) ? req.params.missionId[0] : req.params.missionId, 10);
  const memberCheck = await db.execute(sql.raw(
    `SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId} AND status = 'active'`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  const { title, description, status, target_value, current_value, reward_amount, deadline } = req.body;
  const sets: string[] = [];
  if (title !== undefined) sets.push(`title = '${title.replace(/'/g, "''")}'`);
  if (description !== undefined) sets.push(`description = '${description.replace(/'/g, "''")}'`);
  if (status !== undefined) sets.push(`status = '${status}'`);
  if (target_value !== undefined) sets.push(`target_value = ${parseInt(target_value, 10)}`);
  if (current_value !== undefined) sets.push(`current_value = ${parseInt(current_value, 10)}`);
  if (reward_amount !== undefined) sets.push(`reward_amount = ${parseFloat(reward_amount)}`);
  if (deadline !== undefined) sets.push(`deadline = '${deadline}'`);
  if (!sets.length) { res.status(400).json({ error: "Nothing to update" }); return; }
  sets.push("updated_at = CURRENT_TIMESTAMP");
  const result = await db.execute(sql.raw(
    `UPDATE team_missions SET ${sets.join(", ")} WHERE id = ${missionId} AND team_id = ${teamId} RETURNING *`
  ));
  res.json(result.rows[0]);
});

// ── PATCH /teams/:id/invites/respond — accept or reject invite ────────────────
router.patch("/teams/:id/invites/respond", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { action } = req.body;
  if (!["accept", "reject"].includes(action)) { res.status(400).json({ error: "action must be accept or reject" }); return; }
  if (action === "reject") {
    await db.execute(sql.raw(`DELETE FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId} AND status = 'pending'`));
    res.json({ ok: true, action: "rejected" });
    return;
  }
  await db.execute(sql.raw(
    `UPDATE team_members SET status = 'active' WHERE team_id = ${teamId} AND user_id = ${userId} AND status = 'pending'`
  ));
  res.json({ ok: true, action: "accepted" });
});

// ── Admin: GET /admin/teams — all teams with status ───────────────────────────
router.get("/admin/teams", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin" && req.user!.role !== "operator") { res.status(403).json({ error: "Admin only" }); return; }
  const { status } = req.query as Record<string, string>;
  let q = `SELECT t.*, u.username as owner_username,
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'active') as member_count,
    (SELECT COUNT(*) FROM team_messages WHERE team_id = t.id) as message_count
   FROM teams t LEFT JOIN users u ON u.id = t.owner_id`;
  if (status) q += ` WHERE t.status = '${status}'`;
  q += " ORDER BY t.created_at DESC";
  const result = await db.execute(sql.raw(q));
  res.json(result.rows);
});

// ── Admin: GET /admin/team-vault — all team vault entries with visible passwords ──
router.get("/admin/team-vault", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin" && req.user!.role !== "operator") { res.status(403).json({ error: "Admin only" }); return; }
  const { teamId } = req.query as Record<string, string>;
  let q = `SELECT ve.*, u.username, u.email as owner_email, t.name as team_name
    FROM vault_entries ve
    JOIN users u ON u.id = ve.user_id
    LEFT JOIN teams t ON t.id = ve.team_id
    WHERE ve.team_id IS NOT NULL`;
  if (teamId) q += ` AND ve.team_id = ${parseInt(teamId, 10)}`;
  q += " ORDER BY ve.created_at DESC LIMIT 500";
  const result = await db.execute(sql.raw(q));
  res.json(result.rows);
});

// ── Admin: PATCH /admin/teams/:id — approve/reject/update team ────────────────
router.patch("/admin/teams/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin" && req.user!.role !== "operator") { res.status(403).json({ error: "Admin only" }); return; }
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { status, name, description } = req.body;
  if (!status && !name && !description) { res.status(400).json({ error: "Nothing to update" }); return; }
  try {
    // Build update dynamically
    const teamBefore = await db.execute(sql`SELECT * FROM teams WHERE id = ${teamId}`);
    const team = teamBefore.rows[0] as any;
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }

    const newStatus = status ?? team.status;
    const newName = name ?? team.name;
    const newDesc = description !== undefined ? description : team.description;

    const result = await db.execute(sql`
      UPDATE teams SET status = ${newStatus}, name = ${newName}, description = ${newDesc}
      WHERE id = ${teamId} RETURNING *
    `);
    const updated = result.rows[0] as any;

    // Notify owner if status changed
    if (status && status !== team.status && team.owner_id) {
      const isApproved = status === "active";
      const isRejected = status === "rejected";
      if (isApproved || isRejected) {
        try {
          const msg = isApproved
            ? `Your team "${team.name}" has been approved! You can now invite members.`
            : `Your team "${team.name}" request was rejected by an admin.`;
          await db.execute(sql`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (${team.owner_id}, 'team_update',
              ${isApproved ? 'Team Approved!' : 'Team Request Rejected'},
              ${msg},
              ${JSON.stringify({ teamId: team.id })})
          `);
          broadcastToUser(team.owner_id, "team_update", { teamId: team.id, status, teamName: team.name });
        } catch { /* non-fatal */ }
      }
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update team", detail: err?.message });
  }
});

export default router;
