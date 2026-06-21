import { useState, useEffect, useRef, useCallback } from "react";
import { useGetTelemetryFunctions, useGetTelemetryErrors } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Terminal, Cpu, Zap, CheckCircle, Clock, Send, Bot, User, Radio, Trash2, PauseCircle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GroqModel { id: string; name: string; context: number; free: boolean; tier: string; speed: string; }
interface ChatMessage { role: "user" | "assistant"; content: string; model?: string; ts: number; }
interface LogEntry { time: number; level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "SYSTEM"; msg: string; method?: string; url?: string; statusCode?: number; ms?: number; }

// ─── Style maps ────────────────────────────────────────────────────────────────
const TIER_STYLES: Record<string, string> = {
  recommended: "border-primary/40 text-primary bg-primary/5",
  stable: "border-emerald-400/40 text-emerald-400 bg-emerald-400/5",
  reasoning: "border-violet-400/40 text-violet-400 bg-violet-400/5",
  experimental: "border-amber-400/40 text-amber-400 bg-amber-400/5",
  safety: "border-sky-400/40 text-sky-400 bg-sky-400/5",
};
const SPEED_STYLES: Record<string, string> = { "ultra-fast": "text-primary", "fast": "text-emerald-400", "medium": "text-amber-400" };
const LOG_STYLES: Record<string, { text: string; badge: string; dot: string }> = {
  INFO:   { text: "text-emerald-400",  badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",  dot: "bg-emerald-400" },
  WARN:   { text: "text-amber-400",    badge: "bg-amber-400/10 text-amber-400 border-amber-400/20",        dot: "bg-amber-400" },
  ERROR:  { text: "text-red-400",      badge: "bg-red-400/10 text-red-400 border-red-400/20",              dot: "bg-red-400" },
  DEBUG:  { text: "text-slate-400",    badge: "bg-slate-400/10 text-slate-400 border-slate-400/20",        dot: "bg-slate-400" },
  SYSTEM: { text: "text-primary",      badge: "bg-primary/10 text-primary border-primary/20",              dot: "bg-primary" },
};

// ─── AI Chat Tab ──────────────────────────────────────────────────────────────
function AiChatTab({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [models, setModels] = useState<GroqModel[]>([]);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/models", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setModels(Array.isArray(d) ? d : []); setAiReady(true); })
      .catch(() => setAiReady(false));
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model, messages: history }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? data.error ?? "No response from AI.";
      setMessages(prev => [...prev, { role: "assistant", content, model: data._model ?? model, ts: Date.now() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}`, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] border border-card-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="font-mono font-bold text-sm text-foreground">AYZEN Admin AI</span>
          {aiReady === true && <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />ONLINE</span>}
          {aiReady === false && <span className="text-[10px] font-mono text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded">NO API KEY</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="bg-background border border-card-border rounded px-2 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:border-primary/50"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button onClick={() => setMessages([])} className="p-1.5 text-muted-foreground hover:text-foreground border border-card-border rounded hover:bg-muted/30 transition-colors" title="Clear">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Bot className="w-10 h-10 text-primary/30" />
            <p className="text-sm">Ask anything about the platform.</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["How many users do we have?", "List all active projects", "What's total ROI distributed?", "Show recent vault entries"].map(q => (
                <button key={q} onClick={() => { setInput(q); }} className="px-3 py-1.5 border border-primary/20 text-primary text-xs rounded-full hover:bg-primary/10 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 border",
              m.role === "user" ? "bg-primary/10 border-primary/30" : "bg-card border-card-border"
            )}>
              {m.role === "user" ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            <div className={cn("max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed",
              m.role === "user" ? "bg-primary/10 border border-primary/20 text-foreground" : "bg-muted/30 border border-card-border text-foreground"
            )}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.model && <p className="text-[10px] text-muted-foreground/50 mt-2 uppercase">{m.model}</p>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center border bg-card border-card-border shrink-0">
              <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="bg-muted/30 border border-card-border rounded-xl px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {aiReady === false ? (
        <div className="px-4 py-3 border-t border-card-border bg-muted/20 shrink-0">
          <p className="text-xs font-mono text-amber-400">⚠ AI requires <span className="text-primary">GROQ_API_KEY</span> or <span className="text-primary">OPENROUTER_API_KEY</span> in Replit Secrets.</p>
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2 p-3 border-t border-card-border shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything... (platform stats, users, projects, vault)"
            disabled={loading}
            className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-primary/10 border border-primary/30 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-mono"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Live Console Tab ─────────────────────────────────────────────────────────
function LiveConsoleTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const pendingRef = useRef<LogEntry[]>([]);

  pausedRef.current = paused;

  const flush = useCallback(() => {
    if (pendingRef.current.length === 0) return;
    const batch = pendingRef.current.splice(0);
    setLogs(prev => [...prev.slice(-800), ...batch]);
  }, []);

  useEffect(() => {
    const interval = setInterval(flush, 200);
    return () => clearInterval(interval);
  }, [flush]);

  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, paused]);

  useEffect(() => {
    const es = new EventSource(`/api/admin/logs/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "history") {
          setLogs(data.entries ?? []);
        } else if (data.type === "entry") {
          if (!pausedRef.current) {
            pendingRef.current.push(data.entry);
          }
        }
      } catch {}
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  const filtered = filter === "ALL" ? logs : logs.filter(l => l.level === filter);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono",
            connected ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400" : "bg-red-400/10 border-red-400/20 text-red-400"
          )}>
            <Radio className={cn("w-3 h-3", connected && "animate-pulse")} />
            {connected ? "LIVE" : "DISCONNECTED"}
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">{filtered.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-card-border rounded overflow-hidden">
            {["ALL", "SYSTEM", "INFO", "WARN", "ERROR"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn("px-2.5 py-1 text-[10px] font-mono uppercase transition-colors",
                  filter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setPaused(p => !p)} className={cn("flex items-center gap-1.5 px-2.5 py-1 border rounded text-[11px] font-mono transition-colors",
            paused ? "border-amber-400/30 text-amber-400 hover:bg-amber-400/10" : "border-card-border text-muted-foreground hover:bg-muted/30"
          )}>
            {paused ? <PlayCircle className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={() => setLogs([])} className="flex items-center gap-1.5 px-2.5 py-1 border border-card-border text-muted-foreground rounded text-[11px] font-mono hover:bg-muted/30 transition-colors">
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {/* Console output */}
      <div className="border border-card-border rounded-xl bg-[#0a0a0f] overflow-hidden">
        <div className="h-[500px] overflow-y-auto p-3 font-mono text-xs space-y-0.5 scrollbar-thin" id="log-scroller">
          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground/40 gap-2">
              <Terminal className="w-5 h-5" />
              <span>Waiting for log entries...</span>
            </div>
          )}
          {filtered.map((entry, i) => {
            const style = LOG_STYLES[entry.level] ?? LOG_STYLES.INFO;
            const ts = new Date(entry.time).toISOString().slice(11, 23);
            return (
              <div key={i} className="flex items-start gap-2 py-0.5 hover:bg-white/[0.02] rounded px-1 group">
                <span className="text-muted-foreground/40 shrink-0 tabular-nums">{ts}</span>
                <span className={cn("shrink-0 px-1.5 py-0 rounded border text-[9px] uppercase font-bold tracking-widest", style.badge)}>
                  {entry.level}
                </span>
                <span className={cn("flex-1 break-all", style.text)}>{entry.msg}</span>
                {entry.ms !== undefined && (
                  <span className="text-muted-foreground/30 shrink-0 tabular-nums">{entry.ms}ms</span>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDeveloper() {
  const { data: functions, isLoading: fnLoading } = useGetTelemetryFunctions();
  const { data: errors, isLoading: errLoading } = useGetTelemetryErrors({ limit: 50 });
  const [models, setModels] = useState<GroqModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [activeModel, setActiveModel] = useState("llama-3.3-70b-versatile");
  const token = localStorage.getItem("ayzen_token") ?? "";

  useEffect(() => {
    fetch("/api/ai/models", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setModels(Array.isArray(d) ? d : []); })
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, []);

  const testModel = async (modelId: string) => {
    setActiveModel(modelId);
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "ping" }] }),
    });
    const data = await res.json();
    const reply = String(data.choices?.[0]?.message?.content ?? data.error ?? "No response");
    alert(`Model: ${modelId}\n\nResponse: ${reply.slice(0, 300)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" /> Developer Console
        </h1>
        <p className="text-muted-foreground font-mono text-sm">AI assistant, live logs, telemetry, and model registry</p>
      </div>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="bg-card border border-card-border w-full justify-start rounded-md h-12 p-1 flex-wrap">
          <TabsTrigger value="ai" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Bot className="w-3 h-3 mr-1" /> AI Assistant
          </TabsTrigger>
          <TabsTrigger value="console" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Terminal className="w-3 h-3 mr-1" /> Live Console
          </TabsTrigger>
          <TabsTrigger value="models" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Cpu className="w-3 h-3 mr-1" /> AI Models
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Telemetry</TabsTrigger>
          <TabsTrigger value="errors" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Error Log</TabsTrigger>
        </TabsList>

        {/* ── AI Assistant ──────────────────────────────────────────────────── */}
        <TabsContent value="ai" className="mt-4">
          <AiChatTab token={token} />
        </TabsContent>

        {/* ── Live Console ──────────────────────────────────────────────────── */}
        <TabsContent value="console" className="mt-4">
          <LiveConsoleTab token={token} />
        </TabsContent>

        {/* ── AI Models ─────────────────────────────────────────────────────── */}
        <TabsContent value="models" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Models", value: models.length, icon: Cpu, color: "text-primary" },
              { label: "Free Tier", value: models.filter(m => m.free).length, icon: CheckCircle, color: "text-emerald-400" },
              { label: "Reasoning", value: models.filter(m => m.tier === "reasoning").length, icon: Zap, color: "text-violet-400" },
              { label: "Max Context", value: models.length ? `${(Math.max(...models.map(m => m.context)) / 1000).toFixed(0)}K` : "—", icon: Clock, color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="glass-card border rounded-xl p-4 animate-fade-up">
                <div className={cn("flex items-center gap-1.5 mb-2", s.color)}>
                  <s.icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.label}</span>
                </div>
                <p className={cn("text-2xl font-mono font-bold", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="border border-card-border rounded-xl bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-card-border bg-card/50 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-foreground">Groq Free Tier Models</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">All models below are available on the Groq free tier — no billing required</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-400">All FREE</span>
              </div>
            </div>
            {modelsLoading ? (
              <div className="p-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-card-border hover:bg-transparent">
                    <TableHead className="font-mono uppercase text-[10px]">Model</TableHead>
                    <TableHead className="font-mono uppercase text-[10px]">Tier</TableHead>
                    <TableHead className="font-mono uppercase text-[10px]">Speed</TableHead>
                    <TableHead className="font-mono uppercase text-[10px] text-right">Context</TableHead>
                    <TableHead className="font-mono uppercase text-[10px]">Status</TableHead>
                    <TableHead className="font-mono uppercase text-[10px] text-right">Test</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((m) => (
                    <TableRow key={m.id} className={cn("border-card-border hover:bg-muted/30 transition-colors", activeModel === m.id && "bg-primary/5")}>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm font-bold text-foreground">{m.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{m.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("px-2 py-0.5 rounded border text-[10px] font-mono uppercase", TIER_STYLES[m.tier] ?? TIER_STYLES.stable)}>{m.tier}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Zap className={cn("w-3 h-3", SPEED_STYLES[m.speed] ?? "text-muted-foreground")} />
                          <span className={cn("font-mono text-[11px]", SPEED_STYLES[m.speed] ?? "text-muted-foreground")}>{m.speed}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">{(m.context / 1000).toFixed(0)}K</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-mono text-[10px] text-emerald-400">Available</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => testModel(m.id)} className="px-2.5 py-1 border border-primary/30 text-primary rounded text-[10px] font-mono hover:bg-primary/10 transition-colors hover-shimmer">Test →</button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="glass-card border rounded-xl p-4">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Integration Notes</p>
            <div className="space-y-1.5 text-xs font-mono text-muted-foreground">
              <p>• Set <span className="text-primary">GROQ_API_KEY</span> in Replit Secrets to activate Groq — free at <span className="text-primary">console.groq.com</span></p>
              <p>• Without GROQ_API_KEY, the system falls back to <span className="text-secondary">OpenRouter</span> (set <span className="text-secondary">OPENROUTER_API_KEY</span>)</p>
              <p>• Admin users get platform-level context; regular users see their own vault & task data</p>
              <p>• Rate limits: free tier allows ~30 req/min for most models, 6000 tokens/min</p>
            </div>
          </div>
        </TabsContent>

        {/* ── Telemetry ─────────────────────────────────────────────────────── */}
        <TabsContent value="telemetry" className="mt-4">
          <div className="border border-card-border rounded-md bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-card-border hover:bg-transparent">
                  <TableHead className="font-mono uppercase text-xs">Function</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Route</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Status</TableHead>
                  <TableHead className="font-mono uppercase text-xs text-right">24h Calls</TableHead>
                  <TableHead className="font-mono uppercase text-xs text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fnLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
                ) : !functions || functions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 font-mono text-muted-foreground">No telemetry data.</TableCell></TableRow>
                ) : (
                  functions.map((fn) => (
                    <TableRow key={fn.name} className="border-card-border hover:bg-muted/50">
                      <TableCell className="font-mono font-medium text-primary">{fn.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{fn.route}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase rounded-sm ${fn.status === "wired" ? "border-primary/50 text-primary" : "border-destructive/50 text-destructive"}`}>{fn.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fn.callCount24h}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{fn.avgLatencyMs ? `${fn.avgLatencyMs}ms` : "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Error Log ─────────────────────────────────────────────────────── */}
        <TabsContent value="errors" className="mt-4">
          <div className="border border-card-border rounded-md bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-card-border hover:bg-transparent">
                  <TableHead className="font-mono uppercase text-xs">Level</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Message</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Endpoint</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
                ) : !errors || errors.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 font-mono text-muted-foreground">System clear. No errors logged.</TableCell></TableRow>
                ) : (
                  errors.map((err) => (
                    <TableRow key={err.id} className="border-card-border">
                      <TableCell><Badge variant="destructive" className="font-mono text-[10px] uppercase rounded-sm">{err.level}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{err.message}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{err.endpoint}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
