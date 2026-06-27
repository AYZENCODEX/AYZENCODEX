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

// ── POST /teams — create team ─────────────────────────────────────────────────
router.post("/teams", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const result = await db.execute(sql.raw(
    `INSERT INTO teams (name, owner_id) VALUES ('${name.replace(/'/g, "''")}', ${userId}) RETURNING *`
  ));
  const team = result.rows[0] as any;
  await db.execute(sql.raw(
    `INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${userId}, 'leader')`
  ));
  res.status(201).json(team);
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
    `SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`
  ));
  if (!memberCheck.rows.length) { res.status(403).json({ error: "Not a team member" }); return; }
  const result = await db.execute(sql.raw(
    `INSERT INTO team_messages (team_id, user_id, message) VALUES (${teamId}, ${userId}, '${message.replace(/'/g, "''")}') RETURNING *`
  ));
  res.status(201).json(result.rows[0]);
});

export default router;
