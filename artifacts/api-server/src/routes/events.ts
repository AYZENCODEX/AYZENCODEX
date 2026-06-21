import { Router, Request, Response } from "express";
import { getUserIdSync } from "../lib/auth-utils";

const router = Router();

interface SSEClient {
  id: string;
  userId: number;
  res: Response;
}

const clients: SSEClient[] = [];

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

router.get("/events", (req: Request, res: Response) => {
  const userId = getUserIdSync(req);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = `${userId}-${Date.now()}`;
  const client: SSEClient = { id: clientId, userId, res };
  clients.push(client);

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, userId })}\n\n`);

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
  });
});

export default router;
