import { Router } from "express";
import { db, projectsTable, userProjectsTable, tasksTable, usersTable, projectEnrollmentsTable, vaultEntriesTable } from "@workspace/db";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import { broadcastEvent } from "./events";

const router = Router();

function getUserId(req: { headers: { authorization?: string } }): number {
  const authHeader = req.headers.authorization;
  if (!authHeader) return 1;
  try {
    const payload = JSON.parse(Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString());
    return payload.userId ?? 1;
  } catch { return 1; }
}

function formatProject(p: typeof projectsTable.$inferSelect, taskCount = 0, completedTaskCount = 0, activeUserCount = 0) {
  return { ...p, createdAt: p.createdAt.toISOString(), taskCount, completedTaskCount, activeUserCount };
}

router.get("/projects", async (req, res): Promise<void> => {
  const { tier, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(parseInt(limit, 10), 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (tier) conditions.push(eq(projectsTable.tier, tier));
  if (search) conditions.push(ilike(projectsTable.name, `%${search}%`));
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

router.post("/projects", async (req, res): Promise<void> => {
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
  const enrollments = await db.select().from(projectEnrollmentsTable)
    .where(and(eq(projectEnrollmentsTable.projectId, id), eq(projectEnrollmentsTable.userId, userId)));
  const isJoined = enrollments.length > 0;
  res.json({
    ...formatProject(project, tasks.length, 0, Number(memberCount)),
    tasks: tasks.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), projectName: project.name, userStatus: null })),
    isJoined,
    enrollmentCount: enrollments.length,
    userProgress: 0,
  });
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "description", "xpName", "twitterHandle", "discordUrl", "websiteUrl", "tutorialLink", "experienceLevel", "tier", "fundingAmount", "rewardEstimate", "thumbnailUrl"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  // Extra raw-SQL fields not in Drizzle schema yet
  const rawSets: string[] = [];
  if (req.body.deadline !== undefined) rawSets.push(`deadline = ${req.body.deadline ? `'${req.body.deadline}'` : "NULL"}`);
  if (req.body.startedAt !== undefined) rawSets.push(`started_at = ${req.body.startedAt ? `'${req.body.startedAt}'` : "NULL"}`);
  if (req.body.status !== undefined) rawSets.push(`status = '${String(req.body.status).replace(/'/g, "''")}'`);

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

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  broadcastEvent("projects_updated", { action: "deleted", projectId: id });
  res.json({ message: "Project deleted" });
});

router.post("/projects/:id/join", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
  const existing = await db.select().from(userProjectsTable).where(and(eq(userProjectsTable.userId, userId), eq(userProjectsTable.projectId, projectId)));
  if (existing.length === 0) {
    await db.insert(userProjectsTable).values({ userId, projectId });
  }
  res.json({ message: "Joined project" });
});

router.post("/projects/:id/enroll", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
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

router.get("/projects/:id/enrollments", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
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

router.delete("/projects/:id/enrollments/:enrollmentId", async (req, res): Promise<void> => {
  const enrollmentId = parseInt(Array.isArray(req.params.enrollmentId) ? req.params.enrollmentId[0] : req.params.enrollmentId, 10);
  const userId = getUserId(req);
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
router.get("/projects/:id/entity-tasks", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);

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
