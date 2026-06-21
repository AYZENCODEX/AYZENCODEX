import { Router } from "express";
import { db, tasksTable, taskSubmissionsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { broadcastEvent } from "./events";
import { notifyTaskVerified } from "../lib/telegram";

const router = Router();

function formatTask(t: typeof tasksTable.$inferSelect, projectName?: string | null, userStatus?: string | null) {
  return { ...t, createdAt: t.createdAt.toISOString(), projectName: projectName ?? null, userStatus: userStatus ?? null };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const { projectId, userId } = req.query as Record<string, string>;
  const conditions = [];
  if (projectId) conditions.push(eq(tasksTable.projectId, parseInt(projectId, 10)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const tasks = await db.select().from(tasksTable).where(where);

  const enriched = await Promise.all(tasks.map(async (t) => {
    const [proj] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, t.projectId));
    let userStatus: string | null = null;
    if (userId) {
      const [sub] = await db.select().from(taskSubmissionsTable).where(and(eq(taskSubmissionsTable.taskId, t.id), eq(taskSubmissionsTable.userId, parseInt(userId, 10))));
      userStatus = sub?.status ?? null;
    }
    return formatTask(t, proj?.name, userStatus);
  }));

  res.json(enriched);
});

router.post("/tasks", async (req, res): Promise<void> => {
  const { projectId, name, description, rewardAmount, verificationType, taskType } = req.body;
  if (!projectId || !name) { res.status(400).json({ error: "projectId and name are required" }); return; }
  const [task] = await db.insert(tasksTable).values({
    projectId: Number(projectId), name, description,
    rewardAmount: rewardAmount ? Number(rewardAmount) : null,
    verificationType: verificationType ?? "manual",
    taskType: taskType ?? "One-time",
  }).returning();
  broadcastEvent("tasks_updated", { action: "created", taskId: task.id });
  res.status(201).json(formatTask(task));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  const [proj] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, task.projectId));
  res.json(formatTask(task, proj?.name));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  for (const f of ["name", "description", "rewardAmount", "verificationType", "taskType"]) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  const [task] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  broadcastEvent("tasks_updated", { action: "updated", taskId: id });
  res.json(formatTask(task));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  broadcastEvent("tasks_updated", { action: "deleted", taskId: id });
  res.json({ message: "Task deleted" });
});

router.post("/tasks/:id/submit", async (req, res): Promise<void> => {
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { proofUrl, notes } = req.body;
  const authHeader = req.headers.authorization;
  let userId = 1;
  if (authHeader) {
    try { const p = JSON.parse(Buffer.from(authHeader.replace("Bearer ", ""), "base64").toString()); userId = p.userId; } catch {}
  }
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  let status = "pending";
  if (task.verificationType === "auto") status = "approved";

  const [sub] = await db.insert(taskSubmissionsTable).values({ taskId, userId, status, proofUrl, notes }).returning();
  if (status === "approved") {
    await db.update(tasksTable).set({ completionCount: task.completionCount + 1 }).where(eq(tasksTable.id, taskId));
  }
  broadcastEvent("tasks_updated", { action: "submitted", taskId, userId, status });
  res.json({
    id: sub.id, taskId: sub.taskId, taskName: task.name, userId: sub.userId, username: null,
    status: sub.status, proofUrl: sub.proofUrl, notes: sub.notes,
    submittedAt: sub.submittedAt.toISOString(), reviewedAt: sub.reviewedAt?.toISOString() ?? null,
  });
});

router.post("/tasks/:id/verify", async (req, res): Promise<void> => {
  const { submissionId, approved, rejectionReason } = req.body;
  const status = approved ? "approved" : "rejected";
  await db.update(taskSubmissionsTable).set({ status, rejectionReason, reviewedAt: new Date() }).where(eq(taskSubmissionsTable.id, submissionId));

  const [sub] = await db.select().from(taskSubmissionsTable).where(eq(taskSubmissionsTable.id, submissionId));
  let taskName: string | null = null;
  let rewardAmount: number | null = null;

  if (sub) {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, sub.taskId));
    if (task) {
      taskName = task.name;
      rewardAmount = task.rewardAmount ?? null;
      if (approved) {
        await db.update(tasksTable).set({ completionCount: task.completionCount + 1 }).where(eq(tasksTable.id, sub.taskId));
      }
    }
    if (taskName) {
      notifyTaskVerified(sub.userId, taskName, !!approved, rewardAmount).catch(() => {});
      // Also send email notification
      const { sendTaskApprovedEmail } = await import("../lib/email");
      const [user] = await db.select({ email: usersTable.email, username: usersTable.username })
        .from(usersTable).where(eq(usersTable.id, sub.userId));
      if (user && approved) {
        sendTaskApprovedEmail(user.email, user.username, taskName, rewardAmount).catch(() => {});
      }
    }
  }

  broadcastEvent("tasks_updated", { action: "verified", submissionId, status });
  broadcastEvent("users_updated", { reason: "task_verified" });
  res.json({ message: `Submission ${status}` });
});

router.get("/tasks/submissions", async (req, res): Promise<void> => {
  const { status, projectId } = req.query as Record<string, string>;
  const subs = await db.select({
    sub: taskSubmissionsTable, task: tasksTable, user: usersTable
  }).from(taskSubmissionsTable)
    .leftJoin(tasksTable, eq(taskSubmissionsTable.taskId, tasksTable.id))
    .leftJoin(usersTable, eq(taskSubmissionsTable.userId, usersTable.id));

  const filtered = subs.filter(s => {
    if (status && s.sub.status !== status) return false;
    if (projectId && s.task?.projectId !== parseInt(projectId, 10)) return false;
    return true;
  });

  res.json(filtered.map(s => ({
    id: s.sub.id, taskId: s.sub.taskId, taskName: s.task?.name ?? null,
    userId: s.sub.userId, username: s.user?.username ?? null,
    status: s.sub.status, proofUrl: s.sub.proofUrl, notes: s.sub.notes,
    submittedAt: s.sub.submittedAt.toISOString(), reviewedAt: s.sub.reviewedAt?.toISOString() ?? null,
  })));
});

export default router;
