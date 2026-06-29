import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /search?q=... — global search across projects, tasks, users, vault entities
router.get("/search", requireAuth, async (req, res): Promise<void> => {
  const q = ((req.query.q as string) ?? "").trim();
  if (!q || q.length < 2) { res.json({ projects: [], users: [], tasks: [], entities: [] }); return; }

  const isAdmin = req.user?.role === "admin";
  const userId = req.user!.userId;
  const like = `%${q}%`;

  const [projectRows, taskRows, entityRows] = await Promise.all([
    db.execute(sql`
      SELECT id, name, category, status, tier FROM projects
      WHERE LOWER(name) LIKE LOWER(${like}) OR LOWER(category) LIKE LOWER(${like}) LIMIT 6
    `),
    db.execute(sql`
      SELECT t.id, t.name, t.category, t.task_category, p.name as project_name
      FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
      WHERE LOWER(t.name) LIKE LOWER(${like}) LIMIT 6
    `),
    db.execute(sql`
      SELECT v.id, v.project_name, v.category, v.email
      FROM vault_entries v
      WHERE v.user_id = ${userId}
        AND (LOWER(v.project_name) LIKE LOWER(${like}) OR LOWER(COALESCE(v.email,'')) LIKE LOWER(${like}))
      LIMIT 5
    `),
  ]);

  let userRows: any[] = [];
  if (isAdmin) {
    const result = await db.execute(sql`
      SELECT id, username, email, role, status FROM users
      WHERE LOWER(username) LIKE LOWER(${like}) OR LOWER(email) LIKE LOWER(${like}) LIMIT 6
    `);
    userRows = result.rows as any[];
  }

  res.json({
    projects: projectRows.rows,
    users: userRows,
    tasks: taskRows.rows,
    entities: entityRows.rows,
  });
});

export default router;
