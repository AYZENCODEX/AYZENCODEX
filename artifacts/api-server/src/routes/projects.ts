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

// Columns guaranteed in the original DB schema (xp_name may not exist yet)
const PROJ_SAFE = `id, name, description, null::text as xp_name, twitter_handle, discord_url, website_url, tutorial_link, experience_level, tier, funding_amount, reward_estimate, thumbnail_url, total_roi_distributed, created_at`;

function formatRow(p: Record<string, unknown>, taskCount = 0, completedTaskCount = 0, activeUserCount = 0) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    xpName: p.xp_name ?? p.xpName ?? null,
    twitterHandle: p.twitter_handle ?? p.twitterHandle ?? null,
    discordUrl: p.discord_url ?? p.discordUrl ?? null,
    websiteUrl: p.website_url ?? p.websiteUrl ?? null,
    tutorialLink: p.tutorial_link ?? p.tutorialLink ?? null,
    experienceLevel: p.experience_level ?? p.experienceLevel ?? "Beginner",
    tier: p.tier ?? "1",
    fundingAmount: p.funding_amount ?? p.fundingAmount ?? 0,
    rewardEstimate: p.reward_estimate ?? p.rewardEstimate ?? 0,
    thumbnailUrl: p.thumbnail_url ?? p.thumbnailUrl ?? null,
    totalRoiDistributed: p.total_roi_distributed ?? p.totalRoiDistributed ?? 0,
    createdAt: p.created_at ? new Date(p.created_at as string).toISOString() : (p.createdAt as Date | undefined)?.toISOString(),
    taskCount,
    completedTaskCount,
    activeUserCount,
  };
}

async function fetchProjects(conditions: ReturnType<typeof eq>[], limitNum: number, offset: number) {
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  try {
    const rows = await db.select().from(projectsTable).where(where).limit(limitNum).offset(offset);
    return rows as unknown as Record<string, unknown>[];
  } catch {
    // xp_name column not migrated yet — fallback without it
    const whereSql = conditions.length ? sql.raw(`WHERE ${conditions.map(c => (c as unknown as {queryChunks?: {value?: string}[]}).queryChunks?.map(q => q.value).join("") ?? "1=1").join(" AND ")}`) : sql.raw("WHERE 1=1");
    const result = await db.execute(sql`SELECT ${sql.raw(PROJ_SAFE)} FROM projects WHERE 1=1 LIMIT ${limitNum} OFFSET ${offset}`);
    return result.rows as Record<string, unknown>[];
  }
}

router.get("/projects", async (req, res): Promise<void> => {
  const { tier, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(parseInt(limit, 10), 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];
  if (tier) conditions.push(eq(projectsTable.tier, tier));
  if (search) conditions.push(ilike(projectsTable.name, `%${search}%`) as unknown as ReturnType<typeof eq>);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  let projects: Record<string, unknown>[];
  let total = 0;
  try {
    const rows = await db.select().from(projectsTable).where(where).limit(limitNum).offset(offset);
    const [{ cnt }] = await db.select({ cnt: count() }).from(projectsTable).where(where);
    projects = rows as unknown as Record<string, unknown>[];
    total = Number(cnt);
  } catch {
    const result = await db.execute(sql`SELECT ${sql.raw(PROJ_SAFE)} FROM projects LIMIT ${limitNum} OFFSET ${offset}`);
    const [{ cnt }] = await db.select({ cnt: count() }).from(projectsTable);
    projects = result.rows as Record<string, unknown>[];
    total = Number(cnt);
  }

  const enriched = await Promise.all(projects.map(async (p) => {
    const id = p.id as number;
    try {
      const [{ taskCount }] = await db.select({ taskCount: count() }).from(tasksTable).where(eq(tasksTable.projectId, id));
      const [{ memberCount }] = await db.select({ memberCount: count() }).from(userProjectsTable).where(eq(userProjectsTable.projectId, id));
      return formatRow(p, Number(taskCount), 0, Number(memberCount));
    } catch {
      return formatRow(p);
    }
  }));

  res.json({ projects: enriched, total, page: pageNum, limit: limitNum });
});

router.post("/projects", async (req, res): Promise<void> => {
  const { name, description, xpName, twitterHandle, discordUrl, websiteUrl, tutorialLink, experienceLevel, tier, fundingAmount, rewardEstimate, thumbnailUrl } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  let project: typeof projectsTable.$inferSelect;
  try {
    [project] = await db.insert(projectsTable).values({
      name, description, xpName: xpName || null, twitterHandle, discordUrl, websiteUrl, tutorialLink,
      experienceLevel: experienceLevel ?? "Beginner",
      tier: tier ?? "1",
      fundingAmount: Number(fundingAmount ?? 0),
      rewardEstimate: Number(rewardEstimate ?? 0),
      thumbnailUrl,
    }).returning();
  } catch {
    // xp_name not yet migrated — insert without it
    [project] = await db.insert(projectsTable).values({
      name, description, twitterHandle, discordUrl, websiteUrl, tutorialLink,
      experienceLevel: experienceLevel ?? "Beginner",
      tier: tier ?? "1",
      fundingAmount: Number(fundingAmount ?? 0),
      rewardEstimate: Number(rewardEstimate ?? 0),
      thumbnailUrl,
    } as typeof projectsTable.$inferInsert).returning();
  }
  broadcastEvent("projects_updated", { action: "created", projectId: project.id });
  res.status(201).json(formatRow(project as unknown as Record<string, unknown>));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);

  let project: Record<string, unknown> | null = null;
  try {
    const [row] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    project = row as unknown as Record<string, unknown> ?? null;
  } catch {
    const result = await db.execute(sql`SELECT ${sql.raw(PROJ_SAFE)} FROM projects WHERE id = ${id}`);
    project = (result.rows[0] as Record<string, unknown>) ?? null;
  }
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  const [{ memberCount }] = await db.select({ memberCount: count() }).from(userProjectsTable).where(eq(userProjectsTable.projectId, id));
  const enrollments = await db.select().from(projectEnrollmentsTable)
    .where(and(eq(projectEnrollmentsTable.projectId, id), eq(projectEnrollmentsTable.userId, userId)));
  const isJoined = enrollments.length > 0;
  const projectName = project.name as string;
  res.json({
    ...formatRow(project, tasks.length, 0, Number(memberCount)),
    tasks: tasks.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), projectName, userStatus: null })),
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
  let project: typeof projectsTable.$inferSelect;
  try {
    [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
  } catch {
    delete updates.xpName;
    [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
  }
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  broadcastEvent("projects_updated", { action: "updated", projectId: id });
  res.json(formatRow(project as unknown as Record<string, unknown>));
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

// Enroll a vault entity into a project
router.post("/projects/:id/enroll", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = getUserId(req);
  const { vaultEntryId } = req.body;
  if (!vaultEntryId) { res.status(400).json({ error: "vaultEntryId is required" }); return; }

  const [vaultEntry] = await db.select().from(vaultEntriesTable)
    .where(and(eq(vaultEntriesTable.id, vaultEntryId), eq(vaultEntriesTable.userId, userId)));
  if (!vaultEntry) { res.status(404).json({ error: "Vault entity not found" }); return; }

  const existing = await db.select().from(projectEnrollmentsTable)
    .where(and(
      eq(projectEnrollmentsTable.projectId, projectId),
      eq(projectEnrollmentsTable.userId, userId),
      eq(projectEnrollmentsTable.vaultEntryId, vaultEntryId)
    ));
  if (existing.length > 0) { res.status(409).json({ error: "Entity already enrolled in this project" }); return; }

  const [enrollment] = await db.insert(projectEnrollmentsTable).values({
    userId, projectId, vaultEntryId, status: "active",
  }).returning();

  const alreadyJoined = await db.select().from(userProjectsTable).where(and(eq(userProjectsTable.userId, userId), eq(userProjectsTable.projectId, projectId)));
  if (alreadyJoined.length === 0) {
    await db.insert(userProjectsTable).values({ userId, projectId });
  }

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
      id: vault.id,
      entitySerial: vault.entitySerial,
      projectName: vault.projectName,
      category: vault.category,
      twitterUsername: vault.twitterUsername,
      discordUsername: vault.discordUsername,
      walletAddresses: vault.walletAddresses ? JSON.parse(vault.walletAddresses) : [],
      email: vault.email,
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

router.get("/projects/:id/stats", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [{ taskCount }] = await db.select({ taskCount: count() }).from(tasksTable).where(eq(tasksTable.projectId, id));
  const [{ memberCount }] = await db.select({ memberCount: count() }).from(userProjectsTable).where(eq(userProjectsTable.projectId, id));
  const roiResult = await db.select({ roi: sql<number>`COALESCE(SUM(total_roi_distributed), 0)` }).from(projectsTable).where(eq(projectsTable.id, id));
  res.json({ totalTasks: Number(taskCount), completedTasks: 0, activeUsers: Number(memberCount), totalRoiDistributed: Number(roiResult[0]?.roi ?? 0) });
});

router.get("/projects/:id/members", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const members = await db.select({ up: userProjectsTable, u: usersTable })
    .from(userProjectsTable)
    .leftJoin(usersTable, eq(userProjectsTable.userId, usersTable.id))
    .where(eq(userProjectsTable.projectId, id));
  res.json(members.map(m => ({
    userId: m.up.userId,
    username: m.u?.username ?? "Unknown",
    avatarUrl: m.u?.avatarUrl ?? null,
    progress: Math.random() * 100,
    tasksCompleted: Math.floor(Math.random() * 10),
    joinedAt: m.up.joinedAt.toISOString(),
  })));
});

export default router;
