import { Router } from "express";
import { pool } from "@workspace/db";
import { requireRoles } from "../middlewares/auth";
import { exec } from "child_process";
import { promisify } from "util";

const router = Router();
const requireAdmin = requireRoles("admin", "dev");
const execAsync = promisify(exec);

// ── Model catalogues ──────────────────────────────────────────────────────────
const OPENAI_MODELS = [
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", ctx: 128000 },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", ctx: 128000 },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "openai", ctx: 128000 },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "openai", ctx: 16385 },
];
const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B", provider: "groq", ctx: 131072 },
  { id: "llama-3.1-8b-instant", label: "LLaMA 3.1 8B Instant", provider: "groq", ctx: 131072 },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: "groq", ctx: 32768 },
  { id: "gemma2-9b-it", label: "Gemma 2 9B", provider: "groq", ctx: 8192 },
];
const OPENROUTER_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", provider: "openrouter", ctx: 200000 },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku", provider: "openrouter", ctx: 200000 },
  { id: "google/gemini-pro-1.5", label: "Gemini Pro 1.5", provider: "openrouter", ctx: 2000000 },
  { id: "meta-llama/llama-3.2-90b-vision-instruct", label: "LLaMA 3.2 90B Vision", provider: "openrouter", ctx: 131072 },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1", provider: "openrouter", ctx: 65536 },
  { id: "mistralai/mistral-large", label: "Mistral Large", provider: "openrouter", ctx: 131072 },
  { id: "x-ai/grok-beta", label: "Grok Beta", provider: "openrouter", ctx: 131072 },
];

// ── MCP-style tools available to the AI agent ─────────────────────────────────
async function runTool(toolName: string, input: Record<string, any>): Promise<string> {
  switch (toolName) {
    case "execute_sql": {
      const { query } = input;
      if (!query) return "Error: query is required";
      const dangerous = /drop table|truncate|delete from users|update users set role/i;
      if (dangerous.test(query)) return "Error: Destructive query blocked. Use specific WHERE clauses.";
      try {
        const r = await pool.query(query);
        return JSON.stringify({ rows: r.rows.slice(0, 100), rowCount: r.rowCount });
      } catch (e: any) { return `SQL Error: ${e.message}`; }
    }
    case "execute_shell": {
      const { command } = input;
      if (!command) return "Error: command is required";
      const blocked = /rm -rf|mkfs|dd if|:(){ :|:& };:|shutdown|reboot/;
      if (blocked.test(command)) return "Error: Command blocked for safety.";
      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 10000, cwd: process.cwd() });
        return stdout || stderr || "(no output)";
      } catch (e: any) { return `Shell Error: ${e.message}`; }
    }
    case "query_logs": {
      const { level, limit = 20 } = input;
      try {
        let q = "SELECT route, method, status_code, duration_ms, recorded_at FROM request_metrics";
        if (level === "error") q += " WHERE status_code >= 500";
        else if (level === "warn") q += " WHERE status_code >= 400";
        q += ` ORDER BY recorded_at DESC LIMIT ${Number(limit)}`;
        const r = await pool.query(q);
        return JSON.stringify(r.rows);
      } catch (e: any) { return `Log Error: ${e.message}`; }
    }
    case "get_platform_stats": {
      try {
        const [users, projects, tasks, revenue] = await Promise.all([
          pool.query("SELECT COUNT(*) as cnt FROM users"),
          pool.query("SELECT COUNT(*) as cnt FROM projects WHERE status='active'"),
          pool.query("SELECT COUNT(*) as cnt FROM tasks"),
          pool.query("SELECT SUM(azn_amount) as total FROM credit_transactions WHERE status='approved'"),
        ]);
        return JSON.stringify({
          total_users: users.rows[0].cnt,
          active_projects: projects.rows[0].cnt,
          total_tasks: tasks.rows[0].cnt,
          total_revenue_azn: revenue.rows[0].total ?? 0,
        });
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    case "list_tables": {
      try {
        const r = await pool.query(`
          SELECT table_name, 
                 (SELECT COUNT(*) FROM information_schema.columns WHERE table_name=t.table_name) as col_count
          FROM information_schema.tables t
          WHERE table_schema='public' ORDER BY table_name
        `);
        return JSON.stringify(r.rows);
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    default:
      return `Unknown tool: ${toolName}`;
  }
}

async function callLLM(settings: any, messages: any[], tools: any[]): Promise<{ content: string; toolCalls?: any[] }> {
  const openaiKey = process.env["OPENAI_API_KEY"];
  const groqKey = process.env["GROQ_API_KEY"];
  const openrouterKey = process.env["OPENROUTER_API_KEY"];

  const router = settings.router ?? "openai";
  const model = settings.model ?? "gpt-4o-mini";
  const systemPrompt = settings.system_prompt ?? "You are AYZEN AI Agent, an autonomous assistant for the AYZEN platform admin.";

  let baseUrl = "https://api.openai.com/v1";
  let apiKey = openaiKey;
  if (router === "groq") { baseUrl = "https://api.groq.com/openai/v1"; apiKey = groqKey; }
  else if (router === "openrouter") { baseUrl = "https://openrouter.ai/api/v1"; apiKey = openrouterKey; }

  if (!apiKey) {
    return { content: `⚠️ No API key configured for ${router}. Please set ${router.toUpperCase()}_API_KEY in environment settings.` };
  }

  const systemMessages = [{ role: "system", content: systemPrompt }];
  const body: any = {
    model,
    messages: [...systemMessages, ...messages],
    temperature: settings.temperature ?? 0.7,
    max_tokens: settings.max_tokens ?? 4096,
  };

  const toolsEnabled = JSON.parse(settings.tools_enabled ?? "{}");
  if (Object.values(toolsEnabled).some(Boolean) && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { content: `API Error (${resp.status}): ${err}` };
  }

  const data = await resp.json() as any;
  const msg = data.choices?.[0]?.message;
  if (msg?.tool_calls?.length) {
    return { content: msg.content ?? "", toolCalls: msg.tool_calls };
  }
  return { content: msg?.content ?? "" };
}

const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_sql",
      description: "Execute a read SQL query on the AYZEN database. Destructive queries are blocked.",
      parameters: { type: "object", properties: { query: { type: "string", description: "SQL query to execute" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_shell",
      description: "Run a shell command in the server environment.",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
    },
  },
  {
    type: "function",
    function: {
      name: "query_logs",
      description: "Query recent request metrics and logs.",
      parameters: { type: "object", properties: { level: { type: "string", enum: ["all", "error", "warn"] }, limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "get_platform_stats",
      description: "Get current platform statistics: users, projects, tasks, revenue.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description: "List all database tables with column counts.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ── 1. POST /admin/ai-agent/chat ──────────────────────────────────────────────
router.post("/admin/ai-agent/chat", requireAdmin, async (req, res): Promise<void> => {
  const { message, session_id = "default", history = [] } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }
  try {
    const settingsR = await pool.query("SELECT * FROM ai_agent_settings WHERE id=1");
    const settings = settingsR.rows[0] ?? {};
    const toolsEnabled = JSON.parse(settings.tools_enabled ?? '{"shell":true,"database":true,"console":true}');
    const enabledTools = AGENT_TOOLS.filter(t => {
      if (t.function.name === "execute_shell" && !toolsEnabled.shell) return false;
      if (t.function.name === "execute_sql" && !toolsEnabled.database) return false;
      if (t.function.name === "query_logs" && !toolsEnabled.console) return false;
      return true;
    });

    await pool.query(
      "INSERT INTO ai_agent_messages (session_id, role, content) VALUES ($1, 'user', $2)",
      [session_id, message]
    );

    const messages = [...history, { role: "user", content: message }];
    let finalContent = "";
    const toolResults: any[] = [];
    let totalTokens = 0;

    const result = await callLLM(settings, messages, enabledTools);
    if (result.toolCalls?.length) {
      for (const tc of result.toolCalls) {
        const fn = tc.function;
        let input: any = {};
        try { input = JSON.parse(fn.arguments ?? "{}"); } catch {}
        const toolOutput = await runTool(fn.name, input);
        toolResults.push({ tool: fn.name, input, output: toolOutput });
        messages.push({ role: "assistant", content: result.content ?? "", tool_calls: result.toolCalls });
        messages.push({ role: "tool", tool_call_id: tc.id, content: toolOutput });
      }
      const final = await callLLM(settings, messages, []);
      finalContent = final.content;
    } else {
      finalContent = result.content;
    }

    await pool.query(
      `INSERT INTO ai_agent_messages (session_id, role, content, tool_name, tool_input, tool_output, tokens_used)
       VALUES ($1, 'assistant', $2, $3, $4, $5, $6)`,
      [session_id, finalContent,
       toolResults.length ? toolResults.map(t => t.tool).join(",") : null,
       toolResults.length ? JSON.stringify(toolResults.map(t => t.input)) : null,
       toolResults.length ? JSON.stringify(toolResults.map(t => t.output)) : null,
       totalTokens]
    );

    res.json({ content: finalContent, tool_calls: toolResults, session_id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 2. GET /admin/ai-agent/settings ──────────────────────────────────────────
router.get("/admin/ai-agent/settings", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const r = await pool.query("SELECT * FROM ai_agent_settings WHERE id=1");
    const s = r.rows[0] ?? {};
    res.json({
      router: s.router ?? "openai",
      model: s.model ?? "gpt-4o-mini",
      system_prompt: s.system_prompt ?? "",
      temperature: s.temperature ?? 0.7,
      max_tokens: s.max_tokens ?? 4096,
      tools_enabled: JSON.parse(s.tools_enabled ?? '{"shell":true,"database":true,"console":true}'),
      workflow: JSON.parse(s.workflow ?? "{}"),
      updated_at: s.updated_at,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 3. PUT /admin/ai-agent/settings ──────────────────────────────────────────
router.put("/admin/ai-agent/settings", requireAdmin, async (req, res): Promise<void> => {
  const { router: r, model, system_prompt, temperature, max_tokens, tools_enabled, workflow } = req.body;
  try {
    await pool.query(`
      UPDATE ai_agent_settings SET
        router = COALESCE($1, router),
        model = COALESCE($2, model),
        system_prompt = COALESCE($3, system_prompt),
        temperature = COALESCE($4, temperature),
        max_tokens = COALESCE($5, max_tokens),
        tools_enabled = COALESCE($6, tools_enabled),
        workflow = COALESCE($7, workflow),
        updated_at = NOW()
      WHERE id = 1
    `, [r ?? null, model ?? null, system_prompt ?? null,
        temperature ?? null, max_tokens ?? null,
        tools_enabled ? JSON.stringify(tools_enabled) : null,
        workflow ? JSON.stringify(workflow) : null]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 4. GET /admin/ai-agent/models ────────────────────────────────────────────
router.get("/admin/ai-agent/models", requireAdmin, async (_req, res): Promise<void> => {
  res.json({
    openai: OPENAI_MODELS,
    groq: GROQ_MODELS,
    openrouter: OPENROUTER_MODELS,
  });
});

// ── 5. GET /admin/ai-agent/history ───────────────────────────────────────────
router.get("/admin/ai-agent/history", requireAdmin, async (req, res): Promise<void> => {
  const { session_id = "default", limit = 100 } = req.query as any;
  try {
    const r = await pool.query(
      `SELECT id, role, content, tool_name, tool_output, tokens_used, created_at
       FROM ai_agent_messages WHERE session_id=$1 ORDER BY created_at ASC LIMIT $2`,
      [session_id, Number(limit)]
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 6. DELETE /admin/ai-agent/history ────────────────────────────────────────
router.delete("/admin/ai-agent/history", requireAdmin, async (req, res): Promise<void> => {
  const { session_id = "default" } = req.query as any;
  try {
    await pool.query("DELETE FROM ai_agent_messages WHERE session_id=$1", [session_id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
