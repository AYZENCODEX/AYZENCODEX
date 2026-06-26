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
  Loader2, Edit2, MoreVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import LocalAccounts from "@/components/local-accounts";
import { QRCodeSVG } from "qrcode.react";

const UserWallets = lazy(() => import("@/pages/user/wallets"));
const Authenticator = lazy(() => import("@/pages/user/authenticator"));

const CATEGORIES = ["DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Social", "Other"];

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
      <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0">
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

function TwoFaCard({ entity, label, value }: { entity: string; label: string; value: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 hover:border-primary/30 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{entity}</div>
          <div className="font-mono text-xs font-bold text-primary mt-0.5 flex items-center gap-1.5">
            <QrCode className="w-3 h-3" /> {label}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShown(s => !s)} className="text-muted-foreground/40 hover:text-primary transition-colors p-1.5 rounded-md hover:bg-primary/10">
            {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={copy} className={cn("p-1.5 rounded-md transition-all", copied ? "text-emerald-400 bg-emerald-400/10" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10")}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="font-mono text-sm bg-muted/20 rounded-lg px-3 py-2 border border-border/30 text-center tracking-widest">
        {shown ? value : "•".repeat(Math.min(value.length, 16))}
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

// ── Entity Tab ─────────────────────────────────────────────────────────────────
function EntityTab() {
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
  const total2fa = allEntries.reduce((s, e) => s + (e.twitter2fa ? 1 : 0) + (e.discord2fa ? 1 : 0) + (e.telegram2fa ? 1 : 0), 0);
  const missing2fa = allEntries.filter(e => !e.twitter2fa && !e.discord2fa && !e.telegram2fa).length;

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
      const token = localStorage.getItem("ayzen_token") ?? "";
      const res = await fetch(`/api/vault/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) {
        toast({ title: "Entity updated" });
        queryClient.invalidateQueries();
        setOpen(false);
        resetForm();
        setEditId(null);
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: d.error ?? "Failed to update entity" });
      }
    } catch {
      toast({ variant: "destructive", title: "Connection error" });
    }
    setSaving(false);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Entity removed" }); queryClient.invalidateQueries(); setDeleteId(null); }
    });
  };

  const isEditing = editId !== null;

  const EntityFormContent = (
    <>
      {/* Form tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg flex-wrap">
        {[
          { id: "main", label: "Main" }, { id: "twitter", label: "Twitter" },
          { id: "discord", label: "Discord" }, { id: "telegram", label: "Telegram" },
          { id: "other", label: "Other" }, { id: "wallet", label: "Wallet" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFormTab(t.id)}
            className={cn(
              "flex-1 py-1 rounded-md font-mono text-[9px] uppercase tracking-wider transition-all",
              formTab === t.id ? "bg-card text-primary shadow-sm font-bold" : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >{t.label}</button>
        ))}
      </div>

      <div className="space-y-3 py-1">
        {formTab === "main" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-8 font-mono text-xs bg-input">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Entity Name *</Label>
                <Input value={form.projectName} onChange={f("projectName")} className="h-8 font-mono text-xs bg-input" placeholder="Project / protocol name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Email</Label>
                <Input value={form.email} onChange={f("email")} className="h-8 font-mono text-xs bg-input" placeholder="main@email.com" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Email Pass</Label>
                <Input type="password" value={form.emailPassword} onChange={f("emailPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Recovery Email</Label>
                <Input value={form.emailRecovery} onChange={f("emailRecovery")} className="h-8 font-mono text-xs bg-input" placeholder="recovery@email.com" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Recovery Pass</Label>
                <Input type="password" value={form.emailRecoveryPassword} onChange={f("emailRecoveryPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Backup Codes</Label>
              <Textarea value={form.backupCodes} onChange={f("backupCodes")} className="font-mono text-xs bg-input min-h-[55px] resize-none" placeholder="Paste backup codes (one per line)" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Notes</Label>
              <Textarea value={form.notes} onChange={f("notes")} className="font-mono text-xs bg-input min-h-[55px] resize-none" placeholder="Any notes..." />
            </div>
          </div>
        )}

        {formTab === "twitter" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Username</Label><Input value={form.twitterUsername} onChange={f("twitterUsername")} className="h-8 font-mono text-xs bg-input" placeholder="@handle" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label><Input type="password" value={form.twitterPassword} onChange={f("twitterPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Linked Email</Label><Input value={form.twitterEmail} onChange={f("twitterEmail")} className="h-8 font-mono text-xs bg-input" placeholder="twitter@email.com" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Email Pass</Label><Input type="password" value={form.twitterEmailPassword} onChange={f("twitterEmailPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Followers</Label><Input value={form.twitterFollowers} onChange={f("twitterFollowers")} className="h-8 font-mono text-xs bg-input" placeholder="e.g. 1200" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">2FA Secret</Label><Input value={form.twitter2fa} onChange={f("twitter2fa")} className="h-8 font-mono text-xs bg-input" placeholder="TOTP secret key" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Recovery Email</Label><Input value={form.twitterEmailRecovery} onChange={f("twitterEmailRecovery")} className="h-8 font-mono text-xs bg-input" placeholder="recovery@email.com" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Recovery Pass</Label><Input type="password" value={form.twitterEmailRecoveryPassword} onChange={f("twitterEmailRecoveryPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" /></div>
            </div>
          </div>
        )}

        {formTab === "discord" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Username</Label><Input value={form.discordUsername} onChange={f("discordUsername")} className="h-8 font-mono text-xs bg-input" placeholder="User#1234" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label><Input type="password" value={form.discordPassword} onChange={f("discordPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Email</Label><Input value={form.discordEmail} onChange={f("discordEmail")} className="h-8 font-mono text-xs bg-input" placeholder="discord@email.com" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Email Pass</Label><Input type="password" value={form.discordEmailPassword} onChange={f("discordEmailPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">2FA Secret</Label><Input value={form.discord2fa} onChange={f("discord2fa")} className="h-8 font-mono text-xs bg-input" placeholder="TOTP secret key" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Recovery Email</Label><Input value={form.discordEmailRecovery} onChange={f("discordEmailRecovery")} className="h-8 font-mono text-xs bg-input" placeholder="recovery@email.com" /></div>
            </div>
          </div>
        )}

        {formTab === "telegram" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Username</Label><Input value={form.telegramUsername} onChange={f("telegramUsername")} className="h-8 font-mono text-xs bg-input" placeholder="@username" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label><Input type="password" value={form.telegramPassword} onChange={f("telegramPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Phone</Label><Input value={form.telegramPhone} onChange={f("telegramPhone")} className="h-8 font-mono text-xs bg-input" placeholder="+1234567890" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">2FA Secret</Label><Input value={form.telegram2fa} onChange={f("telegram2fa")} className="h-8 font-mono text-xs bg-input" placeholder="TOTP secret key" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase">Linked Email</Label><Input value={form.telegramLinkedEmail} onChange={f("telegramLinkedEmail")} className="h-8 font-mono text-xs bg-input" placeholder="linked@email.com" /></div>
              <div className="space-y-1"><Label className="font-mono text-[10px] text-muted-foreground/60 uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Email Pass</Label><Input type="password" value={form.telegramLinkedEmailPassword} onChange={f("telegramLinkedEmailPassword")} className="h-8 font-mono text-xs bg-input" placeholder="••••••••" /></div>
            </div>
          </div>
        )}

        {formTab === "other" && (
          <div className="space-y-3">
            {otherAccounts.map(a => (
              <OtherAccountForm key={a.id} account={a} onChange={u => updateOther(a.id, u)} onRemove={() => removeOther(a.id)} />
            ))}
            <Button variant="outline" size="sm" className="w-full h-8 font-mono text-[10px] border-dashed border-border/60 gap-1.5 text-muted-foreground" onClick={addOther}>
              <Plus className="w-3 h-3" /> Add Account
            </Button>
          </div>
        )}

        {formTab === "wallet" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Wallet Addresses</Label>
              <Textarea value={form.walletAddresses} onChange={f("walletAddresses")} className="font-mono text-xs bg-input min-h-[100px] resize-none" placeholder="Paste wallet addresses (one per line)" />
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="pl-8 h-8 font-mono text-xs bg-input"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-8 w-[120px] font-mono text-xs bg-input">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="h-8 w-[100px] font-mono text-xs bg-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">By Date</SelectItem>
            <SelectItem value="name">By Name</SelectItem>
            <SelectItem value="category">By Category</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 ml-auto">
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importVault} />
          <Button size="sm" variant="outline" className="h-8 font-mono text-[10px] gap-1.5 border-border/40 text-muted-foreground" onClick={() => importRef.current?.click()}>
            <Upload className="w-3 h-3" /> Import
          </Button>
          <Button size="sm" variant="outline" className="h-8 font-mono text-[10px] gap-1.5 border-border/40 text-muted-foreground" onClick={exportVault}>
            <Download className="w-3 h-3" /> Export
          </Button>
          <Button size="sm" className="h-8 font-mono text-[10px] uppercase tracking-wider gap-1.5" onClick={() => { resetForm(); setEditId(null); setOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> New Entity
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {allEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Entities", value: allEntries.length, color: "text-primary" },
            { label: "2FA Codes", value: total2fa, color: "text-amber-400" },
            { label: "Categories", value: new Set(allEntries.map(e => e.category)).size, color: "text-violet-400" },
            { label: "Security", value: missing2fa > 0 ? `${missing2fa} gaps` : "100%", color: missing2fa > 0 ? "text-amber-400" : "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-card-border rounded-xl px-4 py-3">
              <div className={cn("font-mono font-bold text-lg leading-none", s.color)}>{s.value}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Health warning */}
      {missing2fa > 0 && allEntries.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/8 border border-amber-400/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="font-mono text-[10px] text-amber-400">{missing2fa} entit{missing2fa === 1 ? "y" : "ies"} missing 2FA protection</p>
        </div>
      )}

      {/* Entity list */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0,1,2,3].map(i => <div key={i} className="h-48 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-4 border border-dashed border-primary/15 rounded-2xl bg-primary/2">
          <div className="w-16 h-16 rounded-2xl border border-primary/20 flex items-center justify-center bg-primary/5">
            <Shield className="w-7 h-7 text-primary/30" />
          </div>
          <div className="text-center">
            <div className="font-mono font-bold text-foreground/60 mb-1">No entities yet</div>
            <div className="text-[10px] font-mono text-muted-foreground/40">Create your first vault entity to secure your credentials</div>
          </div>
          <Button size="sm" className="gap-2 font-mono text-xs" onClick={() => { resetForm(); setEditId(null); setOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> Create First Entity
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entry: EntryAny) => (
            <div
              key={entry.id}
              className="bg-card border border-card-border hover:border-primary/40 transition-all rounded-xl group relative cursor-pointer"
              onClick={() => { setMenuOpenId(null); setViewEntry(entry); }}
            >
              {/* Pin */}
              <button
                onClick={e => { e.stopPropagation(); togglePin(entry.id); }}
                className={cn("absolute top-2 left-2 p-1 rounded transition-all z-10 opacity-0 group-hover:opacity-100", pinned.includes(entry.id) ? "text-amber-400 opacity-100" : "text-muted-foreground/30 hover:text-amber-400")}
              >
                <Star className="w-3 h-3" fill={pinned.includes(entry.id) ? "currentColor" : "none"} />
              </button>

              {/* 3-dot menu button (always right side) */}
              <div className="absolute top-2 right-2 z-20">
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === entry.id ? null : entry.id); }}
                  className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-all"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {menuOpenId === entry.id && (
                  <>
                  <div className="fixed inset-0 z-[25]" onClick={e => { e.stopPropagation(); setMenuOpenId(null); }} />
                  <div className="absolute right-0 top-7 bg-popover border border-border rounded-lg shadow-xl min-w-[130px] overflow-hidden z-30">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(entry); setMenuOpenId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Edit2 className="w-3 h-3" /> Edit Entity
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteId(entry.id); setMenuOpenId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-[11px] text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                  </>
                )}
              </div>

              {/* Header */}
              <div className="bg-gradient-to-r from-primary/8 to-transparent border-b border-card-border px-4 py-3 flex items-center gap-2 pr-10 pl-8">
                <Hash className="w-3 h-3 text-primary/60 flex-shrink-0" />
                <span className="font-mono font-bold text-primary text-xs tracking-[0.15em] truncate">{entry.entitySerial || `AYZNA${entry.id}`}</span>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono font-bold text-sm text-foreground truncate">{entry.projectName}</span>
                  {entry.category && (
                    <Badge className={cn("text-[9px] font-mono px-1.5 py-0 border flex-shrink-0", CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.Other)}>
                      {entry.category}
                    </Badge>
                  )}
                </div>
                <PlatformSection title="Email" icon={Mail} color="text-emerald-400" fields={[
                  { label: "address", value: entry.email },
                  { label: "pass", value: entry.emailPassword },
                  { label: "recovery", value: entry.emailRecovery },
                ]} />
                <PlatformSection title="Twitter" icon={AtSign} color="text-sky-400" fields={[
                  { label: "handle", value: entry.twitterUsername },
                  { label: "pass", value: entry.twitterPassword },
                  { label: "2fa", value: entry.twitter2fa },
                ]} />
                <PlatformSection title="Discord" icon={Hash} color="text-indigo-400" fields={[
                  { label: "user", value: entry.discordUsername },
                  { label: "pass", value: entry.discordPassword },
                  { label: "2fa", value: entry.discord2fa },
                ]} />
                <PlatformSection title="Telegram" icon={Phone} color="text-blue-400" fields={[
                  { label: "user", value: entry.telegramUsername },
                  { label: "phone", value: entry.telegramPhone },
                  { label: "2fa", value: entry.telegram2fa },
                ]} />
                {entry.notes && <p className="text-[9px] font-mono text-muted-foreground/40 truncate border-t border-border/20 pt-1.5 mt-1.5">{entry.notes}</p>}
                <div className="pt-1 flex items-center justify-end">
                  <span className="text-[8px] font-mono text-primary/30 uppercase tracking-widest">Click to view all credentials →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setQrAddress(null)}>
          <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col items-center gap-4 w-[280px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <span className="font-mono text-xs uppercase tracking-widest text-primary">Wallet QR</span>
              <button onClick={() => setQrAddress(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG value={qrAddress} size={180} bgColor="#ffffff" fgColor="#0a0a0a" />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/70 text-center break-all px-1">{qrAddress}</p>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); resetForm(); setEditId(null); } }}>
        <DialogContent className="bg-card border-card-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              {isEditing ? <Edit2 className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              {isEditing ? "Edit Vault Entity" : "New Vault Entity"}
            </DialogTitle>
          </DialogHeader>
          {EntityFormContent}
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); setEditId(null); }} className="font-mono text-xs">Cancel</Button>
            <Button
              onClick={isEditing ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || saving}
              className="font-mono text-xs uppercase tracking-wider"
            >
              {(createMutation.isPending || saving) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isEditing ? "Save Changes" : "Secure Entity")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-red-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Entity?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm font-mono text-muted-foreground">This will permanently delete all credentials stored in this entity. This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Entity Dialog ── */}
      <Dialog open={viewEntry !== null} onOpenChange={o => !o && setViewEntry(null)}>
        <DialogContent className="bg-card border-card-border max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          {viewEntry && (
            <>
              {/* Header */}
              <DialogHeader className="px-5 pt-5 pb-4 border-b border-card-border flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                  <span className="font-mono font-bold text-primary tracking-[0.15em] text-sm">
                    {viewEntry.entitySerial || `AYZNA${viewEntry.id}`}
                  </span>
                </div>
                <DialogTitle className="flex items-center gap-2 flex-wrap font-mono font-bold text-foreground text-base">
                  {viewEntry.projectName}
                  {viewEntry.category && (
                    <Badge className={cn("text-[9px] font-mono px-1.5 py-0 border", CATEGORY_COLORS[viewEntry.category] ?? CATEGORY_COLORS.Other)}>
                      {viewEntry.category}
                    </Badge>
                  )}
                </DialogTitle>
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mt-1 flex items-center gap-1.5">
                  <Eye className="w-2.5 h-2.5" /> Hover any field → eye icon reveals value
                </p>
              </DialogHeader>

              {/* Scrollable credential content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
                <PlatformSection title="Email" icon={Mail} color="text-emerald-400" fields={[
                  { label: "address", value: viewEntry.email },
                  { label: "password", value: viewEntry.emailPassword },
                  { label: "recovery", value: viewEntry.emailRecovery },
                  { label: "rcv pass", value: viewEntry.emailRecoveryPassword },
                ]} />
                <PlatformSection title="Twitter / X" icon={AtSign} color="text-sky-400" fields={[
                  { label: "handle", value: viewEntry.twitterUsername },
                  { label: "password", value: viewEntry.twitterPassword },
                  { label: "email", value: viewEntry.twitterEmail },
                  { label: "email pw", value: viewEntry.twitterEmailPassword },
                  { label: "2fa secret", value: viewEntry.twitter2fa },
                  { label: "followers", value: viewEntry.twitterFollowers },
                  { label: "rcv email", value: viewEntry.twitterEmailRecovery },
                  { label: "rcv pw", value: viewEntry.twitterEmailRecoveryPassword },
                ]} />
                <PlatformSection title="Discord" icon={Hash} color="text-indigo-400" fields={[
                  { label: "username", value: viewEntry.discordUsername },
                  { label: "password", value: viewEntry.discordPassword },
                  { label: "email", value: viewEntry.discordEmail },
                  { label: "email pw", value: viewEntry.discordEmailPassword },
                  { label: "2fa secret", value: viewEntry.discord2fa },
                  { label: "rcv email", value: viewEntry.discordEmailRecovery },
                  { label: "rcv pw", value: viewEntry.discordEmailRecoveryPassword },
                ]} />
                <PlatformSection title="Telegram" icon={Phone} color="text-blue-400" fields={[
                  { label: "username", value: viewEntry.telegramUsername },
                  { label: "phone", value: viewEntry.telegramPhone },
                  { label: "password", value: viewEntry.telegramPassword },
                  { label: "2fa secret", value: viewEntry.telegram2fa },
                  { label: "linked email", value: viewEntry.telegramLinkedEmail },
                  { label: "linked pw", value: viewEntry.telegramLinkedEmailPassword },
                ]} />

                {/* Wallet addresses */}
                {viewEntry.walletAddresses && (Array.isArray(viewEntry.walletAddresses) ? viewEntry.walletAddresses : []).length > 0 && (
                  <div className="space-y-0.5 py-2 border-t border-border/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Wallet className="w-3 h-3 text-cyan-400" />
                      <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-cyan-400">Wallets</span>
                    </div>
                    {(Array.isArray(viewEntry.walletAddresses) ? viewEntry.walletAddresses : []).map((addr: string, i: number) => (
                      <CredField key={i} label={`wallet ${i + 1}`} value={addr} />
                    ))}
                  </div>
                )}

                {/* Backup codes */}
                {viewEntry.backupCodes && (Array.isArray(viewEntry.backupCodes) ? viewEntry.backupCodes : []).length > 0 && (
                  <div className="space-y-0.5 py-2 border-t border-border/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-3 h-3 text-violet-400" />
                      <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-violet-400">Backup Codes</span>
                    </div>
                    {(Array.isArray(viewEntry.backupCodes) ? viewEntry.backupCodes : []).map((code: string, i: number) => (
                      <CredField key={i} label={`code ${i + 1}`} value={code} />
                    ))}
                  </div>
                )}

                {/* Other accounts */}
                {viewEntry.otherAccounts && (() => {
                  try {
                    const others = JSON.parse(viewEntry.otherAccounts);
                    return Array.isArray(others) && others.length > 0 ? (
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

                {/* Notes */}
                {viewEntry.notes && (
                  <div className="border-t border-border/30 pt-3 mt-1">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">Notes</p>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                      {viewEntry.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <DialogFooter className="px-5 py-3 border-t border-card-border flex-shrink-0 bg-muted/5 flex items-center justify-between gap-2 sm:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { openEdit(viewEntry); setViewEntry(null); }}
                  className="font-mono text-xs gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Entity
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { setDeleteId(viewEntry.id); setViewEntry(null); }}
                  className="font-mono text-xs gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Vault Page ────────────────────────────────────────────────────────────
type VaultTab = "entity" | "wallet" | "local" | "2fa";

export default function UserVault() {
  const search = useSearch();
  const tab = (new URLSearchParams(search).get("tab") as VaultTab) || "entity";

  return (
    <div className="space-y-5 page-enter">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            DAO Vault
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1 pl-0.5">
            {tab === "entity" && "Secure command center for all your accounts & credentials"}
            {tab === "wallet" && "Manage and track your blockchain wallets"}
            {tab === "local" && "Local platform accounts manager"}
            {tab === "2fa" && "Two-factor authentication codes"}
          </p>
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0">
        {tab === "entity" && <EntityTab />}
        {tab === "2fa" && (
          <Suspense fallback={<LoadingTab />}>
            <Authenticator />
          </Suspense>
        )}
        {tab === "local" && <LocalAccounts />}
        {tab === "wallet" && (
          <Suspense fallback={<LoadingTab />}>
            <UserWallets />
          </Suspense>
        )}
      </div>
    </div>
  );
}
