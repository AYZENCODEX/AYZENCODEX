import { Router } from "express";
import { db, projectsTable, userProjectsTable, tasksTable, usersTable } from "@workspace/db";
import { eq, ilike, and, count, sql } from "drizzle-orm";

const router = Router();

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
  const { name, description, twitterHandle, discordUrl, websiteUrl, tutorialLink, experienceLevel, tier, fundingAmount, rewardEstimate, thumbnailUrl } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [project] = await db.insert(projectsTable).values({
    name, description, twitterHandle, discordUrl, websiteUrl, tutorialLink,
    experienceLevel: experienceLevel ?? "Beginner",
    tier: tier ?? "1",
    fundingAmount: Number(fundingAmount ?? 0),
    rewardEstimate: Number(rewardEstimate ?? 0),
    thumbnailUrl,
  }).returning();
  res.status(201).json(formatProject(project));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  const [{ memberCount }] = await db.select({ memberCount: count() }).from(userProjectsTable).where(eq(userProjectsTable.projectId, id));
  res.json({
    ...formatProject(project, tasks.length, 0, Number(memberCount)),
    tasks: tasks.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), projectName: project.name, userStatus: null })),
    isJoined: false,
    userProgress: 0,
  });
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "description", "twitterHandle", "discordUrl", "websiteUrl", "tutorialLink", "experienceLevel", "tier", "fundingAmount", "rewardEstimate", "thumbnailUrl"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(formatProject(project));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.json({ message: "Project deleted" });
});

router.post("/projects/:id/join", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const authHeader = req.headers.authorization;
  let userId = 1;
  if (authHeader) {
    try {
      const payload = JSON.parse(Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString());
      userId = payload.userId;
    } catch {}
  }
  const existing = await db.select().from(userProjectsTable).where(and(eq(userProjectsTable.userId, userId), eq(userProjectsTable.projectId, projectId)));
  if (existing.length === 0) {
    await db.insert(userProjectsTable).values({ userId, projectId });
  }
  res.json({ message: "Joined project" });
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
