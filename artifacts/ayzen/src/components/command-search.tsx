import { useState, useEffect, useCallback, useRef } from "react";
import { Search, FolderGit2, CheckSquare, Vault, X, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Result {
  id: number;
  label: string;
  sub?: string;
  type: "project" | "task" | "vault";
  href: string;
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !token) { setResults([]); return; }
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [projRes, taskRes, vaultRes] = await Promise.allSettled([
        fetch(`${BASE}/api/projects?limit=100`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/tasks?limit=200`, { headers }).then(r => r.json()),
        fetch(`${BASE}/api/vault/entries`, { headers }).then(r => r.json()),
      ]);

      const lower = q.toLowerCase();
      const out: Result[] = [];

      if (projRes.status === "fulfilled") {
        const projects = Array.isArray(projRes.value) ? projRes.value : (projRes.value?.projects ?? []);
        projects.filter((p: any) => p.name?.toLowerCase().includes(lower))
          .slice(0, 5)
          .forEach((p: any) => out.push({ id: p.id, label: p.name, sub: p.category ?? "Project", type: "project", href: `/projects/${p.id}` }));
      }
      if (taskRes.status === "fulfilled") {
        const tasks = Array.isArray(taskRes.value) ? taskRes.value : [];
        tasks.filter((t: any) => t.name?.toLowerCase().includes(lower) || t.description?.toLowerCase().includes(lower))
          .slice(0, 5)
          .forEach((t: any) => out.push({ id: t.id, label: t.name, sub: t.projectName ?? "Task", type: "task", href: `/tasks` }));
      }
      if (vaultRes.status === "fulfilled") {
        const entries = Array.isArray(vaultRes.value) ? vaultRes.value : [];
        entries.filter((e: any) => e.label?.toLowerCase().includes(lower) || e.emailUsername?.toLowerCase().includes(lower))
          .slice(0, 3)
          .forEach((e: any) => out.push({ id: e.id, label: e.label ?? "Vault Entry", sub: e.emailUsername ?? "Vault", type: "vault", href: `/vault` }));
      }
      setResults(out);
      setSelected(0);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(v => !v); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[selected]) { navigate(results[selected].href); setOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, results, selected, navigate]);

  const TYPE_CONFIG = {
    project: { icon: FolderGit2, color: "text-primary" },
    task:    { icon: CheckSquare, color: "text-violet-400" },
    vault:   { icon: Vault, color: "text-amber-400" },
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-card border border-card-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          {loading ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" /> : <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, tasks, vault..."
            className="flex-1 bg-transparent font-mono text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
          />
          {query && <button onClick={() => setQuery("")} className="text-muted-foreground/40 hover:text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
          <kbd className="hidden sm:block px-1.5 py-0.5 rounded border border-border font-mono text-[10px] text-muted-foreground/50">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {!query && (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground/40">
              Type to search across projects, tasks, and vault...
            </div>
          )}
          {query && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground/40">No results for "{query}"</div>
          )}
          {results.map((r, i) => {
            const { icon: Icon, color } = TYPE_CONFIG[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => { navigate(r.href); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group",
                  i === selected ? "bg-primary/10" : "hover:bg-muted/30"
                )}
                onMouseEnter={() => setSelected(i)}
              >
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center bg-muted/30", color)}>
                  <Icon className={cn("w-3.5 h-3.5", color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-foreground truncate">{r.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">{r.sub}</div>
                </div>
                <ArrowRight className={cn("w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity", i === selected && "opacity-100")} />
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-border/40 flex items-center gap-4 text-[10px] font-mono text-muted-foreground/40">
          <span><kbd className="px-1 py-0.5 rounded border border-border/40">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded border border-border/40">↵</kbd> open</span>
          <span><kbd className="px-1 py-0.5 rounded border border-border/40">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}

export function useCommandSearch() {
  const openSearch = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  return { openSearch };
}
