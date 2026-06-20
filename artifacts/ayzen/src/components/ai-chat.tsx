import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot, ChevronDown, Database, ChevronUp, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
}

const MODELS = [
  { id: "llama-3.3-70b-versatile",                     name: "Llama 3.3 70B",    badge: "⚡ Recommended" },
  { id: "llama-3.1-8b-instant",                         name: "Llama 3.1 8B",     badge: "🚀 Ultra-Fast" },
  { id: "qwen-qwq-32b",                                 name: "Qwen QwQ 32B",     badge: "🧠 Reasoning" },
  { id: "deepseek-r1-distill-llama-70b",                name: "DeepSeek R1 70B",  badge: "🧠 Reasoning" },
  { id: "gemma2-9b-it",                                 name: "Gemma 2 9B",       badge: "✓ Stable" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct",   name: "Llama 4 Scout",    badge: "🆕 New" },
];

const QUICK_PROMPTS = [
  "Show my vault entities",
  "What projects am I in?",
  "Best L2 airdrops right now?",
  "How to avoid sybil detection?",
];

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: "user", content };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMsgs, model: selectedModel }),
      });
      const data = await res.json();
      const reply: string = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't get a response. Try again.";
      const model: string = data._model ?? selectedModel;
      setMessages((m) => [...m, { role: "assistant", content: reply, model }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  const currentModel = MODELS.find(m => m.id === selectedModel);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="bg-card border border-card-border rounded-xl shadow-2xl w-80 md:w-96 flex flex-col animate-scale-in overflow-hidden"
          style={{ height: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-card" />
              </div>
              <div>
                <span className="font-mono text-sm font-bold text-primary tracking-wider">AYZEN AI</span>
                <div className="flex items-center gap-1">
                  <Database className="w-2.5 h-2.5 text-muted-foreground/40" />
                  <span className="text-[9px] font-mono text-muted-foreground/50">DB-CONNECTED</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(s => !s)}
                className={cn("p-1.5 rounded transition-colors", showSettings ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                title="Model settings"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Model selector */}
          {showSettings && (
            <div className="shrink-0 border-b border-card-border bg-muted/20 px-3 py-2.5 animate-fade-up">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Select Model — All Groq Free</p>
              <div className="grid grid-cols-2 gap-1">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={cn(
                      "text-left px-2 py-1.5 rounded border text-[10px] font-mono transition-all",
                      selectedModel === m.id
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    <div className="font-bold truncate">{m.name}</div>
                    <div className="text-muted-foreground/60 text-[9px]">{m.badge}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active model pill */}
          {!showSettings && currentModel && (
            <div className="shrink-0 px-3 pt-2 pb-0.5">
              <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {currentModel.name}
                <ChevronUp className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center animate-glow-pulse">
                    <Bot className="w-6 h-6 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center">
                    <Database className="w-2 h-2 text-secondary" />
                  </div>
                </div>
                <div className="text-xs font-mono text-muted-foreground text-center leading-relaxed">
                  Ask me about your vault, projects,<br />or anything crypto airdrop related.
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-[10px] font-mono text-left px-2.5 py-2 rounded-lg border border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5 text-muted-foreground transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2 animate-fade-up", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                )}
                <div className="max-w-[85%] flex flex-col gap-0.5">
                  <div className={cn(
                    "text-xs font-mono p-2.5 rounded-xl leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary/15 text-foreground border border-primary/20 rounded-tr-sm"
                      : "bg-muted/60 text-foreground border border-border rounded-tl-sm"
                  )}>
                    {m.content}
                  </div>
                  {m.role === "assistant" && m.model && (
                    <span className="text-[9px] font-mono text-muted-foreground/30 ml-1">{m.model.split("/").pop()}</span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 animate-fade-up">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-muted/60 border border-border text-xs font-mono p-2.5 rounded-xl rounded-tl-sm flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-card-border shrink-0 flex gap-2 bg-card">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask AYZEN AI…"
              className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="text-primary hover:text-primary/80 disabled:opacity-30 transition-colors p-2 hover:bg-primary/10 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-[52px] h-[52px] bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 relative animate-glow-pulse"
      >
        {open ? (
          <X className="w-5 h-5 text-primary-foreground" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-background" />
          </>
        )}
      </button>
    </div>
  );
}
