import { Router } from "express";
import { db, projectsTable, userProjectsTable, tasksTable, usersTable, projectEnrollmentsTable, vaultEntriesTable } from "@workspace/db";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import { broadcastEvent } from "./events";
import { requireAdmin, requireAuth } from "../middlewares/auth";

const router = Router();

/** Extract userId from token — returns null if unauthenticated (B1 fix: no silent fallback to 1). */
function getUserId(req: { headers: { authorization?: string } }): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const payload = JSON.parse(Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString());
    return payload.userId ? Number(payload.userId) : null;
  } catch { return null; }
}

function formatProject(p: typeof projectsTable.$inferSelect, taskCount = 0, completedTaskCount = 0, activeUserCount = 0) {
  return { ...p, createdAt: p.createdAt.toISOString(), taskCount, completedTaskCount, activeUserCount };
}

// GET /projects/entity/:vaultEntryId/overview — cross-project stats for one entity (MUST be before /:id)
router.get("/projects/entity/:vaultEntryId/overview", requireAuth, async (req, res): Promise<void> => {
  const vaultEntryId = parseInt(Array.isArray(req.params.vaultEntryId) ? req.params.vaultEntryId[0] : req.params.vaultEntryId, 10);
  const userId = req.user!.userId;
  try {
    const rows = await db.execute(sql.raw(
      `SELECT
         p.id as project_id, p.name as project_name, p.project_type, p.category,
         p.thumbnail_url,
         (SELECT COUNT(*) FROM tasks WHERE project_id = p.id)::int as total_tasks,
         (SELECT COUNT(*) FROM task_submissions ts2
            JOIN tasks t2 ON t2.id = ts2.task_id
            WHERE t2.project_id = p.id AND ts2.user_id = ${userId} AND ts2.status IN ('approved','completed'))::int as completed_tasks,
         COALESCE((SELECT SUM(ts3.profit) FROM task_submissions ts3
            JOIN tasks t3 ON t3.id = ts3.task_id
            WHERE t3.project_id = p.id AND ts3.user_id = ${userId} AND ts3.status IN ('approved','completed')), 0) as total_profit,
         COALESCE((SELECT SUM(ts4.cost) FROM task_submissions ts4
            JOIN tasks t4 ON t4.id = ts4.task_id
            WHERE t4.project_id = p.id AND ts4.user_id = ${userId} AND ts4.status IN ('approved','completed')), 0) as total_cost,
         pe.enrolled_at
       FROM project_enrollments pe
       JOIN projects p ON p.id = pe.project_id
       WHERE pe.vault_entry_id = ${vaultEntryId} AND pe.user_id = ${userId}
       ORDER BY pe.enrolled_at DESC`
    ));
    const entity = await db.execute(sql.raw(
      `SELECT entity_serial, project_name as entity_name, category, twitter_username, discord_username, email
       FROM vault_entries WHERE id = ${vaultEntryId} AND user_id = ${userId}`
    ));
    const projects = (rows.rows as any[]).map(r => ({
      projectId: Number(r.project_id),
      projectName: r.project_name,
      projectType: r.project_type ?? "protocol",
      category: r.category,
      thumbnailUrl: r.thumbnail_url,
      totalTasks: Number(r.total_tasks),
      completedTasks: Number(r.completed_tasks),
      progress: Number(r.total_tasks) > 0 ? Math.round((Number(r.completed_tasks) / Number(r.total_tasks)) * 100) : 0,
      totalProfit: Number(r.total_profit),
      totalCost: Number(r.total_cost),
      roi: Number(r.total_profit) - Number(r.total_cost),
      enrolledAt: r.enrolled_at,
    }));
    const totalRoi = projects.reduce((s, p) => s + p.roi, 0);
    const totalProfit = projects.reduce((s, p) => s + p.totalProfit, 0);
    const totalCost = projects.reduce((s, p) => s + p.totalCost, 0);
    // Activity heatmap data — task completions by day (past 365 days)
    const activityRows = await db.execute(sql.raw(
      `SELECT DATE(ts.submitted_at)::text as day, COUNT(*)::int as count
       FROM task_submissions ts
       JOIN tasks t ON t.id = ts.task_id
       JOIN project_enrollments pe ON pe.project_id = t.project_id
       WHERE pe.vault_entry_id = ${vaultEntryId}
         AND ts.user_id = ${userId}
         AND ts.status IN ('approved', 'completed')
         AND ts.submitted_at >= NOW() - INTERVAL '365 days'
       GROUP BY DATE(ts.submitted_at)
       ORDER BY day ASC`
    ));
    const activity = (activityRows.rows as any[]).map(r => ({
      day: String(r.day),
      count: Number(r.count),
    }));

    res.json({
      entity: entity.rows[0] ?? null,
      vaultEntryId,
      projects,
      activity,
      summary: { totalProjects: projects.length, totalRoi, totalProfit, totalCost },
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

// GET /projects/entity-leaderboard — all entities ranked by ROI (MUST be before /:id)
router.get("/projects/entity-leaderboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const rows = await db.execute(sql.raw(
      `SELECT
         ve.id as vault_entry_id,
         ve.entity_serial,
         ve.project_name as entity_name,
         ve.category,
         (SELECT COUNT(DISTINCT pe.project_id)::int
          FROM project_enrollments pe WHERE pe.vault_entry_id = ve.id AND pe.user_id = ${userId}
         ) as total_projects,
         COALESCE((
           SELECT COUNT(*)::int FROM task_submissions ts
           JOIN tasks t ON t.id = ts.task_id
           JOIN project_enrollments pe ON pe.project_id = t.project_id AND pe.vault_entry_id = ve.id
           WHERE ts.user_id = ${userId} AND ts.status IN ('approved','completed')
         ), 0) as total_completions,
         COALESCE((
           SELECT SUM(ts.profit) FROM task_submissions ts
           JOIN tasks t ON t.id = ts.task_id
           JOIN project_enrollments pe ON pe.project_id = t.project_id AND pe.vault_entry_id = ve.id
           WHERE ts.user_id = ${userId} AND ts.status IN ('approved','completed')
         ), 0)::float as total_profit,
         COALESCE((
           SELECT SUM(ts.cost) FROM task_submissions ts
           JOIN tasks t ON t.id = ts.task_id
           JOIN project_enrollments pe ON pe.project_id = t.project_id AND pe.vault_entry_id = ve.id
           WHERE ts.user_id = ${userId} AND ts.status IN ('approved','completed')
         ), 0)::float as total_cost
       FROM vault_entries ve
       WHERE ve.user_id = ${userId}`
    ));
    const entities = (rows.rows as any[])
      .map(r => ({
        vaultEntryId:     Number(r.vault_entry_id),
        entitySerial:     r.entity_serial as string | null,
        entityName:       r.entity_name as string | null,
        category:         r.category as string | null,
        totalProjects:    Number(r.total_projects),
        totalCompletions: Number(r.total_completions),
        totalProfit:      Number(r.total_profit),
        totalCost:        Number(r.total_cost),
        totalRoi:         Number(r.total_profit) - Number(r.total_cost),
      }))
      .sort((a, b) => b.totalRoi - a.totalRoi)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    res.json(entities);
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

router.get("/projects", async (req, res): Promise<void> => {
  const { tier, search, page = "1", limit = "20", type, exchangeSubType, accountCategory } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(parseInt(limit, 10), 200);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (tier) conditions.push(eq(projectsTable.tier, tier));
  if (search) conditions.push(ilike(projectsTable.name, `%${search}%`));
  if (type && type !== "all") conditions.push(sql.raw(`project_type = '${type.replace(/'/g,"''")}'`));
  if (exchangeSubType) conditions.push(sql.raw(`exchange_sub_type = '${exchangeSubType.replace(/'/g,"''")}'`));
  if (accountCategory && accountCategory !== "all") conditions.push(sql.raw(`(account_category = '${accountCategory.replace(/'/g,"''")}' OR account_category = 'both')`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const projects = await db.select().from(projectsTable).where(where).limit(limitNum).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(projectsTable).where(where);

  const enriched = await Promise.all(projects.map(async (p) => {
    const [{ taskCount }] = await db.select({ taskCount: count() }).from(tasksTable).where(eq(tasksTable.projectId, p.id));
    const [{ memberCount }] = await db.select({ memberCount: count() }).from(userProjectsTable).where(eq(userProjectsTable.projectId, p.id));
    return formatProject(p, Number(taskCount), 0, Number(memberCount));
  }));

  res.json({ projects: enriched, total: Number(total), page: pageNum, limit: limitNum });
});

router.post("/projects", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, xpName, twitterHandle, discordUrl, websiteUrl, tutorialLink, experienceLevel, tier, fundingAmount, rewardEstimate, thumbnailUrl } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [project] = await db.insert(projectsTable).values({
    name, description, xpName: xpName || null, twitterHandle, discordUrl, websiteUrl, tutorialLink,
    experienceLevel: experienceLevel ?? "Beginner",
    tier: tier ?? "1",
    fundingAmount: Number(fundingAmount ?? 0),
    rewardEstimate: Number(rewardEstimate ?? 0),
    thumbnailUrl,
  }).returning();
  broadcastEvent("projects_updated", { action: "created", projectId: project.id });
  res.status(201).json(formatProject(project));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  const [{ memberCount }] = await db.select({ memberCount: count() }).from(userProjectsTable).where(eq(userProjectsTable.projectId, id));
  const enrollments = userId ? await db.select().from(projectEnrollmentsTable)
    .where(and(eq(projectEnrollmentsTable.projectId, id), eq(projectEnrollmentsTable.userId, userId))) : [];
  const isJoined = enrollments.length > 0;
  res.json({
    ...formatProject(project, tasks.length, 0, Number(memberCount)),
    tasks: tasks.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), projectName: project.name, userStatus: null })),
    isJoined,
    enrollmentCount: enrollments.length,
    userProgress: 0,
  });
});

router.patch("/projects/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "description", "xpName", "twitterHandle", "discordUrl", "websiteUrl", "tutorialLink", "experienceLevel", "tier", "fundingAmount", "rewardEstimate", "thumbnailUrl"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  // Extra raw-SQL fields not in Drizzle schema yet
  const rawSets: string[] = [];
  if (req.body.deadline !== undefined) rawSets.push(`deadline = ${req.body.deadline ? `'${req.body.deadline}'` : "NULL"}`);
  if (req.body.startedAt !== undefined) rawSets.push(`started_at = ${req.body.startedAt ? `'${req.body.startedAt}'` : "NULL"}`);
  if (req.body.status !== undefined) rawSets.push(`status = '${String(req.body.status).replace(/'/g, "''")}'`);
  if (req.body.projectType !== undefined) rawSets.push(`project_type = '${String(req.body.projectType).replace(/'/g, "''")}'`);
  if (req.body.exchangeSubType !== undefined) rawSets.push(`exchange_sub_type = '${String(req.body.exchangeSubType).replace(/'/g, "''")}'`);
  if (req.body.accountCategory !== undefined) rawSets.push(`account_category = '${String(req.body.accountCategory).replace(/'/g, "''")}'`);
  if (req.body.exchangeCustomCategories !== undefined) rawSets.push(`exchange_custom_categories = ${req.body.exchangeCustomCategories ? `'${JSON.stringify(req.body.exchangeCustomCategories).replace(/'/g, "''")}'` : "NULL"}`);

  try {
    let project: any;
    if (Object.keys(updates).length > 0) {
      const [p] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
      project = p;
    }
    if (rawSets.length > 0) {
      const result = await db.execute(sql.raw(`UPDATE projects SET ${rawSets.join(", ")} WHERE id = ${id} RETURNING *`));
      project = result.rows[0] ?? project;
    }
    if (!project) {
      const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
      project = p;
    }
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    broadcastEvent("projects_updated", { action: "updated", projectId: id });
    const p = project as any;
    res.json({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      deadline: p.deadline instanceof Date ? p.deadline.toISOString() : (p.deadline ?? null),
      startedAt: p.started_at instanceof Date ? p.started_at.toISOString() : (p.started_at ?? null),
      status: p.status ?? "active",
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

router.delete("/projects/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  broadcastEvent("projects_updated", { action: "deleted", projectId: id });
  res.json({ message: "Project deleted" });
});

router.post("/projects/:id/join", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;
  const existing = await db.select().from(userProjectsTable).where(and(eq(userProjectsTable.userId, userId), eq(userProjectsTable.projectId, projectId)));
  if (existing.length === 0) {
    await db.insert(userProjectsTable).values({ userId, projectId });
  }
  res.json({ message: "Joined project" });
});

router.post("/projects/:id/enroll", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;
  const { vaultEntryId } = req.body;
  if (!vaultEntryId) { res.status(400).json({ error: "vaultEntryId is required" }); return; }

  const [vaultEntry] = await db.select().from(vaultEntriesTable)
    .where(and(eq(vaultEntriesTable.id, vaultEntryId), eq(vaultEntriesTable.userId, userId)));
  if (!vaultEntry) { res.status(404).json({ error: "Vault entity not found" }); return; }

  const existing = await db.select().from(projectEnrollmentsTable)
    .where(and(eq(projectEnrollmentsTable.projectId, projectId), eq(projectEnrollmentsTable.userId, userId), eq(projectEnrollmentsTable.vaultEntryId, vaultEntryId)));
  if (existing.length > 0) { res.status(409).json({ error: "Entity already enrolled in this project" }); return; }

  const [enrollment] = await db.insert(projectEnrollmentsTable).values({ userId, projectId, vaultEntryId, status: "active" }).returning();

  const alreadyJoined = await db.select().from(userProjectsTable).where(and(eq(userProjectsTable.userId, userId), eq(userProjectsTable.projectId, projectId)));
  if (alreadyJoined.length === 0) await db.insert(userProjectsTable).values({ userId, projectId });

  res.status(201).json({ ...enrollment, enrolledAt: enrollment.enrolledAt.toISOString() });
});

router.get("/projects/:id/enrollments", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;
  const enrollments = await db
    .select({ enrollment: projectEnrollmentsTable, vault: vaultEntriesTable })
    .from(projectEnrollmentsTable)
    .leftJoin(vaultEntriesTable, eq(projectEnrollmentsTable.vaultEntryId, vaultEntriesTable.id))
    .where(and(eq(projectEnrollmentsTable.projectId, projectId), eq(projectEnrollmentsTable.userId, userId)));
  res.json(enrollments.map(({ enrollment, vault }) => ({
    ...enrollment,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    entity: vault ? {
      id: vault.id, entitySerial: vault.entitySerial, projectName: vault.projectName,
      category: vault.category, twitterUsername: vault.twitterUsername, discordUsername: vault.discordUsername,
      walletAddresses: vault.walletAddresses ? JSON.parse(vault.walletAddresses) : [], email: vault.email,
    } : null,
  })));
});

router.delete("/projects/:id/enrollments/:enrollmentId", requireAuth, async (req, res): Promise<void> => {
  const enrollmentId = parseInt(Array.isArray(req.params.enrollmentId) ? req.params.enrollmentId[0] : req.params.enrollmentId, 10);
  const userId = req.user!.userId;
  await db.delete(projectEnrollmentsTable)
    .where(and(eq(projectEnrollmentsTable.id, enrollmentId), eq(projectEnrollmentsTable.userId, userId)));
  res.json({ message: "Enrollment removed" });
});

// GET /projects/:id/members — list all users who joined this project (admin view)
router.get("/projects/:id/members", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  try {
    const rows = await db.execute(sql.raw(
      `SELECT up.user_id, up.joined_at, u.username, u.email,
              (SELECT COUNT(*) FROM task_submissions ts
               JOIN tasks t ON t.id = ts.task_id
               WHERE ts.user_id = up.user_id AND t.project_id = ${projectId}
               AND ts.status IN ('approved','completed'))::int as tasks_completed,
              (SELECT COUNT(*) FROM tasks WHERE project_id = ${projectId})::int as total_tasks
       FROM user_projects up
       JOIN users u ON u.id = up.user_id
       WHERE up.project_id = ${projectId}
       ORDER BY up.joined_at DESC`
    ));
    res.json(rows.rows.map((r: any) => ({
      userId: r.user_id,
      username: r.username,
      email: r.email,
      joinedAt: r.joined_at,
      tasksCompleted: Number(r.tasks_completed ?? 0),
      totalTasks: Number(r.total_tasks ?? 0),
      progress: Number(r.total_tasks ?? 0) > 0
        ? Math.round((Number(r.tasks_completed ?? 0) / Number(r.total_tasks ?? 0)) * 100)
        : 0,
    })));
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

router.get("/projects/:id/stats", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [{ taskCount }] = await db.select({ taskCount: count() }).from(tasksTable).where(eq(tasksTable.projectId, id));
  const [{ memberCount }] = await db.select({ memberCount: count() }).from(userProjectsTable).where(eq(userProjectsTable.projectId, id));
  const [roiResult] = await db.select({ roi: sql<number>`COALESCE(SUM(total_roi_distributed), 0)` }).from(projectsTable).where(eq(projectsTable.id, id));
  res.json({ totalTasks: Number(taskCount), completedTasks: 0, activeUsers: Number(memberCount), totalRoiDistributed: Number(roiResult?.roi ?? 0) });
});

// ─── GET /api/projects/:id/entity-tasks — per-entity task completion ──────────
router.get("/projects/:id/entity-tasks", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.userId;

  try {
    const tasks = await db.execute(sql.raw(
      `SELECT id, name, description, reward_amount, verification_type, task_type, cost, profit FROM tasks WHERE project_id = ${projectId} ORDER BY id ASC`
    ));
    const enrollments = await db.execute(sql.raw(
      `SELECT pe.*, ve.entity_serial, ve.project_name as entity_name, ve.category, ve.twitter_username, ve.discord_username, ve.email
       FROM project_enrollments pe
       LEFT JOIN vault_entries ve ON ve.id = pe.vault_entry_id
       WHERE pe.project_id = ${projectId} AND pe.user_id = ${userId}`
    ));

    const result = await Promise.all((enrollments.rows as any[]).map(async (enr) => {
      const taskStatuses = await Promise.all((tasks.rows as any[]).map(async (task) => {
        const sub = await db.execute(sql.raw(
          `SELECT status FROM task_submissions WHERE task_id = ${task.id} AND user_id = ${userId} ORDER BY submitted_at DESC LIMIT 1`
        ));
        return {
          taskId: task.id, taskName: task.name, taskType: task.task_type,
          rewardAmount: task.reward_amount, cost: task.cost ?? 0, profit: task.profit ?? 0,
          status: sub.rows[0] ? (sub.rows[0] as any).status : null,
        };
      }));
      const done = taskStatuses.filter(t => t.status === "approved" || t.status === "completed").length;
      return {
        enrollmentId: enr.id, vaultEntryId: enr.vault_entry_id,
        entitySerial: enr.entity_serial, entityName: enr.entity_name,
        category: enr.category, email: enr.email,
        twitterUsername: enr.twitter_username, discordUsername: enr.discord_username,
        status: enr.status,
        tasks: taskStatuses, completedTasks: done, totalTasks: tasks.rows.length,
      };
    }));

    res.json({ tasks: tasks.rows, entities: result });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

router.get("/projects/:id/members", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const members = await db.select({ up: userProjectsTable, u: usersTable })
    .from(userProjectsTable)
    .leftJoin(usersTable, eq(userProjectsTable.userId, usersTable.id))
    .where(eq(userProjectsTable.projectId, id));
  res.json(members.map(m => ({
    userId: m.up.userId, username: m.u?.username ?? "Unknown", avatarUrl: m.u?.avatarUrl ?? null,
    progress: Math.random() * 100, tasksCompleted: Math.floor(Math.random() * 10),
    joinedAt: m.up.joinedAt.toISOString(),
  })));
});

export default router;
