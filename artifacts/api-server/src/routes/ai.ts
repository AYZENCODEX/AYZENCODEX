import { Router } from "express";
import { db, vaultEntriesTable, usersTable, userProjectsTable, projectsTable, taskSubmissionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ── Groq free-tier model catalogue (June 2025) ────────────────────────────
export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile",                     name: "Llama 3.3 70B Versatile",       context: 128000, free: true,  tier: "recommended",  speed: "fast" },
  { id: "llama-3.1-8b-instant",                         name: "Llama 3.1 8B Instant",           context: 131072, free: true,  tier: "recommended",  speed: "ultra-fast" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct",   name: "Llama 4 Scout 17B",              context: 131072, free: true,  tier: "recommended",  speed: "fast" },
  { id: "llama3-70b-8192",                              name: "Llama 3 70B",                    context: 8192,   free: true,  tier: "stable",       speed: "fast" },
  { id: "llama3-8b-8192",                               name: "Llama 3 8B",                     context: 8192,   free: true,  tier: "stable",       speed: "ultra-fast" },
  { id: "gemma2-9b-it",                                 name: "Gemma 2 9B IT",                  context: 8192,   free: true,  tier: "stable",       speed: "fast" },
  { id: "qwen-qwq-32b",                                 name: "Qwen QwQ 32B",                   context: 131072, free: true,  tier: "reasoning",    speed: "medium" },
  { id: "deepseek-r1-distill-llama-70b",                name: "DeepSeek R1 Distill 70B",        context: 131072, free: true,  tier: "reasoning",    speed: "medium" },
  { id: "llama-3.3-70b-specdec",                        name: "Llama 3.3 70B SpecDec",          context: 8192,   free: true,  tier: "experimental", speed: "fast" },
  { id: "llama-guard-3-8b",                             name: "Llama Guard 3 8B",               context: 8192,   free: true,  tier: "safety",       speed: "fast" },
];

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const BASE_SYSTEM = `You are AYZEN AI — a dedicated crypto airdrop intelligence assistant built exclusively for the AYZEN Airdrop Command Center.

You have DIRECT ACCESS to the user's live account data (injected below). Answer questions about:
- Their vault credential entities (wallets, emails, socials per airdrop project)
- Their enrolled projects and airdrop participation  
- Completed tasks, submission history, ROI, streak
- General crypto: airdrops, DeFi, L2 networks, gas optimization, sybil avoidance

Rules:
- When asked about their data ("my accounts", "my vault", "my wallets", "show my credentials"), refer to the injected context
- Never fabricate credentials — only report what's in the context
- Be concise, direct, and crypto-native
- Use $TICKER symbols when relevant`;

function buildContext(user: any, vault: any[], projects: any[], tasks: any[]): string {
  const lines = ["\n\n══ LIVE USER CONTEXT FROM AYZEN DB ══"];
  lines.push(`Operator: ${user.username} | Streak: ${user.streak}d | Total ROI: $${user.totalRoi} | Role: ${user.role}`);

  if (vault.length) {
    lines.push(`\n📂 Vault Entities (${vault.length} total):`);
    vault.slice(0, 25).forEach(e => {
      lines.push(`  [${e.entitySerial}] ${e.projectName} — ${e.category}`);
      if (e.email) lines.push(`    ✉ ${e.email}`);
      if (e.twitterUsername) lines.push(`    🐦 @${e.twitterUsername}`);
      if (e.discordUsername) lines.push(`    💬 ${e.discordUsername}`);
      if (e.telegramUsername) lines.push(`    📱 @${e.telegramUsername}`);
      const wallets: string[] = e.walletAddresses ? JSON.parse(e.walletAddresses) : [];
      if (wallets.length) lines.push(`    👛 ${wallets.join(" | ")}`);
      if (e.notes) lines.push(`    📝 ${e.notes}`);
    });
    if (vault.length > 25) lines.push(`  … +${vault.length - 25} more entities`);
  } else {
    lines.push("\n📂 Vault: No entities yet.");
  }

  if (projects.length) {
    lines.push(`\n🚀 Enrolled Projects (${projects.length}):`);
    projects.slice(0, 15).forEach(p => {
      lines.push(`  • ${p.name} | Tier: ${p.tier} | Est. Reward: $${p.rewardEstimate ?? "TBD"}`);
    });
  } else {
    lines.push("\n🚀 Projects: Not enrolled yet.");
  }

  if (tasks.length) {
    lines.push(`\n✅ Recent Task Submissions:`);
    tasks.slice(0, 8).forEach(t => {
      lines.push(`  • Task #${t.taskId} | ${t.status} | $${t.rewardAmount ?? "?"}`);
    });
  }

  lines.push("══════════════════════════════════════");
  return lines.join("\n");
}

function getAuth(req: any): { userId: number; role: string } {
  const auth = req.headers.authorization as string | undefined;
  if (!auth) return { userId: 1, role: "user" };
  try {
    const p = JSON.parse(Buffer.from(auth.replace("Bearer ", ""), "base64").toString());
    return { userId: p.userId ?? 1, role: p.role ?? "user" };
  } catch { return { userId: 1, role: "user" }; }
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!groqKey && !openRouterKey) {
    res.status(503).json({ error: "AI not configured. Add GROQ_API_KEY or OPENROUTER_API_KEY." });
    return;
  }

  const { messages, model } = req.body;
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  const { userId } = getAuth(req);

  // Fetch live user context
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const vault = await db.select().from(vaultEntriesTable).where(eq(vaultEntriesTable.userId, userId));
  const projects = await db
    .select({ name: projectsTable.name, tier: projectsTable.tier, rewardEstimate: projectsTable.rewardEstimate })
    .from(userProjectsTable)
    .innerJoin(projectsTable, eq(userProjectsTable.projectId, projectsTable.id))
    .where(eq(userProjectsTable.userId, userId));
  const tasks = await db.select().from(taskSubmissionsTable)
    .where(eq(taskSubmissionsTable.userId, userId))
    .orderBy(desc(taskSubmissionsTable.createdAt))
    .limit(10);

  const systemPrompt = BASE_SYSTEM + (user ? buildContext(user, vault, projects, tasks) : "");
  const selectedModel = (model && GROQ_MODELS.find(m => m.id === model)) ? model : DEFAULT_MODEL;
  const allMessages = [{ role: "system", content: systemPrompt }, ...messages.slice(-20)];

  if (groqKey) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, messages: allMessages, max_tokens: 1024 }),
    });
    const data = await response.json();
    res.json({ ...data, _model: selectedModel });
    return;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openRouterKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://ayzen.tech" },
    body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages: allMessages, max_tokens: 1024 }),
  });
  const data = await response.json();
  res.json({ ...data, _model: "llama-3.3-70b (OpenRouter)" });
});

// ── Model catalogue endpoint ───────────────────────────────────────────────
router.get("/ai/models", (_req, res) => {
  res.json(GROQ_MODELS);
});

export default router;
