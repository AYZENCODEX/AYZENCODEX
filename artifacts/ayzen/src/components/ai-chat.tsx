import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot, ChevronDown } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const data = await res.json();
      const reply: string = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't get a response. Try again.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="bg-card border border-card-border rounded-lg shadow-2xl w-80 flex flex-col"
          style={{ height: "420px" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-sm font-bold text-primary tracking-wider">AYZEN AI</span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">ONLINE</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
                <Bot className="w-10 h-10 text-primary/30" />
                <div className="text-xs font-mono text-muted-foreground text-center leading-relaxed">
                  Ask me about airdrops, DeFi strategies,<br />wallet management, or the AYZEN platform.
                </div>
                <div className="flex flex-col gap-1 w-full">
                  {["Best L2 airdrops right now?", "How to avoid sybil detection?", "Explain entity management"].map((q) => (
                    <button key={q} onClick={() => setInput(q)}
                      className="text-[10px] font-mono text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:text-primary text-muted-foreground transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] text-xs font-mono p-2.5 rounded leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "bg-muted/60 text-foreground border border-border"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/60 text-muted-foreground border border-border text-xs font-mono p-2.5 rounded flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-card-border shrink-0 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask AYZEN AI..."
              className="flex-1 bg-input border border-border rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="text-primary hover:text-primary/80 disabled:opacity-30 transition-colors p-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-13 h-13 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 relative"
        style={{ width: "52px", height: "52px" }}
      >
        {open ? (
          <X className="w-5 h-5 text-primary-foreground" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-background" />
          </>
        )}
      </button>
    </div>
  );
}
