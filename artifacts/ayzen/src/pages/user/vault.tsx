import { useState, useRef, lazy, Suspense } from "react";
import { useLocation, useSearch } from "wouter";
import { useListVaultEntries, useCreateVaultEntry, useDeleteVaultEntry, customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus, KeyRound, Trash2, Eye, EyeOff,
  Copy, Check, Mail, Hash, Lock, Shield,
  Phone, AtSign, X, Smartphone,
  QrCode, Search, Download, Upload, Wallet, AlertTriangle, Star,
  Loader2, Edit2, MoreVertical, LayoutDashboard, List,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import LocalAccounts from "@/components/local-accounts";
import { QRCodeSVG } from "qrcode.react";

const VaultLocalDashboard = lazy(() => import("@/pages/user/vault-local-dashboard"));
const VaultEntityDashboard = lazy(() => import("@/pages/user/vault-entity-dashboard"));
const VaultTwoFa = lazy(() => import("@/pages/user/vault-2fa"));
const VaultMail = lazy(() => import("@/pages/user/vault-mail"));
const VaultWalletSeed = lazy(() => import("@/pages/user/vault-wallet-seed"));

const CATEGORIES = ["DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Social", "Other"];

function LoadingTab() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className={cn("p-1.5 rounded transition-all", copied ? "text-emerald-400" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10")}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function CredField({ label, value }: { label: string; value: string | null | undefined }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 group/row py-0.5">
      <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider w-14 flex-shrink-0">{label}</span>
      <span className={cn("flex-1 font-mono text-[11px] truncate", shown ? "text-foreground/90" : "text-muted-foreground/60")}>
        {shown ? value : "•".repeat(Math.min(value.length, 12))}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setShown(s => !s)} className="text-muted-foreground/40 hover:text-primary transition-colors">
          {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
        <button onClick={copy} className={cn("transition-colors", copied ? "text-emerald-400" : "text-muted-foreground/40 hover:text-primary")}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

function PlatformSection({ title, color, icon: Icon, fields }: {
  title: string; color: string; icon: React.ElementType;
  fields: { label: string; value: string | null | undefined }[];
}) {
  const hasAny = fields.some(f => f.value);
  if (!hasAny) return null;
  return (
    <div className="space-y-0.5 py-2 border-t border-border/30 first:border-0 first:pt-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("w-3 h-3", color)} />
        <span className={cn("text-[9px] font-mono uppercase tracking-widest font-bold", color)}>{title}</span>
      </div>
      {fields.map(f => <CredField key={f.label} label={f.label} value={f.value} />)}
    </div>
  );
}

interface OtherAccount { id: string; platform: string; username: string; password: string; email: string; notes: string; }

function OtherAccountForm({ account, onChange, onRemove }: { account: OtherAccount; onChange: (u: OtherAccount) => void; onRemove: () => void }) {
  const f = (key: keyof OtherAccount) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...account, [key]: e.target.value });
  return (
    <div className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-2 relative group">
      <button onClick={onRemove} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 transition-all">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="space-y-1">
        <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Platform Name</Label>
        <Input value={account.platform} onChange={f("platform")} className="font-mono text-xs h-8 bg-input" placeholder="e.g. GitHub, TikTok, Reddit..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="font-mono text-[10px] text-muted-foreground/60">Username</Label>
          <Input value={account.username} onChange={f("username")} className="font-mono text-xs h-8 bg-input" placeholder="username / handle" />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label>
          <Input type="password" value={account.password} onChange={f("password")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="font-mono text-[10px] text-muted-foreground/60">Linked Email (optional)</Label>
        <Input value={account.email} onChange={f("email")} className="font-mono text-xs h-8 bg-input" placeholder="linked@email.com" />
      </div>
    </div>
  );
}

type EntryAny = any;

const EMPTY_FORM = {
  category: "", projectName: "",
  email: "", emailPassword: "", emailRecovery: "", emailRecoveryPassword: "",
  twitterUsername: "", twitterPassword: "", twitterEmail: "", twitterEmailPassword: "",
  twitterFollowers: "", twitter2fa: "", twitterEmailRecovery: "", twitterEmailRecoveryPassword: "",
  discordUsername: "", discordPassword: "", discordEmail: "", discordEmailPassword: "",
  discord2fa: "", discordEmailRecovery: "", discordEmailRecoveryPassword: "",
  telegramUsername: "", telegramPassword: "", telegramPhone: "", telegram2fa: "",
  telegramLinkedEmail: "", telegramLinkedEmailPassword: "",
  walletAddresses: "", backupCodes: "", notes: "",
};

function newOther(): OtherAccount {
  return { id: Math.random().toString(36).slice(2), platform: "", username: "", password: "", email: "", notes: "" };
}

// ── Entity Manager (full CRUD) ─────────────────────────────────────────────────
function EntityManager() {
  const { data, isLoading } = useListVaultEntries();
  const createMutation = useCreateVaultEntry();
  const deleteMutation = useDeleteVaultEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [qrAddress, setQrAddress] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [otherAccounts, setOtherAccounts] = useState<OtherAccount[]>([]);
  const [formTab, setFormTab] = useState("main");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "category">("date");
  const [filterCat, setFilterCat] = useState("all");
  const [pinned, setPinned] = useState<number[]>([]);
  const [viewEntry, setViewEntry] = useState<EntryAny | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const allEntries: EntryAny[] = (data as EntryAny[] | undefined) ?? [];

  const filteredEntities = (() => {
    let entries = [...allEntries];
    if (filterCat !== "all") entries = entries.filter(e => e.category === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(e =>
        (e.projectName?.toLowerCase().includes(q)) ||
        (e.email?.toLowerCase().includes(q)) ||
        (e.entitySerial?.toLowerCase().includes(q)) ||
        (e.twitterUsername?.toLowerCase().includes(q)) ||
        (e.notes?.toLowerCase().includes(q))
      );
    }
    if (sortBy === "name") entries = entries.sort((a, b) => (a.projectName ?? "").localeCompare(b.projectName ?? ""));
    else if (sortBy === "category") entries = entries.sort((a, b) => (a.category ?? "").localeCompare(b.category ?? ""));
    else entries = entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return [...entries.filter(e => pinned.includes(e.id)), ...entries.filter(e => !pinned.includes(e.id))];
  })();

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setOtherAccounts([]); setFormTab("main"); };

  const openEdit = (entry: EntryAny) => {
    setEditId(entry.id);
    setForm({
      category: entry.category ?? "",
      projectName: entry.projectName ?? "",
      email: entry.email ?? "",
      emailPassword: entry.emailPassword ?? "",
      emailRecovery: entry.emailRecovery ?? "",
      emailRecoveryPassword: entry.emailRecoveryPassword ?? "",
      twitterUsername: entry.twitterUsername ?? "",
      twitterPassword: entry.twitterPassword ?? "",
      twitterEmail: entry.twitterEmail ?? "",
      twitterEmailPassword: entry.twitterEmailPassword ?? "",
      twitterFollowers: entry.twitterFollowers ?? "",
      twitter2fa: entry.twitter2fa ?? "",
      twitterEmailRecovery: entry.twitterEmailRecovery ?? "",
      twitterEmailRecoveryPassword: entry.twitterEmailRecoveryPassword ?? "",
      discordUsername: entry.discordUsername ?? "",
      discordPassword: entry.discordPassword ?? "",
      discordEmail: entry.discordEmail ?? "",
      discordEmailPassword: entry.discordEmailPassword ?? "",
      discord2fa: entry.discord2fa ?? "",
      discordEmailRecovery: entry.discordEmailRecovery ?? "",
      discordEmailRecoveryPassword: entry.discordEmailRecoveryPassword ?? "",
      telegramUsername: entry.telegramUsername ?? "",
      telegramPassword: entry.telegramPassword ?? "",
      telegramPhone: entry.telegramPhone ?? "",
      telegram2fa: entry.telegram2fa ?? "",
      telegramLinkedEmail: entry.telegramLinkedEmail ?? "",
      telegramLinkedEmailPassword: entry.telegramLinkedEmailPassword ?? "",
      walletAddresses: Array.isArray(entry.walletAddresses) ? entry.walletAddresses.join("\n") : (entry.walletAddresses ?? ""),
      backupCodes: Array.isArray(entry.backupCodes) ? entry.backupCodes.join("\n") : (entry.backupCodes ?? ""),
      notes: entry.notes ?? "",
    });
    try {
      const others = entry.otherAccounts ? JSON.parse(entry.otherAccounts) : [];
      setOtherAccounts(others.map((o: any) => ({ ...o, id: Math.random().toString(36).slice(2) })));
    } catch { setOtherAccounts([]); }
    setFormTab("main");
    setOpen(true);
  };

  const addOther = () => setOtherAccounts(p => [...p, newOther()]);
  const updateOther = (id: string, u: OtherAccount) => setOtherAccounts(p => p.map(a => a.id === id ? u : a));
  const removeOther = (id: string) => setOtherAccounts(p => p.filter(a => a.id !== id));
  const togglePin = (id: number) => setPinned(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const exportVault = () => {
    const blob = new Blob([JSON.stringify(allEntries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const entries = JSON.parse(text);
      if (!Array.isArray(entries)) { toast({ variant: "destructive", title: "Invalid file — expected a JSON array" }); return; }
      let count = 0;
      for (const entry of entries) {
        const { id: _id, createdAt: _c, updatedAt: _u, userId: _uid, entitySerial: _s, ...rest } = entry;
        await createMutation.mutateAsync({ data: rest as any });
        count++;
      }
      toast({ title: `✅ Imported ${count} ${count === 1 ? "entity" : "entities"}` });
      queryClient.invalidateQueries();
    } catch {
      toast({ variant: "destructive", title: "Import failed", description: "File must be a valid vault JSON export" });
    }
    e.target.value = "";
  };

  const buildPayload = () => {
    const payload: Record<string, any> = { category: form.category, projectName: form.projectName };
    const strFields: (keyof typeof EMPTY_FORM)[] = [
      "email", "emailPassword", "emailRecovery", "emailRecoveryPassword",
      "twitterUsername", "twitterPassword", "twitterEmail", "twitterEmailPassword",
      "twitterFollowers", "twitter2fa", "twitterEmailRecovery", "twitterEmailRecoveryPassword",
      "discordUsername", "discordPassword", "discordEmail", "discordEmailPassword",
      "discord2fa", "discordEmailRecovery", "discordEmailRecoveryPassword",
      "telegramUsername", "telegramPassword", "telegramPhone", "telegram2fa",
      "telegramLinkedEmail", "telegramLinkedEmailPassword", "notes",
    ];
    for (const k of strFields) if (form[k]) payload[k] = form[k];
    if (form.walletAddresses) payload.walletAddresses = form.walletAddresses.split("\n").map(s => s.trim()).filter(Boolean);
    if (form.backupCodes) payload.backupCodes = form.backupCodes.split("\n").map(s => s.trim()).filter(Boolean);
    const validOther = otherAccounts.filter(a => a.platform.trim());
    if (validOther.length > 0) payload.otherAccounts = JSON.stringify(validOther.map(({ id: _id, ...rest }) => rest));
    return payload;
  };

  const handleCreate = () => {
    if (!form.category || !form.projectName) {
      toast({ variant: "destructive", title: "Category and Entity Name are required." });
      return;
    }
    createMutation.mutate({ data: buildPayload() as any }, {
      onSuccess: () => {
        toast({ title: "Entity secured" });
        queryClient.invalidateQueries();
        setOpen(false);
        resetForm();
        setEditId(null);
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create entity" }),
    });
  };

  const handleUpdate = async () => {
    if (!form.category || !form.projectName) {
      toast({ variant: "destructive", title: "Category and Entity Name are required." });
      return;
    }
    setSaving(true);
    try {
      await customFetch(`/vault/${editId}`, { method: "PATCH", body: JSON.stringify(buildPayload()) });
      toast({ title: "Entity updated" });
      queryClient.invalidateQueries();
      setOpen(false);
      resetForm();
      setEditId(null);
    } catch { toast({ variant: "destructive", title: "Failed to update entity" }); }
    finally { setSaving(false); }
  };

  const FORM_TABS = [
    { id: "main", label: "Main" },
    { id: "twitter", label: "Twitter" },
    { id: "discord", label: "Discord" },
    { id: "telegram", label: "Telegram" },
    { id: "wallet", label: "Wallet" },
    { id: "other", label: "Other" },
  ];

  const CATEGORY_COLORS: Record<string, string> = {
    DeFi: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5",
    NFT: "text-purple-400 border-purple-400/20 bg-purple-400/5",
    GameFi: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
    Layer2: "text-blue-400 border-blue-400/20 bg-blue-400/5",
    Testnet: "text-orange-400 border-orange-400/20 bg-orange-400/5",
    CEX: "text-amber-400 border-amber-400/20 bg-amber-400/5",
    Social: "text-pink-400 border-pink-400/20 bg-pink-400/5",
    Other: "text-muted-foreground border-border bg-muted/20",
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-8 font-mono text-xs h-8 bg-input" placeholder="Search entities..." />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-32 font-mono text-xs h-8 bg-input">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-mono text-xs">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-auto">
          <input type="file" ref={importRef} className="hidden" accept=".json" onChange={importVault} />
          <Button size="sm" variant="outline" onClick={exportVault} className="font-mono text-xs gap-1.5 h-8">
            <Download className="w-3 h-3" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} className="font-mono text-xs gap-1.5 h-8">
            <Upload className="w-3 h-3" /> Import
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setEditId(null); setOpen(true); }} className="font-mono text-xs gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" /> New Entity
          </Button>
        </div>
      </div>

      {/* Stats */}
      {allEntries.length > 0 && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/50">
          <span>{allEntries.length} entities</span>
          <span>·</span>
          <span>{allEntries.filter(e => e.twitter2fa || e.discord2fa || e.telegram2fa).length} with 2FA</span>
          <span>·</span>
          <span>{allEntries.filter(e => e.hasSeedPhrase).length} with seed</span>
        </div>
      )}

      {/* Entity grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-primary/40" />
          </div>
          <p className="font-mono text-sm text-muted-foreground/60">
            {search || filterCat !== "all" ? "No entities match your search" : "No entities yet — add your first"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredEntities.map(entry => (
            <div
              key={entry.id}
              className={cn(
                "bg-card border rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer group relative",
                pinned.includes(entry.id) ? "border-primary/30" : "border-card-border"
              )}
              onClick={() => setViewEntry(entry)}
            >
              {/* Category + pin */}
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className={cn("font-mono text-[9px] uppercase tracking-wider px-1.5", CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS["Other"])}>
                  {entry.category}
                </Badge>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); togglePin(entry.id); }}
                    className={cn("p-1 rounded transition-all", pinned.includes(entry.id) ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-400")}
                  >
                    <Star className="w-3 h-3" fill={pinned.includes(entry.id) ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(entry); }}
                    className="p-1 rounded text-muted-foreground/40 hover:text-primary transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteId(entry.id); }}
                    className="p-1 rounded text-muted-foreground/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <p className="font-mono text-sm font-bold text-foreground truncate mb-1">{entry.projectName}</p>
              <p className="font-mono text-[10px] text-muted-foreground/50 mb-3">{entry.entitySerial}</p>

              {/* Feature chips */}
              <div className="flex flex-wrap gap-1">
                {entry.email && <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">EMAIL</span>}
                {entry.twitterUsername && <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-sky-400/10 text-sky-400 border border-sky-400/20">TW</span>}
                {entry.discordUsername && <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-indigo-400/10 text-indigo-400 border border-indigo-400/20">DC</span>}
                {entry.telegramUsername && <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">TG</span>}
                {(entry.twitter2fa || entry.discord2fa || entry.telegram2fa) && <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">2FA</span>}
                {entry.hasSeedPhrase && <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 border border-violet-400/20">SEED</span>}
                {Array.isArray(entry.walletAddresses) && entry.walletAddresses.length > 0 && (
                  <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">WALLET</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View dialog */}
      <Dialog open={!!viewEntry} onOpenChange={() => setViewEntry(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
          {viewEntry && (
            <>
              <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0 border-b border-card-border">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="font-mono text-sm font-bold text-foreground truncate">{viewEntry.projectName}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn("font-mono text-[9px] px-1.5", CATEGORY_COLORS[viewEntry.category] ?? CATEGORY_COLORS["Other"])}>
                        {viewEntry.category}
                      </Badge>
                      <span className="font-mono text-[9px] text-muted-foreground/50">{viewEntry.entitySerial}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0">
                <PlatformSection title="Main" color="text-cyan-400" icon={Mail} fields={[
                  { label: "email", value: viewEntry.email },
                  { label: "pass", value: viewEntry.emailPassword },
                  { label: "recover", value: viewEntry.emailRecovery },
                  { label: "rec.pw", value: viewEntry.emailRecoveryPassword },
                ]} />
                <PlatformSection title="Twitter" color="text-sky-400" icon={AtSign} fields={[
                  { label: "user", value: viewEntry.twitterUsername },
                  { label: "pass", value: viewEntry.twitterPassword },
                  { label: "email", value: viewEntry.twitterEmail },
                  { label: "e.pass", value: viewEntry.twitterEmailPassword },
                  { label: "2fa", value: viewEntry.twitter2fa },
                  { label: "follow", value: viewEntry.twitterFollowers },
                ]} />
                <PlatformSection title="Discord" color="text-indigo-400" icon={Hash} fields={[
                  { label: "user", value: viewEntry.discordUsername },
                  { label: "pass", value: viewEntry.discordPassword },
                  { label: "email", value: viewEntry.discordEmail },
                  { label: "e.pass", value: viewEntry.discordEmailPassword },
                  { label: "2fa", value: viewEntry.discord2fa },
                ]} />
                <PlatformSection title="Telegram" color="text-blue-400" icon={Phone} fields={[
                  { label: "user", value: viewEntry.telegramUsername },
                  { label: "phone", value: viewEntry.telegramPhone },
                  { label: "pass", value: viewEntry.telegramPassword },
                  { label: "2fa", value: viewEntry.telegram2fa },
                  { label: "email", value: viewEntry.telegramLinkedEmail },
                  { label: "e.pass", value: viewEntry.telegramLinkedEmailPassword },
                ]} />

                {/* Wallet addresses */}
                {Array.isArray(viewEntry.walletAddresses) && viewEntry.walletAddresses.length > 0 && (
                  <div className="space-y-1 py-2 border-t border-border/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Wallet className="w-3 h-3 text-amber-400" />
                      <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-amber-400">Wallets</span>
                    </div>
                    {viewEntry.walletAddresses.map((addr: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        <span className="font-mono text-[11px] truncate text-foreground/80 flex-1">{addr}</span>
                        <CopyBtn value={addr} />
                        <button onClick={() => setQrAddress(addr)} className="text-muted-foreground/40 hover:text-primary p-1 transition-colors">
                          <QrCode className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Seed phrase status */}
                {viewEntry.hasSeedPhrase && (
                  <div className="py-2 border-t border-border/30">
                    <div className="flex items-center gap-1.5 py-1 px-2.5 bg-violet-400/5 border border-violet-400/20 rounded-lg">
                      <Shield className="w-3 h-3 text-violet-400" />
                      <span className="font-mono text-[10px] text-violet-400">Seed phrase encrypted & stored — view in Wallet tab</span>
                    </div>
                  </div>
                )}

                {/* Backup codes */}
                {Array.isArray(viewEntry.backupCodes) && viewEntry.backupCodes.length > 0 && (
                  <div className="py-2 border-t border-border/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lock className="w-3 h-3 text-orange-400" />
                      <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-orange-400">Backup Codes</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {viewEntry.backupCodes.map((code: string, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-muted/20 rounded px-2 py-0.5 border border-border/30">
                          <span className="font-mono text-[10px] text-foreground/70">{code}</span>
                          <CopyBtn value={code} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other accounts */}
                {(() => {
                  try {
                    const others = viewEntry.otherAccounts ? JSON.parse(viewEntry.otherAccounts) : [];
                    return others.length > 0 ? (
                      <div className="space-y-0.5 py-2 border-t border-border/30">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Smartphone className="w-3 h-3 text-orange-400" />
                          <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-orange-400">Other Accounts</span>
                        </div>
                        {others.map((acc: any, i: number) => (
                          <div key={i} className="ml-2 pb-2 mb-2 border-b border-border/20 last:border-0 last:mb-0 last:pb-0">
                            <p className="font-mono text-[9px] text-primary/60 uppercase tracking-wider mb-1">{acc.platform}</p>
                            {acc.username && <CredField label="user" value={acc.username} />}
                            {acc.password && <CredField label="pass" value={acc.password} />}
                            {acc.email && <CredField label="email" value={acc.email} />}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  } catch { return null; }
                })()}

                {viewEntry.notes && (
                  <div className="border-t border-border/30 pt-3 mt-1">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">Notes</p>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                      {viewEntry.notes}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="px-5 py-3 border-t border-card-border flex-shrink-0 bg-muted/5 flex items-center justify-between gap-2 sm:justify-between">
                <Button variant="outline" size="sm" onClick={() => { openEdit(viewEntry); setViewEntry(null); }} className="font-mono text-xs gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Edit Entity
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { setDeleteId(viewEntry.id); setViewEntry(null); }} className="font-mono text-xs gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={!!qrAddress} onOpenChange={() => setQrAddress(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Wallet QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-3">
            {qrAddress && <QRCodeSVG value={qrAddress} size={180} bgColor="transparent" fgColor="#22d3ee" />}
            <p className="font-mono text-[10px] text-muted-foreground/60 break-all text-center">{qrAddress}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Delete Entity?
            </DialogTitle>
          </DialogHeader>
          <p className="font-mono text-xs text-muted-foreground py-2">All credentials will be permanently deleted. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => {
              if (deleteId) {
                deleteMutation.mutate({ id: deleteId } as any, {
                  onSuccess: () => { toast({ title: "Entity deleted" }); queryClient.invalidateQueries(); setDeleteId(null); },
                  onError: () => toast({ variant: "destructive", title: "Failed to delete" }),
                });
              }
            }} className="font-mono text-xs">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) { setOpen(false); resetForm(); setEditId(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0 border-b border-card-border">
            <DialogTitle className="font-mono text-sm">{editId ? "Edit Entity" : "Add Entity"}</DialogTitle>
          </DialogHeader>

          {/* Form tabs */}
          <div className="px-5 pt-3 flex gap-1 flex-shrink-0 overflow-x-auto">
            {FORM_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setFormTab(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wider flex-shrink-0 transition-all",
                  formTab === t.id ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {formTab === "main" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Category *</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger className="font-mono text-xs h-8 bg-input"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Entity Name *</Label>
                    <Input value={form.projectName} onChange={f("projectName")} className="font-mono text-xs h-8 bg-input" placeholder="Protocol / Project name" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Main Email</Label>
                  <Input value={form.email} onChange={f("email")} className="font-mono text-xs h-8 bg-input" placeholder="account@email.com" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Email Password</Label>
                  <Input type="password" value={form.emailPassword} onChange={f("emailPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Recovery Email</Label>
                  <Input value={form.emailRecovery} onChange={f("emailRecovery")} className="font-mono text-xs h-8 bg-input" placeholder="recovery@email.com" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Notes</Label>
                  <Textarea value={form.notes} onChange={f("notes")} className="font-mono text-xs bg-input resize-none h-16" placeholder="Airdrop notes, important info..." />
                </div>
              </>
            )}
            {formTab === "twitter" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Username</Label><Input value={form.twitterUsername} onChange={f("twitterUsername")} className="font-mono text-xs h-8 bg-input" placeholder="@handle" /></div>
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Password</Label><Input type="password" value={form.twitterPassword} onChange={f("twitterPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Linked Email</Label><Input value={form.twitterEmail} onChange={f("twitterEmail")} className="font-mono text-xs h-8 bg-input" placeholder="tw@email.com" /></div>
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Email Password</Label><Input type="password" value={form.twitterEmailPassword} onChange={f("twitterEmailPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">2FA Secret</Label><Input value={form.twitter2fa} onChange={f("twitter2fa")} className="font-mono text-xs h-8 bg-input" placeholder="TOTP secret..." /></div>
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Followers</Label><Input value={form.twitterFollowers} onChange={f("twitterFollowers")} className="font-mono text-xs h-8 bg-input" placeholder="e.g. 1200" /></div>
                </div>
              </>
            )}
            {formTab === "discord" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Username</Label><Input value={form.discordUsername} onChange={f("discordUsername")} className="font-mono text-xs h-8 bg-input" placeholder="user#1234" /></div>
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Password</Label><Input type="password" value={form.discordPassword} onChange={f("discordPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Linked Email</Label><Input value={form.discordEmail} onChange={f("discordEmail")} className="font-mono text-xs h-8 bg-input" placeholder="dc@email.com" /></div>
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">2FA Secret</Label><Input value={form.discord2fa} onChange={f("discord2fa")} className="font-mono text-xs h-8 bg-input" placeholder="TOTP secret..." /></div>
                </div>
              </>
            )}
            {formTab === "telegram" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Username</Label><Input value={form.telegramUsername} onChange={f("telegramUsername")} className="font-mono text-xs h-8 bg-input" placeholder="@username" /></div>
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Phone</Label><Input value={form.telegramPhone} onChange={f("telegramPhone")} className="font-mono text-xs h-8 bg-input" placeholder="+1234567890" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">2FA Secret</Label><Input value={form.telegram2fa} onChange={f("telegram2fa")} className="font-mono text-xs h-8 bg-input" placeholder="TOTP secret..." /></div>
                  <div className="space-y-1"><Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Linked Email</Label><Input value={form.telegramLinkedEmail} onChange={f("telegramLinkedEmail")} className="font-mono text-xs h-8 bg-input" placeholder="tg@email.com" /></div>
                </div>
              </>
            )}
            {formTab === "other" && (
              <div className="space-y-3">
                {otherAccounts.map(a => (
                  <OtherAccountForm key={a.id} account={a} onChange={u => updateOther(a.id, u)} onRemove={() => removeOther(a.id)} />
                ))}
                <Button variant="outline" size="sm" onClick={addOther} className="font-mono text-xs gap-1.5 w-full">
                  <Plus className="w-3.5 h-3.5" /> Add Platform
                </Button>
              </div>
            )}
            {formTab === "wallet" && (
              <>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Wallet Addresses (one per line)</Label>
                  <Textarea value={form.walletAddresses} onChange={f("walletAddresses")} className="font-mono text-xs bg-input resize-none h-24" placeholder="0x1234...&#10;0xabcd..." />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Seed Phrase / Private Key</Label>
                  <Textarea value={""} disabled placeholder="Manage seed phrases in the Wallet section →" className="font-mono text-xs bg-input resize-none h-12 opacity-60" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground/60">Backup Codes (one per line)</Label>
                  <Textarea value={form.backupCodes} onChange={f("backupCodes")} className="font-mono text-xs bg-input resize-none h-20" placeholder="backup-code-1&#10;backup-code-2" />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t border-card-border flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); resetForm(); setEditId(null); }} className="font-mono text-xs">Cancel</Button>
            <Button size="sm" onClick={editId ? handleUpdate : handleCreate} disabled={createMutation.isPending || saving} className="font-mono text-xs gap-1.5">
              {(createMutation.isPending || saving) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editId ? "Save Changes" : "Secure Entity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Entity Tab wrapper (Dashboard + List) ───────────────────────────────────────
function EntityTab() {
  const [view, setView] = useState<"dashboard" | "list">("dashboard");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("dashboard")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all", view === "dashboard" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}
        >
          <LayoutDashboard className="w-3 h-3" /> Dashboard
        </button>
        <button
          onClick={() => setView("list")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all", view === "list" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}
        >
          <List className="w-3 h-3" /> Manage
        </button>
      </div>
      {view === "dashboard" ? (
        <Suspense fallback={<LoadingTab />}>
          <VaultEntityDashboard />
        </Suspense>
      ) : (
        <EntityManager />
      )}
    </div>
  );
}

// ── Local Tab wrapper (Dashboard + Account) ─────────────────────────────────────
function LocalTab() {
  const [view, setView] = useState<"dashboard" | "account">("dashboard");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("dashboard")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all", view === "dashboard" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}
        >
          <LayoutDashboard className="w-3 h-3" /> Dashboard
        </button>
        <button
          onClick={() => setView("account")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all", view === "account" ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/60 hover:text-muted-foreground")}
        >
          <Smartphone className="w-3 h-3" /> Account
        </button>
      </div>
      {view === "dashboard" ? (
        <Suspense fallback={<LoadingTab />}>
          <VaultLocalDashboard />
        </Suspense>
      ) : (
        <LocalAccounts />
      )}
    </div>
  );
}

// ── Main Vault Page ────────────────────────────────────────────────────────────
type VaultTab = "entity" | "wallet" | "local" | "2fa" | "mail";

const TAB_META: Record<VaultTab, { label: string; desc: string }> = {
  entity: { label: "Entity Vault",   desc: "Manage credentials and track entity health completeness" },
  wallet: { label: "Wallet & Seeds", desc: "Seed phrases encrypted per entity + real-time MetaMask connect" },
  local:  { label: "Local Accounts", desc: "Dashboard analytics and account management for local platforms" },
  "2fa":  { label: "2FA Codes",      desc: "Live TOTP codes from local accounts, entities, and manual entries" },
  mail:   { label: "Mail Hub",       desc: "All emails from entities and local accounts in one place" },
};

export default function UserVault() {
  const search = useSearch();
  const tab = (new URLSearchParams(search).get("tab") as VaultTab) || "entity";
  const meta = TAB_META[tab] ?? TAB_META["entity"];

  return (
    <div className="space-y-5 page-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            {meta.label}
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1 pl-0.5">{meta.desc}</p>
        </div>
      </div>

      <div className="min-h-0">
        {tab === "entity" && <EntityTab />}
        {tab === "local"  && <LocalTab />}
        {tab === "wallet" && (
          <Suspense fallback={<LoadingTab />}>
            <VaultWalletSeed />
          </Suspense>
        )}
        {tab === "2fa" && (
          <Suspense fallback={<LoadingTab />}>
            <VaultTwoFa />
          </Suspense>
        )}
        {tab === "mail" && (
          <Suspense fallback={<LoadingTab />}>
            <VaultMail />
          </Suspense>
        )}
      </div>
    </div>
  );
}
