import { Router, Request, Response } from "express";
import { getUserIdSync } from "../lib/auth-utils";

const router = Router();

interface SSEClient {
  id: string;
  userId: number;
  res: Response;
  connectedAt: number;
  projectId?: number;
}

const clients: SSEClient[] = [];

// ─── Presence: projectId → Set of userIds ─────────────────────────────────────
const projectPresence = new Map<number, Set<number>>();

export function broadcastEvent(event: string, data: Record<string, unknown> = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, ts: Date.now() })}\n\n`;
  for (let i = clients.length - 1; i >= 0; i--) {
    try {
      clients[i].res.write(payload);
    } catch {
      clients.splice(i, 1);
    }
  }
}

export function broadcastToProject(projectId: number, event: string, data: Record<string, unknown> = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, projectId, ts: Date.now() })}\n\n`;
  for (let i = clients.length - 1; i >= 0; i--) {
    if (clients[i].projectId === projectId) {
      try {
        clients[i].res.write(payload);
      } catch {
        clients.splice(i, 1);
      }
    }
  }
}

export function getActiveConnectionCount() { return clients.length; }
export function getProjectPresence(projectId: number) { return [...(projectPresence.get(projectId) ?? [])]; }
export function getAllProjectPresence() {
  const result: Record<number, number> = {};
  projectPresence.forEach((users, pid) => { result[pid] = users.size; });
  return result;
}

// ─── SSE endpoint ─────────────────────────────────────────────────────────────
router.get("/events", (req: Request, res: Response) => {
  const userId = getUserIdSync(req);
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = `${userId}-${Date.now()}`;
  const client: SSEClient = { id: clientId, userId, res, connectedAt: Date.now(), projectId };
  clients.push(client);

  // Join project presence if specified
  if (projectId) {
    if (!projectPresence.has(projectId)) projectPresence.set(projectId, new Set());
    projectPresence.get(projectId)!.add(userId);
    broadcastToProject(projectId, "presence_updated", { projectId, online: getProjectPresence(projectId) });
  }

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, userId, projectId })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx !== -1) clients.splice(idx, 1);

    if (projectId) {
      projectPresence.get(projectId)?.delete(userId);
      if (projectPresence.get(projectId)?.size === 0) projectPresence.delete(projectId);
      else broadcastToProject(projectId, "presence_updated", { projectId, online: getProjectPresence(projectId) });
    }
  });
});

// ─── Project presence REST endpoint ──────────────────────────────────────────
router.get("/projects/:id/presence", (req: Request, res: Response) => {
  const id = Number(req.params[Array.isArray(req.params) ? 0 : "id"]);
  res.json({ projectId: id, online: getProjectPresence(id), count: getProjectPresence(id).length });
});

export default router;
