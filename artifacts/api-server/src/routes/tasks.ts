import { Router } from "express";
import { db, tasksTable, taskSubmissionsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { broadcastEvent } from "./events";
import { notifyTaskVerified } from "../lib/telegram";

const router = Router();

function getUserId(req: { headers: { authorization?: string } }): number {
  const auth = req.headers.authorization;
  if (!auth) return 1;
  try {
    const p = JSON.parse(Buffer.from(auth.replace("Bearer ", ""), "base64").toString());
    return p.userId ?? 1;
  } catch { return 1; }
}

function formatTask(t: any, projectName?: string | null, userStatus?: string | null) {
  return {
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    projectName: projectName ?? null,
    userStatus: userStatus ?? null,
    cost: t.cost ?? 0,
    profit: t.profit ?? 0,
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const { projectId, userId } = req.query as Record<string, string>;
  const conditions = [];
  if (projectId) conditions.push(eq(tasksTable.projectId, parseInt(projectId, 10)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const rawTasks = await db.execute(sql.raw(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       ${where ? `WHERE t.project_id = ${parseInt(projectId!, 10)}` : ""}
       ORDER BY t.created_at DESC`
    ));

    const tasks = rawTasks.rows as any[];
    const enriched = await Promise.all(tasks.map(async (t) => {
      let userStatus: string | null = null;
      if (userId) {
        const [sub] = await db.select().from(taskSubmissionsTable)
          .where(and(eq(taskSubmissionsTable.taskId, t.id), eq(taskSubmissionsTable.userId, parseInt(userId, 10))));
        userStatus = sub?.status ?? null;
      }
      return formatTask({ ...t, projectId: t.project_id, completionCount: t.completion_count, rewardAmount: t.reward_amount, verificationType: t.verification_type, taskType: t.task_type, createdAt: t.created_at }, t.project_name, userStatus);
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
});

router.post("/tasks", async (req, res): Promise<void> => {
  const { projectId, name, description, rewardAmount, verificationType, taskType, cost, profit } = req.body;
  if (!projectId || !name) { res.status(400).json({ error: "projectId and name are required" }); return; }
  try {
    const result = await db.execute(sql.raw(
      `INSERT INTO tasks (project_id, name, description, reward_amount, verification_type, task_type, cost, profit)
       VALUES (${Number(projectId)}, '${name.replace(/'/g, "''")}',
         ${description ? `'${description.replace(/'/g, "''")}'` : "NULL"},
         ${rewardAmount != null ? Number(rewardAmount) : "NULL"},
         '${(verificationType ?? "manual").replace(/'/g, "''")}',
         '${(taskType ?? "One-time").replace(/'/g, "''")}',
         ${Number(cost ?? 0)}, ${Number(profit ?? 0)})
       RETURNING *`
    ));
    const task = result.rows[0] as any;
    broadcastEvent("tasks_updated", { action: "created", taskId: task.id });
    res.status(201).json(formatTask({ ...task, projectId: task.project_id, completionCount: task.completion_count, rewardAmount: task.reward_amount, verificationType: task.verification_type, taskType: task.task_type, createdAt: task.created_at }));
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
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
  for (const f of ["name", "description", "rewardAmount", "verificationType", "taskType", "cost", "profit"]) {
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
  const { proofUrl, notes, cost, profit } = req.body;
  const userId = getUserId(req);

  try {
    const result = await db.execute(sql.raw(
      `SELECT * FROM tasks WHERE id = ${taskId}`
    ));
    const task = result.rows[0] as any;
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const status = task.verification_type === "auto" ? "approved" : "pending";

    const subResult = await db.execute(sql.raw(
      `INSERT INTO task_submissions (task_id, user_id, status, proof_url, notes, cost, profit)
       VALUES (${taskId}, ${userId}, '${status}',
         ${proofUrl ? `'${proofUrl.replace(/'/g, "''")}'` : "NULL"},
         ${notes ? `'${notes.replace(/'/g, "''")}'` : "NULL"},
         ${Number(cost ?? 0)}, ${Number(profit ?? 0)})
       RETURNING *`
    ));
    const sub = subResult.rows[0] as any;

    if (status === "approved") {
      await db.execute(sql.raw(`UPDATE tasks SET completion_count = completion_count + 1 WHERE id = ${taskId}`));
    }

    broadcastEvent("tasks_updated", { action: "submitted", taskId, userId, status });
    res.json({
      id: sub.id, taskId: sub.task_id, taskName: task.name, userId: sub.user_id,
      status: sub.status, proofUrl: sub.proof_url, notes: sub.notes,
      cost: sub.cost ?? 0, profit: sub.profit ?? 0,
      submittedAt: sub.submitted_at, reviewedAt: sub.reviewed_at ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "DB error", detail: err?.message });
  }
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
