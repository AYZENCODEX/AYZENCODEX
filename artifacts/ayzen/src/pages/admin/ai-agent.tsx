import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bot, Send, Settings, Cpu, Terminal, Database, Trash2,
  RefreshCw, ChevronDown, ChevronRight, Save, Zap,
  CheckCircle2, XCircle, Loader2, Code2, Server,
  ShieldCheck, Sparkles, Globe, Key,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const token = () => localStorage.getItem("ayzen_token") ?? "";
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(opts?.headers ?? {}) } });

type Tab = "chat" | "models" | "settings";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { tool: string; input: any; output: string }[];
  created_at?: string;
}

const ROUTER_CONFIG = {
  openai:     { label: "OpenAI",       icon: Zap,       color: "text-emerald-400", description: "GPT-4o, GPT-4o-mini" },
  groq:       { label: "Groq",         icon: Cpu,       color: "text-amber-400",   description: "LLaMA, Mixtral (ultra-fast)" },
  openrouter: { label: "OpenRouter",   icon: Globe,     color: "text-violet-400",  description: "100+ models via proxy" },
};

function ToolCallExpander({ calls }: { calls: { tool: string; input: any; output: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border border-primary/20 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-3 py-2 bg-primary/5 hover:bg-primary/10 transition-colors">
        <Code2 className="w-3 h-3 text-primary/60" />
        <span className="font-mono text-[10px] text-primary/70 flex-1 text-left">{calls.length} tool call{calls.length > 1 ? "s" : ""} executed</span>
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground/40" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
      </button>
      {open && (
        <div className="divide-y divide-border/30">
          {calls.map((c, i) => (
            <div key={i} className="p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-3 h-3 text-amber-400" />
                <span className="font-mono text-[10px] font-bold text-amber-400">{c.tool}</span>
              </div>
              {c.input && <pre className="font-mono text-[9px] text-muted-foreground/70 bg-muted/20 rounded p-2 overflow-x-auto">{JSON.stringify(c.input, null, 2)}</pre>}
              {c.output && <pre className="font-mono text-[9px] text-emerald-400/80 bg-emerald-400/5 border border-emerald-400/10 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">{c.output.length > 1000 ? c.output.slice(0, 1000) + "\n...(truncated)" : c.output}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold",
        isUser ? "bg-primary/20 border border-primary/30 text-primary" : "bg-violet-500/20 border border-violet-400/30 text-violet-400"
      )}>
        {isUser ? "U" : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={cn("flex-1 max-w-[85%]", isUser && "flex flex-col items-end")}>
        <div className={cn("rounded-xl px-4 py-3 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-primary/15 border border-primary/20 text-foreground"
            : "bg-card border border-card-border text-foreground"
        )}>
          {msg.content || <span className="text-muted-foreground/40 italic">...</span>}
        </div>
        {msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className={cn("w-full", isUser && "text-right")}>
            <ToolCallExpander calls={msg.tool_calls} />
          </div>
        )}
        {msg.created_at && (
          <div className="font-mono text-[9px] text-muted-foreground/30 mt-1 px-1">
            {new Date(msg.created_at).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminAiAgent() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => `admin-${Date.now()}`);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Settings state
  const [settings, setSettings] = useState({
    router: "openai",
    model: "gpt-4o-mini",
    system_prompt: "",
    temperature: 0.7,
    max_tokens: 4096,
    tools_enabled: { shell: true, database: true, console: true },
    workflow: {},
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Models state
  const [models, setModels] = useState<Record<string, any[]>>({});
  const [modelsLoading, setModelsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api(`/admin/ai-agent/history?session_id=${sessionId}&limit=50`);
      const msgs = await r.json();
      if (Array.isArray(msgs) && msgs.length > 0) {
        setMessages(msgs.map((m: any) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          tool_calls: m.tool_name ? [{ tool: m.tool_name, input: {}, output: m.tool_output ?? "" }] : undefined,
          created_at: m.created_at,
        })));
      }
    } catch {}
    setHistoryLoaded(true);
  }, [sessionId]);

  const loadSettings = useCallback(async () => {
    try {
      const r = await api("/admin/ai-agent/settings");
      const d = await r.json();
      setSettings(d);
    } catch {}
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const r = await api("/admin/ai-agent/models");
      const d = await r.json();
      setModels(d);
    } catch {}
    setModelsLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    loadSettings();
  }, [loadHistory, loadSettings]);

  useEffect(() => {
    if (tab === "models" && Object.keys(models).length === 0) loadModels();
  }, [tab, models, loadModels]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const thinkingMsg: Message = { id: "thinking", role: "assistant", content: "" };
    setMessages(prev => [...prev, thinkingMsg]);
    try {
      const r = await api("/admin/ai-agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMsg.content, session_id: sessionId, history }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMessages(prev => prev.filter(m => m.id !== "thinking"));
        toast({ variant: "destructive", title: d.error ?? "Agent error" });
      } else {
        const assistantMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: d.content,
          tool_calls: d.tool_calls?.length ? d.tool_calls : undefined,
        };
        setMessages(prev => [...prev.filter(m => m.id !== "thinking"), assistantMsg]);
      }
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== "thinking"));
      toast({ variant: "destructive", title: "Network error" });
    }
    setSending(false);
  };

  const clearHistory = async () => {
    await api(`/admin/ai-agent/history?session_id=${sessionId}`, { method: "DELETE" });
    setMessages([]);
    toast({ title: "History cleared" });
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const r = await api("/admin/ai-agent/settings", { method: "PUT", body: JSON.stringify(settings) });
      const d = await r.json();
      if (r.ok) toast({ title: "Settings saved" });
      else toast({ variant: "destructive", title: d.error });
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    setSavingSettings(false);
  };

  const QUICK_PROMPTS = [
    "How many users are on the platform?",
    "Show me the latest 5 task submissions",
    "What are the top 3 active projects?",
    "List all database tables",
    "Show server uptime and memory usage",
    "Find users with most AZN balance",
  ];

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col space-y-0 -m-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between flex-shrink-0 bg-background">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono font-bold text-base tracking-tight uppercase">AYZEN AI Agent</h1>
              <Badge variant="outline" className="font-mono text-[9px] border-violet-400/30 text-violet-400 bg-violet-400/5">MCP</Badge>
              <Badge variant="outline" className={cn("font-mono text-[9px]", ROUTER_CONFIG[settings.router as keyof typeof ROUTER_CONFIG]?.color, "border-current/30")}>
                {settings.model}
              </Badge>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground/60">Autonomous agent · DB · Shell · Console access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[
            { id: "chat", label: "Chat", icon: Bot },
            { id: "models", label: "Models", icon: Cpu },
            { id: "settings", label: "Settings", icon: Settings },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all border", tab === t.id ? "bg-violet-500/15 text-violet-400 border-violet-400/30" : "text-muted-foreground border-border/30 hover:border-border")}>
              <t.icon className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tools banner */}
          <div className="px-6 py-2 bg-muted/10 border-b border-border/30 flex items-center gap-3 flex-wrap">
            {[
              { key: "database", label: "Database", icon: Database, color: "text-emerald-400" },
              { key: "shell", label: "Shell", icon: Terminal, color: "text-amber-400" },
              { key: "console", label: "Logs", icon: Server, color: "text-primary" },
            ].map(t => (
              <div key={t.key} className={cn("flex items-center gap-1 text-[9px] font-mono", settings.tools_enabled[t.key as keyof typeof settings.tools_enabled] ? t.color : "text-muted-foreground/30 line-through")}>
                <t.icon className="w-2.5 h-2.5" />
                {t.label}
                {settings.tools_enabled[t.key as keyof typeof settings.tools_enabled]
                  ? <CheckCircle2 className="w-2 h-2" />
                  : <XCircle className="w-2 h-2" />}
              </div>
            ))}
            <div className="ml-auto">
              <button onClick={clearHistory} className="font-mono text-[9px] text-muted-foreground/40 hover:text-red-400 flex items-center gap-1 transition-colors">
                <Trash2 className="w-2.5 h-2.5" /> Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {!historyLoaded ? (
              <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 gap-6">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-violet-400/60" />
                </div>
                <div className="text-center">
                  <div className="font-mono text-sm font-bold text-foreground mb-1">AYZEN AI Agent</div>
                  <div className="font-mono text-[11px] text-muted-foreground/60 max-w-sm">
                    Autonomous MCP agent with full database, shell, and log access. Ask anything about your platform.
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} onClick={() => setInput(p)} className="text-left px-3 py-2.5 bg-card border border-card-border hover:border-violet-400/30 rounded-lg font-mono text-[10px] text-muted-foreground hover:text-foreground transition-all">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <ChatBubble key={msg.id} msg={msg.id === "thinking"
                  ? { ...msg, content: "" }
                  : msg}
                />
              ))
            )}
            {sending && messages[messages.length - 1]?.id === "thinking" && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                </div>
                <div className="bg-card border border-card-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-border/30 flex-shrink-0">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask the agent to query, build, or analyze... (Enter to send)"
                className="flex-1 font-mono text-sm bg-card border-card-border focus:border-violet-400/50"
                disabled={sending}
              />
              <Button onClick={send} disabled={sending || !input.trim()} className="bg-violet-600 hover:bg-violet-700 text-white border-0 gap-2 font-mono text-xs px-5">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <div className="text-[9px] font-mono text-muted-foreground/30 text-center mt-2">
              Agent can execute SQL queries, shell commands, and read platform logs · All actions are logged
            </div>
          </div>
        </div>
      )}

      {/* ── MODELS TAB ── */}
      {tab === "models" && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Available Models</h2>
            <button onClick={loadModels} disabled={modelsLoading} className="text-muted-foreground/40 hover:text-primary">
              <RefreshCw className={cn("w-4 h-4", modelsLoading && "animate-spin")} />
            </button>
          </div>
          {Object.entries(ROUTER_CONFIG).map(([routerKey, rCfg]) => (
            <div key={routerKey}>
              <div className={cn("flex items-center gap-2 mb-3")}>
                <rCfg.icon className={cn("w-4 h-4", rCfg.color)} />
                <span className={cn("font-mono text-xs font-bold uppercase tracking-wider", rCfg.color)}>{rCfg.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground/50">— {rCfg.description}</span>
                {settings.router === routerKey && <Badge variant="outline" className={cn("font-mono text-[8px] ml-auto", rCfg.color, "border-current/30")}>ACTIVE</Badge>}
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {modelsLoading ? (
                  Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
                ) : (models[routerKey] ?? []).map((m: any) => {
                  const isActive = settings.router === routerKey && settings.model === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setSettings(s => ({ ...s, router: routerKey, model: m.id })); }}
                      className={cn("text-left p-3 rounded-xl border transition-all", isActive ? "bg-violet-500/10 border-violet-400/30" : "bg-card border-card-border hover:border-violet-400/20")}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold">{m.label}</span>
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground/60">{m.id}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/40 mt-0.5">ctx: {(m.ctx / 1000).toFixed(0)}K tokens</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Button onClick={saveSettings} disabled={savingSettings} className="w-full font-mono text-xs bg-violet-600 hover:bg-violet-700 text-white border-0">
            {savingSettings ? "Saving..." : "Save Model Selection"}
          </Button>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === "settings" && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 max-w-2xl">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Agent Configuration</h2>

          {/* Router selection */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3">AI Router</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(ROUTER_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setSettings(s => ({ ...s, router: key }))}
                  className={cn("p-3 rounded-xl border transition-all text-left", settings.router === key ? cn("border-current/40", cfg.color, "bg-current/5") : "border-card-border bg-card hover:border-border")}
                >
                  <cfg.icon className={cn("w-4 h-4 mb-2", settings.router === key ? cfg.color : "text-muted-foreground/40")} />
                  <div className={cn("font-mono text-xs font-bold", settings.router === key ? cfg.color : "text-foreground")}>{cfg.label}</div>
                  <div className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">{cfg.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">Model ID</label>
            <Input value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value }))} placeholder="gpt-4o-mini" className="font-mono text-sm" />
            <p className="font-mono text-[9px] text-muted-foreground/40 mt-1">Manually enter any model ID from your router's catalogue</p>
          </div>

          {/* System prompt */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">System Prompt</label>
            <textarea
              value={settings.system_prompt}
              onChange={e => setSettings(s => ({ ...s, system_prompt: e.target.value }))}
              rows={5}
              className="w-full bg-input border border-border rounded-lg font-mono text-xs p-3 text-foreground resize-none focus:outline-none focus:border-violet-400/50"
              placeholder="You are AYZEN AI Agent..."
            />
          </div>

          {/* Temperature & tokens */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">Temperature ({settings.temperature})</label>
              <input type="range" min={0} max={2} step={0.1} value={settings.temperature} onChange={e => setSettings(s => ({ ...s, temperature: Number(e.target.value) }))} className="w-full" />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">Max Tokens</label>
              <Input type="number" value={settings.max_tokens} onChange={e => setSettings(s => ({ ...s, max_tokens: Number(e.target.value) }))} className="font-mono text-sm" />
            </div>
          </div>

          {/* Tools */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3">MCP Tools Access</label>
            <div className="space-y-2">
              {[
                { key: "database", label: "Database Access", desc: "Execute SQL queries on the AYZEN database", icon: Database, color: "text-emerald-400" },
                { key: "shell", label: "Shell Access", desc: "Run shell commands on the server", icon: Terminal, color: "text-amber-400" },
                { key: "console", label: "Log Access", desc: "Query request metrics and error logs", icon: Server, color: "text-primary" },
              ].map(t => (
                <div key={t.key} className="flex items-center justify-between p-3 bg-card border border-card-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <t.icon className={cn("w-4 h-4", settings.tools_enabled[t.key as keyof typeof settings.tools_enabled] ? t.color : "text-muted-foreground/30")} />
                    <div>
                      <div className="font-mono text-xs font-bold">{t.label}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/50">{t.desc}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, tools_enabled: { ...s.tools_enabled, [t.key]: !s.tools_enabled[t.key as keyof typeof s.tools_enabled] } }))}
                    className={cn("w-10 h-5 rounded-full transition-all relative", settings.tools_enabled[t.key as keyof typeof settings.tools_enabled] ? "bg-violet-500" : "bg-muted/50")}
                  >
                    <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm", settings.tools_enabled[t.key as keyof typeof settings.tools_enabled] ? "left-5" : "left-0.5")} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={saveSettings} disabled={savingSettings} className="w-full font-mono text-xs bg-violet-600 hover:bg-violet-700 text-white border-0 gap-2">
            <Save className="w-3.5 h-3.5" />
            {savingSettings ? "Saving..." : "Save Configuration"}
          </Button>

          <div className="bg-muted/10 border border-border/30 rounded-xl p-4 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-2"><Key className="w-3 h-3" />API Keys Required</div>
            {[
              { key: "OPENAI_API_KEY", router: "openai", label: "OpenAI" },
              { key: "GROQ_API_KEY", router: "groq", label: "Groq" },
              { key: "OPENROUTER_API_KEY", router: "openrouter", label: "OpenRouter" },
            ].map(k => (
              <div key={k.key} className={cn("flex items-center justify-between font-mono text-[10px]", settings.router === k.router ? "text-foreground" : "text-muted-foreground/40")}>
                <span>{k.label}</span>
                <code className="bg-muted/20 px-2 py-0.5 rounded text-[9px]">{k.key}</code>
              </div>
            ))}
            <p className="font-mono text-[9px] text-muted-foreground/40 mt-2">Set via Environment Secrets in your Replit project settings.</p>
          </div>
        </div>
      )}
    </div>
  );
}
