import { useState, useEffect } from "react";
import { useGetTelemetryFunctions, useGetTelemetryErrors } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Terminal, Cpu, Zap, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroqModel {
  id: string;
  name: string;
  context: number;
  free: boolean;
  tier: string;
  speed: string;
}

const TIER_STYLES: Record<string, string> = {
  recommended:  "border-primary/40 text-primary bg-primary/5",
  stable:       "border-emerald-400/40 text-emerald-400 bg-emerald-400/5",
  reasoning:    "border-violet-400/40 text-violet-400 bg-violet-400/5",
  experimental: "border-amber-400/40 text-amber-400 bg-amber-400/5",
  safety:       "border-sky-400/40 text-sky-400 bg-sky-400/5",
};

const SPEED_STYLES: Record<string, string> = {
  "ultra-fast": "text-primary",
  "fast":       "text-emerald-400",
  "medium":     "text-amber-400",
};

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
      .then(data => { setModels(Array.isArray(data) ? data : []); })
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
    const reply = data.choices?.[0]?.message?.content ?? data.error ?? "No response";
    alert(`Model: ${modelId}\n\nResponse: ${reply.slice(0, 300)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" /> Developer Console
        </h1>
        <p className="text-muted-foreground font-mono text-sm">API telemetry, error logs, and AI model registry</p>
      </div>

      <Tabs defaultValue="models" className="w-full">
        <TabsList className="bg-card border border-card-border w-full justify-start rounded-md h-12 p-1 flex-wrap">
          <TabsTrigger value="models" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Cpu className="w-3 h-3 mr-1" /> AI Models
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Telemetry</TabsTrigger>
          <TabsTrigger value="errors" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Error Log</TabsTrigger>
        </TabsList>

        {/* ── AI Models Tab ─────────────────────────────────────────────── */}
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
              <div className="p-6 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
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
                        <span className={cn("px-2 py-0.5 rounded border text-[10px] font-mono uppercase", TIER_STYLES[m.tier] ?? TIER_STYLES.stable)}>
                          {m.tier}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Zap className={cn("w-3 h-3", SPEED_STYLES[m.speed] ?? "text-muted-foreground")} />
                          <span className={cn("font-mono text-[11px]", SPEED_STYLES[m.speed] ?? "text-muted-foreground")}>{m.speed}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {(m.context / 1000).toFixed(0)}K
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-mono text-[10px] text-emerald-400">Available</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => testModel(m.id)}
                          className="px-2.5 py-1 border border-primary/30 text-primary rounded text-[10px] font-mono hover:bg-primary/10 transition-colors hover-shimmer"
                        >
                          Test →
                        </button>
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
              <p>• Users can select a model in the AI chat — the selected model is sent with each request</p>
              <p>• Rate limits: free tier allows ~30 req/min for most models, 6000 tokens/min</p>
            </div>
          </div>
        </TabsContent>

        {/* ── Telemetry Tab ─────────────────────────────────────────────── */}
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
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase rounded-sm ${fn.status === 'wired' ? 'border-primary/50 text-primary' : 'border-destructive/50 text-destructive'}`}>
                          {fn.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fn.callCount24h}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{fn.avgLatencyMs ? `${fn.avgLatencyMs}ms` : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Error Log Tab ─────────────────────────────────────────────── */}
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
                      <TableCell>
                        <Badge variant="destructive" className="font-mono text-[10px] uppercase rounded-sm">{err.level}</Badge>
                      </TableCell>
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
