import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── GET /entities/:id/summary — entity across all projects ───────────────────
router.get("/entities/:id/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const entityId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const entityResult = await db.execute(sql.raw(
    `SELECT * FROM vault_entries WHERE id = ${entityId} AND user_id = ${userId}`
  ));
  if (!entityResult.rows.length) { res.status(404).json({ error: "Entity not found" }); return; }
  const entity = entityResult.rows[0] as any;

  const roiResult = await db.execute(sql.raw(
    `SELECT epr.*, p.name as project_name, p.type as project_type, p.status as project_status
     FROM entity_project_roi epr
     JOIN projects p ON p.id = epr.project_id
     WHERE epr.entity_id = ${entityId}
     ORDER BY epr.roi_amount DESC`
  ));

  const rows = roiResult.rows as any[];
  const totalRoi = rows.reduce((s: number, r: any) => s + (parseFloat(r.roi_amount) || 0), 0);
  const avgProgress = rows.length ? rows.reduce((s: number, r: any) => s + (parseFloat(r.progress_percent) || 0), 0) / rows.length : 0;

  const enrollResult = await db.execute(sql.raw(
    `SELECT pe.*, p.name as project_name, p.category
     FROM project_enrollments pe
     JOIN projects p ON p.id = pe.project_id
     WHERE pe.vault_entry_id = ${entityId}
     ORDER BY pe.enrolled_at DESC`
  )).catch(() => ({ rows: [] }));

  res.json({
    entity,
    roi: {
      total: totalRoi,
      avgProgress,
      projectCount: rows.length,
      projects: rows,
    },
    enrollments: (enrollResult as any).rows,
  });
});

// ── GET /entities/:id/health — evaluate health rules ────────────────────────
router.get("/entities/:id/health", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const entityId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [entityResult, rulesResult] = await Promise.all([
    db.execute(sql.raw(`SELECT * FROM vault_entries WHERE id = ${entityId} AND user_id = ${userId}`)),
    db.execute(sql.raw(`SELECT * FROM health_rules WHERE enabled = true ORDER BY severity ASC`)),
  ]);

  if (!entityResult.rows.length) { res.status(404).json({ error: "Entity not found" }); return; }
  const entity = entityResult.rows[0] as any;
  const rules = rulesResult.rows as any[];

  const flags: { rule_key: string; severity: string; message: string }[] = [];

  for (const rule of rules) {
    const key = rule.rule_key as string;
    const threshold = parseInt(rule.threshold_value ?? "30", 10);

    if (key === "missing_2fa") {
      const has2fa = entity.twitter_2fa || entity.discord_2fa || entity.telegram_2fa;
      if (!has2fa) flags.push({ rule_key: key, severity: rule.severity, message: "No 2FA codes configured" });
    } else if (key === "missing_wallet") {
      const wallets = entity.wallet_addresses ? JSON.parse(entity.wallet_addresses) : [];
      if (!wallets.length) flags.push({ rule_key: key, severity: rule.severity, message: "No wallet addresses linked" });
    } else if (key === "inactive_days") {
      const last = entity.last_activity_at ? new Date(entity.last_activity_at) : new Date(entity.created_at);
      const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > threshold) flags.push({ rule_key: key, severity: rule.severity, message: `Inactive for ${Math.floor(diffDays)} days` });
    } else if (key === "missing_email") {
      if (!entity.email) flags.push({ rule_key: key, severity: rule.severity, message: "No email configured" });
    }
  }

  const worstSeverity = flags.some(f => f.severity === "critical") ? "critical"
    : flags.some(f => f.severity === "warning") ? "warning" : "healthy";

  const badge = worstSeverity === "critical" ? "🔴" : worstSeverity === "warning" ? "🟡" : "🟢";

  res.json({ entityId, status: worstSeverity, badge, flags, currentStatus: entity.status ?? "active" });
});

// ── GET /entities/health-overview — aggregate health across all entities ─────
router.get("/entities/health-overview", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [entitiesResult, rulesResult] = await Promise.all([
    db.execute(sql.raw(`SELECT * FROM vault_entries WHERE user_id = ${userId}`)),
    db.execute(sql.raw(`SELECT * FROM health_rules WHERE enabled = true`)),
  ]);

  const entities = entitiesResult.rows as any[];
  const rules = rulesResult.rows as any[];

  let missing2fa = 0, missingWallet = 0, missingEmail = 0, inactive = 0;
  for (const e of entities) {
    const has2fa = e.twitter_2fa || e.discord_2fa || e.telegram_2fa;
    if (!has2fa) missing2fa++;
    const wallets = (() => { try { return JSON.parse(e.wallet_addresses || "[]"); } catch { return []; } })();
    if (!wallets.length) missingWallet++;
    if (!e.email) missingEmail++;
    const inactiveRule = rules.find((r: any) => r.rule_key === "inactive_days");
    if (inactiveRule) {
      const threshold = parseInt(inactiveRule.threshold_value ?? "30", 10);
      const last = e.last_activity_at ? new Date(e.last_activity_at) : new Date(e.created_at);
      const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > threshold) inactive++;
    }
  }

  res.json({
    total: entities.length,
    missing2fa,
    missingWallet,
    missingEmail,
    inactive,
  });
});

// ── GET /entities/:id/roi — ROI for this entity ──────────────────────────────
router.get("/entities/:id/roi", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const entityId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const entityCheck = await db.execute(sql.raw(`SELECT id FROM vault_entries WHERE id = ${entityId} AND user_id = ${userId}`));
  if (!entityCheck.rows.length) { res.status(403).json({ error: "Forbidden" }); return; }

  const result = await db.execute(sql.raw(
    `SELECT epr.*, p.name as project_name FROM entity_project_roi epr
     JOIN projects p ON p.id = epr.project_id WHERE epr.entity_id = ${entityId}`
  ));
  res.json(result.rows);
});

// ── POST /entities/:id/roi — upsert ROI for entity+project ──────────────────
router.post("/entities/:id/roi", requireAuth, async (req, res): Promise<void> => {
  const entityId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { projectId, roiAmount = 0, progressPercent = 0 } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const result = await db.execute(sql.raw(
    `INSERT INTO entity_project_roi (entity_id, project_id, roi_amount, progress_percent)
     VALUES (${entityId}, ${projectId}, ${roiAmount}, ${progressPercent})
     ON CONFLICT (entity_id, project_id)
     DO UPDATE SET roi_amount = ${roiAmount}, progress_percent = ${progressPercent}, last_updated_at = NOW()
     RETURNING *`
  ));
  res.json(result.rows[0]);
});

// ── PATCH /entities/:id/status — update status ───────────────────────────────
router.patch("/entities/:id/status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const entityId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { status } = req.body;
  const allowed = ["active", "warning", "banned", "suspended"];
  if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const result = await db.execute(sql.raw(
    `UPDATE vault_entries SET status = '${status}', last_activity_at = NOW()
     WHERE id = ${entityId} AND user_id = ${userId} RETURNING *`
  ));
  if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.rows[0]);
});

export default router;
