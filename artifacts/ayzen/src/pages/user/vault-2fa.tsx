import { useState, useEffect, useCallback } from "react";
import { useListVaultEntries, customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Smartphone, Shield, Plus, Trash2, Copy, Check,
  Eye, EyeOff, RefreshCw, Loader2, X, Twitter,
  MessageSquare, Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

// ─── TOTP engine ──────────────────────────────────────────────────────────────
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bits = clean.split("").map(c => BASE32_CHARS.indexOf(c).toString(2).padStart(5, "0")).join("");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}

async function generateTOTP(secret: string, period = 30): Promise<string> {
  try {
    const keyBytes = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / period);
    const counterBytes = new Uint8Array(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) { counterBytes[i] = tmp & 0xff; tmp = Math.floor(tmp / 256); }
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes));
    const offset = hmac[19] & 0xf;
    const otp = (((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff)) % 1_000_000;
    return otp.toString().padStart(6, "0");
  } catch { return "------"; }
}

function useTimeLeft(period = 30) {
  const [t, setT] = useState(period - (Math.floor(Date.now() / 1000) % period));
  useEffect(() => {
    const iv = setInterval(() => setT(period - (Math.floor(Date.now() / 1000) % period)), 500);
    return () => clearInterval(iv);
  }, [period]);
  return t;
}

// ─── TOTP Card ────────────────────────────────────────────────────────────────
function TOTPCard({
  label, issuer, secret, onDelete,
}: {
  label: string; issuer?: string; secret: string; onDelete?: () => void;
}) {
  const [code, setCode] = useState("------");
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const timeLeft = useTimeLeft(30);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const c = await generateTOTP(secret);
    setCode(c);
  }, [secret]);

  useEffect(() => { refresh(); }, [refresh, Math.floor(Date.now() / 1000 / 30)]);
  useEffect(() => {
    const iv = setInterval(refresh, 1000);
    return () => clearInterval(iv);
  }, [refresh]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Code copied", description: `${label} TOTP copied` });
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpiring = timeLeft <= 5;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-foreground truncate">{label}</p>
          {issuer && <p className="font-mono text-[9px] text-muted-foreground/50 truncate">{issuer}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setShown(s => !s)} className="text-muted-foreground/40 hover:text-primary transition-colors p-1">
            {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          {onDelete && (
            <button onClick={onDelete} className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "font-mono text-2xl font-bold tracking-[0.25em] text-center py-2 rounded-lg border cursor-pointer transition-all select-none",
          isExpiring
            ? "text-red-400 bg-red-400/5 border-red-400/20"
            : "text-primary bg-primary/5 border-primary/20 hover:bg-primary/10"
        )}
        onClick={copy}
      >
        {shown ? code : "••• •••"}
        <span className="text-[10px] font-normal text-muted-foreground/50 block mt-0.5">click to copy</span>
      </div>

      <div>
        <Progress value={(timeLeft / 30) * 100} className={cn("h-1", isExpiring ? "[&>div]:bg-red-400" : "[&>div]:bg-primary")} />
        <div className="flex justify-between mt-1">
          <span className="font-mono text-[9px] text-muted-foreground/40">refreshes in</span>
          <span className={cn("font-mono text-[9px] font-bold", isExpiring ? "text-red-400" : "text-muted-foreground/60")}>{timeLeft}s</span>
        </div>
      </div>

      <button onClick={copy} className={cn("flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg font-mono text-xs transition-all border", copied ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" : "text-muted-foreground border-border/40 hover:text-primary hover:border-primary/30")}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? "Copied!" : "Copy code"}
      </button>
    </div>
  );
}

// ─── Local 2FA Tab ─────────────────────────────────────────────────────────────
function LocalTwoFaTab() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<any>("/local-accounts").then(d => {
      const list = Array.isArray(d) ? d : (d?.accounts ?? []);
      setAccounts(list.filter((a: any) => a.twofa));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  if (accounts.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <Smartphone className="w-8 h-8 text-muted-foreground/30 mx-auto" />
        <p className="font-mono text-xs text-muted-foreground/50">No 2FA secrets in local accounts</p>
        <p className="font-mono text-[10px] text-muted-foreground/30">Add TOTP secrets to your local accounts to see them here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {accounts.map(acc => (
        <TOTPCard
          key={acc.id}
          label={acc.label ?? acc.username ?? acc.email ?? `Account #${acc.id}`}
          issuer={acc.category}
          secret={acc.twofa}
        />
      ))}
    </div>
  );
}

// ─── Entity 2FA Tab ────────────────────────────────────────────────────────────
function EntityTwoFaTab() {
  const { data, isLoading } = useListVaultEntries();
  const entries: any[] = (data as any[] | undefined) ?? [];

  type TotpItem = { id: string; label: string; issuer: string; secret: string; platform: string; };
  const items: TotpItem[] = [];
  entries.forEach(e => {
    if (e.twitter2fa)  items.push({ id: `${e.id}-tw`, label: e.twitterUsername ?? e.projectName, issuer: "Twitter · " + e.projectName, secret: e.twitter2fa, platform: "twitter" });
    if (e.discord2fa)  items.push({ id: `${e.id}-dc`, label: e.discordUsername ?? e.projectName, issuer: "Discord · " + e.projectName, secret: e.discord2fa, platform: "discord" });
    if (e.telegram2fa) items.push({ id: `${e.id}-tg`, label: e.telegramUsername ?? e.telegramPhone ?? e.projectName, issuer: "Telegram · " + e.projectName, secret: e.telegram2fa, platform: "telegram" });
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto" />
        <p className="font-mono text-xs text-muted-foreground/50">No entity 2FA secrets found</p>
        <p className="font-mono text-[10px] text-muted-foreground/30">Add Twitter/Discord/Telegram 2FA secrets to your vault entities</p>
      </div>
    );
  }

  const platformIcon = (p: string) => {
    if (p === "twitter") return <Twitter className="w-3 h-3 text-sky-400" />;
    if (p === "discord") return <MessageSquare className="w-3 h-3 text-indigo-400" />;
    return <Phone className="w-3 h-3 text-blue-400" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["twitter", "discord", "telegram"].map(p => {
          const cnt = items.filter(i => i.platform === p).length;
          if (cnt === 0) return null;
          return (
            <Badge key={p} variant="outline" className="font-mono text-[10px] gap-1">
              {platformIcon(p)} {p} ({cnt})
            </Badge>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(item => (
          <TOTPCard key={item.id} label={item.label} issuer={item.issuer} secret={item.secret} />
        ))}
      </div>
    </div>
  );
}

// ─── Other 2FA Tab ─────────────────────────────────────────────────────────────
interface OtherEntry {
  id: number;
  label: string;
  secret: string;
  notes: string | null;
  created_at: string;
}

function OtherTwoFaTab() {
  const [entries, setEntries] = useState<OtherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", secret: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    customFetch<OtherEntry[]>("/two-factor/other").then(d => {
      setEntries(Array.isArray(d) ? d : []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.label.trim() || !form.secret.trim()) {
      toast({ variant: "destructive", title: "Label and Secret are required" });
      return;
    }
    setSaving(true);
    try {
      await customFetch("/two-factor/other", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "2FA entry added" });
      setOpen(false);
      setForm({ label: "", secret: "", notes: "" });
      load();
    } catch {
      toast({ variant: "destructive", title: "Failed to add entry" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await customFetch(`/two-factor/other/${id}`, { method: "DELETE" });
      toast({ title: "Entry deleted" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      toast({ variant: "destructive", title: "Failed to delete" });
    }
    setDeleteId(null);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground/60">{entries.length} manual entries</p>
        <Button size="sm" onClick={() => setOpen(true)} className="font-mono text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add 2FA
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Smartphone className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="font-mono text-xs text-muted-foreground/50">No manual 2FA entries</p>
          <p className="font-mono text-[10px] text-muted-foreground/30">Add TOTP secrets for platforms not covered by entity or local accounts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entries.map(e => (
            <TOTPCard
              key={e.id}
              label={e.label}
              issuer={e.notes ?? undefined}
              secret={e.secret}
              onDelete={() => setDeleteId(e.id)}
            />
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Add 2FA Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Label *</Label>
              <Input
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                className="font-mono text-xs h-8 bg-input"
                placeholder="e.g. GitHub, Binance..."
              />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">TOTP Secret *</Label>
              <Input
                value={form.secret}
                onChange={e => setForm(p => ({ ...p, secret: e.target.value.trim() }))}
                className="font-mono text-xs h-8 bg-input tracking-wider"
                placeholder="Base32 secret (e.g. JBSWY3DPEHPK3PXP)"
              />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="font-mono text-xs h-8 bg-input"
                placeholder="Platform, account info..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="font-mono text-xs">Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving} className="font-mono text-xs">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-red-400">Delete Entry?</DialogTitle>
          </DialogHeader>
          <p className="font-mono text-xs text-muted-foreground py-2">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && handleDelete(deleteId)} className="font-mono text-xs">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main 2FA Tab ──────────────────────────────────────────────────────────────
type TwoFaSubTab = "local" | "entity" | "other";

export default function VaultTwoFa() {
  const [sub, setSub] = useState<TwoFaSubTab>("local");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1 w-fit">
        {(["local", "entity", "other"] as TwoFaSubTab[]).map(t => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={cn(
              "px-4 py-1.5 rounded-md font-mono text-xs transition-all capitalize",
              sub === t ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {sub === "local"  && <LocalTwoFaTab />}
      {sub === "entity" && <EntityTwoFaTab />}
      {sub === "other"  && <OtherTwoFaTab />}
    </div>
  );
}
