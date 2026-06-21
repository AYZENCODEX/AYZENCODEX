import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Send, Link2, Unlink, RefreshCw, CheckCircle2, ExternalLink } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface TelegramStatus {
  linked: boolean;
  chatId: string | null;
  username: string | null;
}

export default function UserSettings() {
  const { token } = useAuth() as any;
  const { toast } = useToast();

  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgLoading, setTgLoading] = useState(true);
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [botName, setBotName] = useState<string | null>(null);

  const fetchTgStatus = useCallback(async () => {
    setTgLoading(true);
    try {
      const res = await fetch(`${BASE}/api/telegram/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTgStatus(await res.json());
    } catch { /* ignore */ }
    setTgLoading(false);
  }, [token]);

  const fetchBotInfo = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/telegram/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.online) setBotName(data.username);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchTgStatus(); fetchBotInfo(); }, [fetchTgStatus, fetchBotInfo]);

  const handleLink = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      toast({ variant: "destructive", title: "Enter the 6-digit code from the bot" });
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(`${BASE}/api/telegram/connect/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Telegram linked!", description: "Your Telegram account is now connected." });
        setCode("");
        await fetchTgStatus();
      } else {
        toast({ variant: "destructive", title: "Link failed", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setLinking(false);
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const res = await fetch(`${BASE}/api/telegram/disconnect`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: "Telegram disconnected" });
        await fetchTgStatus();
      }
    } catch {
      toast({ variant: "destructive", title: "Error disconnecting" });
    }
    setUnlinking(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground font-mono text-xs mt-1">Account integrations and preferences</p>
      </div>

      {/* ── Telegram Connect ─────────────────────────────────── */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="bg-primary/5 border-b border-card-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#229ED9]/10 border border-[#229ED9]/20 flex items-center justify-center">
              <Send className="w-4 h-4 text-[#229ED9]" />
            </div>
            <div>
              <div className="font-mono font-bold text-sm text-foreground">Telegram Bot</div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Account Notifications & Commands</div>
            </div>
          </div>
          {tgLoading ? (
            <div className="w-16 h-5 bg-muted/30 rounded animate-pulse" />
          ) : tgStatus?.linked ? (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[10px] uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse inline-block" />
              Linked
            </Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Not linked
            </Badge>
          )}
        </div>

        <div className="px-5 py-5 space-y-5">
          {tgStatus?.linked ? (
            /* ── Already linked ── */
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-md px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-mono text-sm text-emerald-400 font-medium">Account connected</div>
                  {tgStatus.username && (
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">@{tgStatus.username}</div>
                  )}
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground space-y-1">
                <div>✓ You will receive broadcast notifications</div>
                <div>✓ Use bot commands: /me, /projects, /leaderboard</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 gap-2"
                onClick={handleUnlink}
                disabled={unlinking}
              >
                <Unlink className="w-3.5 h-3.5" />
                {unlinking ? "Disconnecting..." : "Disconnect Telegram"}
              </Button>
            </div>
          ) : (
            /* ── Not linked — show connect flow ── */
            <div className="space-y-5">
              {/* Step guide */}
              <div className="space-y-2">
                <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-3">How to connect</p>
                {[
                  {
                    n: "1",
                    text: botName
                      ? <>Open <a href={`https://t.me/${botName}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">@{botName} <ExternalLink className="w-3 h-3" /></a> on Telegram</>
                      : "Open the AYZEN bot on Telegram",
                  },
                  { n: "2", text: <>Send the command <span className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary">/connect</span></> },
                  { n: "3", text: "The bot will reply with a 6-digit code" },
                  { n: "4", text: "Paste that code below and click Link" },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-mono font-bold text-primary flex-shrink-0 mt-0.5">{n}</div>
                    <p className="text-xs font-mono text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              {/* Code input */}
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  6-Digit Code from Bot
                </label>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="font-mono tracking-[0.4em] text-center text-lg h-11 bg-input border-border focus-visible:ring-primary/50 focus-visible:border-primary max-w-[160px]"
                    onKeyDown={e => e.key === "Enter" && handleLink()}
                  />
                  <Button
                    onClick={handleLink}
                    disabled={linking || code.length !== 6}
                    className="font-mono text-xs gap-2 h-11"
                  >
                    {linking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    {linking ? "Linking..." : "Link Account"}
                  </Button>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground/50">Code expires in 10 minutes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
