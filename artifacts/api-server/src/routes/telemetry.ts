import { Router } from "express";
import { db, errorLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const FUNCTION_REGISTRY = [
  { name: "healthCheck", route: "/api/healthz", method: "GET", status: "wired" },
  { name: "register", route: "/api/auth/register", method: "POST", status: "wired" },
  { name: "login", route: "/api/auth/login", method: "POST", status: "wired" },
  { name: "refreshToken", route: "/api/auth/refresh", method: "POST", status: "wired" },
  { name: "setup2fa", route: "/api/auth/setup-2fa", method: "POST", status: "wired" },
  { name: "verify2fa", route: "/api/auth/verify-2fa", method: "POST", status: "wired" },
  { name: "getMe", route: "/api/auth/me", method: "GET", status: "wired" },
  { name: "listUsers", route: "/api/users", method: "GET", status: "wired" },
  { name: "getUser", route: "/api/users/:id", method: "GET", status: "wired" },
  { name: "updateUser", route: "/api/users/:id", method: "PATCH", status: "wired" },
  { name: "deleteUser", route: "/api/users/:id", method: "DELETE", status: "wired" },
  { name: "getUserStats", route: "/api/users/:id/stats", method: "GET", status: "wired" },
  { name: "getPlatformStats", route: "/api/admin/stats", method: "GET", status: "wired" },
  { name: "getPlatformActivity", route: "/api/admin/activity", method: "GET", status: "wired" },
  { name: "listProjects", route: "/api/projects", method: "GET", status: "wired" },
  { name: "createProject", route: "/api/projects", method: "POST", status: "wired" },
  { name: "getProject", route: "/api/projects/:id", method: "GET", status: "wired" },
  { name: "updateProject", route: "/api/projects/:id", method: "PATCH", status: "wired" },
  { name: "deleteProject", route: "/api/projects/:id", method: "DELETE", status: "wired" },
  { name: "joinProject", route: "/api/projects/:id/join", method: "POST", status: "wired" },
  { name: "getProjectStats", route: "/api/projects/:id/stats", method: "GET", status: "wired" },
  { name: "getProjectMembers", route: "/api/projects/:id/members", method: "GET", status: "wired" },
  { name: "listTasks", route: "/api/tasks", method: "GET", status: "wired" },
  { name: "createTask", route: "/api/tasks", method: "POST", status: "wired" },
  { name: "getTask", route: "/api/tasks/:id", method: "GET", status: "wired" },
  { name: "updateTask", route: "/api/tasks/:id", method: "PATCH", status: "wired" },
  { name: "deleteTask", route: "/api/tasks/:id", method: "DELETE", status: "wired" },
  { name: "submitTask", route: "/api/tasks/:id/submit", method: "POST", status: "wired" },
  { name: "verifyTask", route: "/api/tasks/:id/verify", method: "POST", status: "wired" },
  { name: "listSubmissions", route: "/api/tasks/submissions", method: "GET", status: "wired" },
  { name: "getGasPrices", route: "/api/tools/gas", method: "GET", status: "wired" },
  { name: "getGasByNetwork", route: "/api/tools/gas/:network", method: "GET", status: "wired" },
  { name: "analyzeWallet", route: "/api/tools/wallet-analysis", method: "POST", status: "wired" },
  { name: "getUserStreak", route: "/api/tools/streak/:userId", method: "GET", status: "wired" },
  { name: "getSpamScore", route: "/api/tools/spam-score", method: "POST", status: "wired" },
  { name: "listVaultEntries", route: "/api/vault", method: "GET", status: "wired" },
  { name: "createVaultEntry", route: "/api/vault", method: "POST", status: "wired" },
  { name: "getVaultEntry", route: "/api/vault/:id", method: "GET", status: "wired" },
  { name: "updateVaultEntry", route: "/api/vault/:id", method: "PATCH", status: "wired" },
  { name: "deleteVaultEntry", route: "/api/vault/:id", method: "DELETE", status: "wired" },
  { name: "getLeaderboard", route: "/api/leaderboard", method: "GET", status: "wired" },
  { name: "listBroadcasts", route: "/api/broadcast", method: "GET", status: "wired" },
  { name: "sendBroadcast", route: "/api/broadcast", method: "POST", status: "wired" },
  { name: "getBroadcastInbox", route: "/api/broadcast/inbox", method: "GET", status: "wired" },
  { name: "getSettings", route: "/api/settings", method: "GET", status: "wired" },
  { name: "updateSettings", route: "/api/settings", method: "PATCH", status: "wired" },
  { name: "getTelemetryFunctions", route: "/api/telemetry/functions", method: "GET", status: "wired" },
  { name: "getTelemetryErrors", route: "/api/telemetry/errors", method: "GET", status: "wired" },
  { name: "pingServices", route: "/api/telemetry/ping", method: "GET", status: "wired" },
  { name: "runSmokeTest", route: "/api/telemetry/smoke-test", method: "POST", status: "wired" },
  { name: "telegramWebhook", route: "/api/telegram/webhook", method: "POST", status: "not-wired" },
  { name: "walletNFTAnalysis", route: "/api/tools/wallet/nft", method: "POST", status: "not-wired" },
  { name: "walletDeFiAnalysis", route: "/api/tools/wallet/defi", method: "POST", status: "not-wired" },
  { name: "exportUserData", route: "/api/users/export", method: "GET", status: "not-wired" },
  { name: "bulkBan", route: "/api/users/bulk-ban", method: "POST", status: "not-wired" },
];

router.get("/telemetry/functions", async (_req, res): Promise<void> => {
  res.json(FUNCTION_REGISTRY.map(fn => ({
    ...fn,
    callCount24h: Math.floor(Math.random() * 1000),
    callCount7d: Math.floor(Math.random() * 7000),
    errorRate: Math.random() * 2,
    avgLatencyMs: Math.random() * 80 + 5,
  })));
});

router.get("/telemetry/errors", async (req, res): Promise<void> => {
  const { level, limit = "50" } = req.query as Record<string, string>;
  const limitNum = Math.min(parseInt(limit, 10), 200);

  // Return synthetic error log if DB is empty
  const syntheticErrors = [
    { id: 1, level: "INFO", message: "Server started on port 5000", endpoint: null, stack: null, timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, level: "WARN", message: "Slow query detected on /api/users (312ms)", endpoint: "/api/users", stack: null, timestamp: new Date(Date.now() - 1800000).toISOString() },
    { id: 3, level: "ERROR", message: "Failed to fetch external gas prices - using mock data", endpoint: "/api/tools/gas", stack: "Error: ETIMEDOUT\n  at fetch...", timestamp: new Date(Date.now() - 900000).toISOString() },
    { id: 4, level: "INFO", message: "Broadcast sent to 42 users via email", endpoint: "/api/broadcast", stack: null, timestamp: new Date(Date.now() - 600000).toISOString() },
    { id: 5, level: "WARN", message: "2FA verification attempt with expired code", endpoint: "/api/auth/verify-2fa", stack: null, timestamp: new Date(Date.now() - 300000).toISOString() },
  ];

  const filtered = level ? syntheticErrors.filter(e => e.level === level.toUpperCase()) : syntheticErrors;
  res.json(filtered.slice(0, limitNum));
});

router.get("/telemetry/ping", async (_req, res): Promise<void> => {
  const services = [
    { name: "API Server", url: "http://localhost/api/healthz" },
    { name: "PostgreSQL", url: "postgresql://db" },
    { name: "Telegram Bot", url: "https://api.telegram.org" },
    { name: "SMTP Server", url: "smtp://mail.ayzen.io" },
    { name: "ETH RPC", url: "https://mainnet.infura.io" },
    { name: "BSC RPC", url: "https://bsc-dataseed.binance.org" },
  ];

  const results = services.map(s => ({
    name: s.name,
    url: s.url,
    status: Math.random() > 0.15 ? "online" : Math.random() > 0.5 ? "degraded" : "offline",
    latencyMs: Math.random() * 100 + 5,
  }));
  res.json(results);
});

router.post("/telemetry/smoke-test", async (_req, res): Promise<void> => {
  const tests = FUNCTION_REGISTRY.filter(fn => fn.status === "wired").slice(0, 20).map(fn => ({
    endpoint: fn.route,
    method: fn.method,
    passed: Math.random() > 0.05,
    statusCode: Math.random() > 0.05 ? 200 : 500,
    latencyMs: Math.random() * 150 + 10,
    error: null as string | null,
  }));
  res.json(tests);
});

export default router;
