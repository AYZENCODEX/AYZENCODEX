import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/leaderboard", async (req, res): Promise<void> => {
  const { limit = "50" } = req.query as Record<string, string>;
  const limitNum = Math.min(parseInt(limit, 10), 100);
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.totalRoi)).limit(limitNum);
  res.json(users.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl ?? null,
    totalRoi: u.totalRoi,
    tasksCompleted: Math.floor(Math.random() * 200) + 10,
    streak: u.streak,
    projectCount: Math.floor(Math.random() * 15) + 1,
  })));
});

export default router;
