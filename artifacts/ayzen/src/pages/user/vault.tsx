import { useState } from "react";
import { useListVaultEntries, useCreateVaultEntry, useDeleteVaultEntry } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, KeyRound, Trash2, Eye, EyeOff,
  Copy, Check, Mail, Hash, Lock, Shield,
  Users, Phone, AtSign, UserPlus, X, Smartphone,
  QrCode, Search, Download, Wallet, AlertTriangle, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import LocalAccounts from "@/components/local-accounts";
import { QRCodeSVG } from "qrcode.react";

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

function WalletQRModal({ address, onClose }: { address: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col items-center gap-4 w-[280px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between w-full">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">Wallet QR</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="bg-white p-3 rounded-lg">
          <QRCodeSVG value={address} size={180} bgColor="#ffffff" fgColor="#0a0a0a" />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/70 text-center break-all px-1">{address}</p>
      </div>
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

function CredField({ label, value, color = "text-muted-foreground" }: {
  label: string; value: string | null | undefined; color?: string;
}) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 group/row">
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
    <div className="space-y-1 py-2 border-t border-border/30 first:border-0 first:pt-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("w-3 h-3", color)} />
        <span className={cn("text-[9px] font-mono uppercase tracking-widest font-bold", color)}>{title}</span>
      </div>
      {fields.map(f => <CredField key={f.label} label={f.label} value={f.value} color={color} />)}
    </div>
  );
}

function TwoColInput({ label1, value1, onChange1, placeholder1, label2, value2, onChange2, placeholder2, type2 = "password" }: any) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="font-mono text-[10px] text-muted-foreground/60">{label1}</Label>
        <Input value={value1} onChange={onChange1} className="font-mono text-xs h-8 bg-input" placeholder={placeholder1} />
      </div>
      <div className="space-y-1">
        <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> {label2}</Label>
        <Input type={type2} value={value2} onChange={onChange2} className="font-mono text-xs h-8 bg-input" placeholder={placeholder2} />
      </div>
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

export default function UserVault() {
  const { data, isLoading } = useListVaultEntries();
  const createMutation = useCreateVaultEntry();
  const deleteMutation = useDeleteVaultEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [qrAddress, setQrAddress] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [otherAccounts, setOtherAccounts] = useState<OtherAccount[]>([]);
  const [formTab, setFormTab] = useState("main");
  const [activeTab, setActiveTab] = useState<"entities" | "wallets" | "2fa" | "local" | "other">("entities");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "category">("date");
  const [filterCat, setFilterCat] = useState("all");
  const [pinned, setPinned] = useState<number[]>([]);

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
        (e.notes?.toLowerCase().includes(q)) ||
        (Array.isArray(e.walletAddresses) && e.walletAddresses.some((a: string) => a.toLowerCase().includes(q)))
      );
    }
    if (sortBy === "name") entries = entries.sort((a, b) => (a.projectName ?? "").localeCompare(b.projectName ?? ""));
    else if (sortBy === "category") entries = entries.sort((a, b) => (a.category ?? "").localeCompare(b.category ?? ""));
    else entries = entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return [...entries.filter(e => pinned.includes(e.id)), ...entries.filter(e => !pinned.includes(e.id))];
  })();

  const totalWallets = allEntries.reduce((s, e) => s + (Array.isArray(e.walletAddresses) ? e.walletAddresses.length : 0), 0);
  const total2fa = allEntries.reduce((s, e) => s + (e.twitter2fa ? 1 : 0) + (e.discord2fa ? 1 : 0) + (e.telegram2fa ? 1 : 0), 0);
  const otherCount = allEntries.filter(e => e.category === "Other" || !e.category).length;
  const missing2fa = allEntries.filter(e => !e.twitter2fa && !e.discord2fa && !e.telegram2fa).length;

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const resetForm = () => { setForm({ ...EMPTY_FORM }); setOtherAccounts([]); setFormTab("main"); };

  const addOther = () => setOtherAccounts(p => [...p, newOther()]);
  const updateOther = (id: string, u: OtherAccount) => setOtherAccounts(p => p.map(a => a.id === id ? u : a));
  const removeOther = (id: string) => setOtherAccounts(p => p.filter(a => a.id !== id));

  const exportVault = () => {
    const blob = new Blob([JSON.stringify(allEntries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePin = (id: number) => setPinned(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleCreate = () => {
    if (!form.category || !form.projectName) {
      toast({ variant: "destructive", title: "Category and Entity Name are required." });
      return;
    }
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

    createMutation.mutate({ data: payload as any }, {
      onSuccess: () => {
        toast({ title: "Entity secured" });
        queryClient.invalidateQueries();
        setOpen(false);
        resetForm();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create entity" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Entity removed" }); queryClient.invalidateQueries(); setDeleteId(null); }
    });
  };

  const NAV_ITEMS = [
    { id: "entities" as const, label: "Entities",       icon: Hash,       count: allEntries.length },
    { id: "wallets"  as const, label: "Wallets",        icon: Wallet,     count: totalWallets },
    { id: "2fa"      as const, label: "2FA Codes",      icon: QrCode,     count: total2fa },
    { id: "local"    as const, label: "Local Accounts", icon: Smartphone, count: 0 },
    { id: "other"    as const, label: "Other",          icon: UserPlus,   count: otherCount },
  ];

  return (
    <div className="space-y-4 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-primary" /> Secure Vault
        </h1>
        <p className="text-muted-foreground font-mono text-xs mt-1">Entities · Wallets · 2FA · Local accounts</p>
      </div>

      {/* Main layout */}
      <div className="flex gap-5 min-h-0">

        {/* ── LEFT SIDEBAR ── */}
        <div className="w-52 flex-shrink-0 space-y-0.5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 px-2 mb-3 flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Sections
          </div>

          {NAV_ITEMS.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-mono text-xs transition-all text-left",
                activeTab === id
                  ? "bg-primary/15 text-primary font-bold border border-primary/20"
                  : "text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-3.5 h-3.5" /> {label}
              </div>
              {count > 0 && (
                <span className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded-full",
                  activeTab === id ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground/50"
                )}>{count}</span>
              )}
            </button>
          ))}

          {/* Quick actions */}
          <div className="pt-4 space-y-1.5 border-t border-border/20 mt-3">
            {activeTab === "entities" && (
              <Button size="sm" className="w-full font-mono text-[10px] uppercase tracking-wider gap-2 justify-start h-8" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Entity
              </Button>
            )}
            <Button size="sm" variant="outline" className="w-full font-mono text-[10px] gap-2 justify-start border-border/30 text-muted-foreground h-8" onClick={exportVault}>
              <Download className="w-3 h-3" /> Export JSON
            </Button>
          </div>

          {/* Vault stats */}
          {allEntries.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/20 space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 px-1">Stats</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Entities",   value: allEntries.length, color: "text-primary" },
                  { label: "Wallets",    value: totalWallets,      color: "text-emerald-400" },
                  { label: "2FA Codes",  value: total2fa,          color: "text-amber-400" },
                  { label: "Categories", value: new Set(allEntries.map(e => e.category)).size, color: "text-violet-400" },
                ].map(s => (
                  <div key={s.label} className="bg-muted/20 rounded-lg px-2 py-1.5">
                    <div className={cn("font-mono font-bold text-sm", s.color)}>{s.value}</div>
                    <div className="font-mono text-[8px] text-muted-foreground/50 uppercase tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health warning */}
          {missing2fa > 0 && allEntries.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-400/8 border border-amber-400/20">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="font-mono text-[9px] text-amber-400 font-bold uppercase tracking-wider">Health</span>
              </div>
              <p className="font-mono text-[9px] text-amber-400/70">{missing2fa} entit{missing2fa === 1 ? "y" : "ies"} missing 2FA</p>
            </div>
          )}
        </div>

        {/* ── RIGHT CONTENT ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* ── LOCAL ACCOUNTS ── */}
          {activeTab === "local" && <LocalAccounts />}

          {/* ── OTHER ── */}
          {activeTab === "other" && (() => {
            const otherEntries = allEntries.filter(e => e.category === "Other" || !e.category);
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{otherEntries.length} entities</span>
                  <Button size="sm" className="font-mono text-xs gap-2 h-7 px-3" onClick={() => setOpen(true)}><Plus className="w-3 h-3" /> New Entity</Button>
                </div>
                {isLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1, 2].map(i => <div key={i} className="h-32 bg-card border border-card-border rounded-xl animate-pulse" />)}
                  </div>
                ) : otherEntries.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 border border-dashed border-primary/20 rounded-xl">
                    <UserPlus className="w-8 h-8 text-primary/20" />
                    <div className="font-mono text-sm text-foreground/50">No "Other" entities</div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {otherEntries.map((entry: EntryAny) => (
                      <div key={entry.id} className="bg-card border border-card-border hover:border-primary/40 transition-all rounded-xl overflow-hidden group">
                        <div className="bg-gradient-to-r from-muted/20 to-transparent border-b border-card-border px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3 text-primary/60" />
                            <span className="font-mono font-bold text-primary text-xs tracking-[0.15em]">{entry.entitySerial || `AYZNA${entry.id}`}</span>
                          </div>
                          <button onClick={() => setDeleteId(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="px-4 py-3">
                          <div className="font-mono font-bold text-sm mb-2 flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-primary/40" />{entry.projectName}</div>
                          <PlatformSection title="Email" icon={Mail} color="text-emerald-400" fields={[{ label: "address", value: entry.email }, { label: "pass", value: entry.emailPassword }]} />
                          {entry.notes && <p className="text-[10px] font-mono text-muted-foreground/50 mt-2 truncate">{entry.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── 2FA CODES ── */}
          {activeTab === "2fa" && (() => {
            const twoFaEntries = allEntries.flatMap((entry: EntryAny) => {
              const codes: { entity: string; label: string; value: string }[] = [];
              if (entry.twitter2fa) codes.push({ entity: entry.projectName, label: "Twitter 2FA", value: entry.twitter2fa });
              if (entry.discord2fa) codes.push({ entity: entry.projectName, label: "Discord 2FA", value: entry.discord2fa });
              if (entry.telegram2fa) codes.push({ entity: entry.projectName, label: "Telegram 2FA", value: entry.telegram2fa });
              try {
                const other = entry.otherAccounts ? JSON.parse(entry.otherAccounts) : [];
                for (const o of other) {
                  if (o.twofa) codes.push({ entity: entry.projectName, label: `${o.platform} 2FA`, value: o.twofa });
                }
              } catch {}
              return codes;
            });
            return (
              <div className="space-y-3">
                {twoFaEntries.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 border border-dashed border-primary/20 rounded-xl">
                    <QrCode className="w-8 h-8 text-primary/20" />
                    <div className="font-mono text-sm text-foreground/50">No 2FA codes stored</div>
                    <div className="text-[10px] font-mono text-muted-foreground/40">Add 2FA secrets in your vault entities</div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {twoFaEntries.map((item, i) => <TwoFaCard key={i} entity={item.entity} label={item.label} value={item.value} />)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── WALLETS ── */}
          {activeTab === "wallets" && (() => {
            const walletItems = allEntries.flatMap((entry: EntryAny) =>
              (Array.isArray(entry.walletAddresses) ? entry.walletAddresses : []).map((addr: string) => ({
                entity: entry.projectName || entry.entitySerial || `AYZNA${entry.id}`,
                serial: entry.entitySerial || `AYZNA${entry.id}`,
                category: entry.category,
                address: addr,
              }))
            );
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{walletItems.length} address{walletItems.length !== 1 ? "es" : ""}</span>
                  {walletItems.length > 0 && (
                    <Button size="sm" variant="outline" className="font-mono text-[10px] gap-1.5 h-7 border-border/30" onClick={() => {
                      navigator.clipboard.writeText(walletItems.map(w => `${w.entity}: ${w.address}`).join("\n"));
                      toast({ title: "All wallets copied" });
                    }}>
                      <Copy className="w-3 h-3" /> Copy All
                    </Button>
                  )}
                </div>
                {walletItems.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 border border-dashed border-primary/20 rounded-xl">
                    <Wallet className="w-8 h-8 text-primary/20" />
                    <div className="font-mono text-sm text-foreground/50">No wallet addresses</div>
                    <div className="text-[10px] font-mono text-muted-foreground/40">Add wallet addresses in entity → Email tab</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {walletItems.map((w, i) => (
                      <div key={i} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/30 transition-all group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] text-primary/70 font-bold">{w.serial}</span>
                            <Badge variant="outline" className={cn("text-[8px] font-mono px-1.5 py-0", CATEGORY_COLORS[w.category] ?? CATEGORY_COLORS.Other)}>{w.category}</Badge>
                          </div>
                          <div className="font-mono text-xs text-muted-foreground/70 truncate">{w.address}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setQrAddress(w.address)} className="text-muted-foreground/40 hover:text-primary p-1.5 rounded hover:bg-primary/10 transition-all" title="QR Code">
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <CopyBtn value={w.address} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── ENTITIES ── */}
          {activeTab === "entities" && (
            <div className="space-y-3">
              {/* Search + Sort + Filter */}
              <div className="flex gap-2 flex-wrap items-center">
                <div className="relative flex-1 min-w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-8 font-mono text-xs h-8 bg-input" placeholder="Search entities, emails, wallets..." />
                  {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="h-8 px-2 rounded-lg border border-border/40 bg-input font-mono text-[10px] text-muted-foreground">
                  <option value="all">All categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex gap-1">
                  {(["date", "name", "category"] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)} className={cn(
                      "px-2.5 h-8 rounded-lg font-mono text-[10px] uppercase tracking-wider border transition-all",
                      sortBy === s ? "bg-primary/15 border-primary/30 text-primary" : "border-border/30 text-muted-foreground/50 hover:text-foreground"
                    )}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {isLoading ? (
                  [0, 1, 2, 3].map(i => (
                    <div key={i} className="bg-card border border-card-border rounded-xl overflow-hidden">
                      <div className="h-12 bg-primary/5" />
                      <div className="p-4 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                    </div>
                  ))
                ) : allEntries.length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center gap-4 border border-dashed border-primary/20 rounded-xl bg-primary/2">
                    <div className="w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center bg-primary/5">
                      <KeyRound className="h-7 w-7 text-primary/30" />
                    </div>
                    <div className="text-center">
                      <div className="font-mono font-bold text-foreground/70 mb-1">No entities yet</div>
                      <div className="text-xs font-mono text-muted-foreground/50">Create your first identity entity</div>
                    </div>
                    <Button size="sm" className="font-mono text-xs mt-1 gap-2" onClick={() => setOpen(true)}><Plus className="h-3 w-3" /> Create Entity</Button>
                  </div>
                ) : filteredEntities.length === 0 ? (
                  <div className="col-span-full py-10 text-center font-mono text-muted-foreground/50 text-sm">No entities match your search.</div>
                ) : (
                  filteredEntities.map((entry: EntryAny) => {
                    let parsedOther: OtherAccount[] = [];
                    try { if (entry.otherAccounts) parsedOther = JSON.parse(entry.otherAccounts); } catch {}
                    const isPinned = pinned.includes(entry.id);
                    const has2fa = !!(entry.twitter2fa || entry.discord2fa || entry.telegram2fa);

                    return (
                      <div key={entry.id} className={cn(
                        "bg-card border transition-all duration-300 rounded-xl overflow-hidden group hover-lift",
                        isPinned ? "border-primary/40 shadow-[0_0_12px_rgba(var(--primary-rgb),0.08)]" : "border-card-border hover:border-primary/30"
                      )}>
                        <div className="bg-gradient-to-r from-primary/8 to-transparent border-b border-card-border px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3 text-primary/60" />
                            <span className="font-mono font-bold text-primary text-xs tracking-[0.15em]">
                              {entry.entitySerial || `AYZNA${entry.id}`}
                            </span>
                            {isPinned && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {!has2fa && <span title="No 2FA" className="text-amber-400/60"><AlertTriangle className="w-3 h-3" /></span>}
                            <Badge variant="outline" className={cn("text-[9px] font-mono uppercase border font-bold px-2 py-0.5", CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.Other)}>
                              {entry.category}
                            </Badge>
                            <button onClick={() => togglePin(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-amber-400 transition-all p-0.5">
                              <Star className={cn("w-3.5 h-3.5", isPinned && "fill-amber-400 text-amber-400")} />
                            </button>
                            <button onClick={() => setDeleteId(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 transition-all p-0.5">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="px-4 pt-3 pb-1">
                          <div className="font-mono font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-primary/40" />
                            {entry.projectName}
                          </div>
                          <div className="space-y-0">
                            <PlatformSection title="Email" icon={Mail} color="text-emerald-400" fields={[
                              { label: "address", value: entry.email },
                              { label: "pass", value: entry.emailPassword },
                              { label: "recovery", value: entry.emailRecovery },
                            ]} />
                            <PlatformSection title="Twitter" icon={AtSign} color="text-sky-400" fields={[
                              { label: "handle", value: entry.twitterUsername ? `@${entry.twitterUsername}` : null },
                              { label: "pass", value: entry.twitterPassword },
                              { label: "email", value: entry.twitterEmail },
                              { label: "2fa", value: entry.twitter2fa },
                              { label: "follows", value: entry.twitterFollowers },
                            ]} />
                            <PlatformSection title="Discord" icon={Users} color="text-indigo-400" fields={[
                              { label: "user", value: entry.discordUsername },
                              { label: "pass", value: entry.discordPassword },
                              { label: "email", value: entry.discordEmail },
                              { label: "2fa", value: entry.discord2fa },
                            ]} />
                            <PlatformSection title="Telegram" icon={Phone} color="text-cyan-400" fields={[
                              { label: "user", value: entry.telegramUsername },
                              { label: "phone", value: entry.telegramPhone },
                              { label: "2fa", value: entry.telegram2fa },
                              { label: "email", value: entry.telegramLinkedEmail },
                            ]} />
                            {parsedOther.length > 0 && (
                              <div className="space-y-1 py-2 border-t border-border/30">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <UserPlus className="w-3 h-3 text-violet-400" />
                                  <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-violet-400">Other Accounts</span>
                                  <Badge variant="outline" className="text-[8px] font-mono ml-1 border-violet-400/20 text-violet-400/70 px-1 py-0">{parsedOther.length}</Badge>
                                </div>
                                {parsedOther.map((acc, i) => (
                                  <div key={i} className="pl-1">
                                    <span className="text-[9px] font-mono text-violet-400/70 font-bold">{acc.platform}</span>
                                    {acc.username && <CredField label="user" value={acc.username} />}
                                    {acc.password && <CredField label="pass" value={acc.password} />}
                                    {acc.email && <CredField label="email" value={acc.email} />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {Array.isArray(entry.walletAddresses) && entry.walletAddresses.length > 0 && (
                            <div className="space-y-1 py-2 border-t border-border/30">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <QrCode className="w-3 h-3 text-primary/60" />
                                <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-primary/70">Wallets</span>
                                <Badge variant="outline" className="text-[8px] font-mono ml-1 border-primary/20 text-primary/50 px-1 py-0">{entry.walletAddresses.length}</Badge>
                              </div>
                              {(entry.walletAddresses as string[]).map((addr: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 group/wallet">
                                  <span className="font-mono text-[10px] text-foreground/70 flex-1 truncate">{addr}</span>
                                  <div className="opacity-0 group-hover/wallet:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={() => setQrAddress(addr)} className="text-muted-foreground/40 hover:text-primary transition-all p-0.5" title="QR Code">
                                      <QrCode className="w-3 h-3" />
                                    </button>
                                    <CopyBtn value={addr} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {entry.notes && (
                            <div className="border-t border-border/30 pt-2 mt-2 pb-1">
                              <p className="text-[10px] font-mono text-muted-foreground/50 truncate">{entry.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="px-4 py-2 border-t border-border/20 flex items-center justify-between">
                          <span className="text-[9px] font-mono text-muted-foreground/30 tracking-wider">
                            {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {entry.email && <CopyBtn value={entry.email} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>{/* end right content */}
      </div>{/* end flex layout */}

      {/* QR Code Modal */}
      {qrAddress && <WalletQRModal address={qrAddress} onClose={() => setQrAddress(null)} />}

      {/* ── Create Dialog ── */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="bg-card border-card-border max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <Hash className="w-4 h-4" /> New Vault Entity
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">Each entity gets a unique AYZEN serial and holds all credentials for one account identity.</p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger className="font-mono text-xs h-9 border-border bg-input"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Entity Name *</Label>
                <Input value={form.projectName} onChange={f("projectName")} className="font-mono text-xs h-9 bg-input" placeholder="e.g. zkSync Main" />
              </div>
            </div>

            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="w-full grid grid-cols-5 h-8 font-mono text-[10px]">
                <TabsTrigger value="main" className="text-[10px] uppercase">Email</TabsTrigger>
                <TabsTrigger value="twitter" className="text-[10px] uppercase">Twitter</TabsTrigger>
                <TabsTrigger value="discord" className="text-[10px] uppercase">Discord</TabsTrigger>
                <TabsTrigger value="telegram" className="text-[10px] uppercase">Telegram</TabsTrigger>
                <TabsTrigger value="other" className="text-[10px] uppercase flex items-center gap-1">
                  Other{otherAccounts.length > 0 && <span className="w-4 h-4 rounded-full bg-violet-400/20 text-violet-400 flex items-center justify-center text-[9px]">{otherAccounts.length}</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-2 mt-3">
                <div className="p-3 rounded-lg bg-emerald-400/3 border border-emerald-400/10 space-y-2">
                  <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-emerald-400" /><span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Email Identity</span></div>
                  <TwoColInput label1="Address" value1={form.email} onChange1={f("email")} placeholder1="user@gmail.com" label2="Password" value2={form.emailPassword} onChange2={f("emailPassword")} placeholder2="••••••••" />
                  <TwoColInput label1="Recovery Email" value1={form.emailRecovery} onChange1={f("emailRecovery")} placeholder1="backup@gmail.com" label2="Recovery Pass" value2={form.emailRecoveryPassword} onChange2={f("emailRecoveryPassword")} placeholder2="••••••••" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60">Backup Codes (one per line)</Label>
                  <Textarea value={form.backupCodes} onChange={f("backupCodes")} className="font-mono text-xs bg-input min-h-[50px] resize-none" placeholder="8-digit codes..." />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60">Wallet Addresses (one per line)</Label>
                  <Textarea value={form.walletAddresses} onChange={f("walletAddresses")} className="font-mono text-xs bg-input min-h-[50px] resize-none" placeholder="0x..." />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60">Notes</Label>
                  <Textarea value={form.notes} onChange={f("notes")} className="font-mono text-xs bg-input min-h-[50px] resize-none" placeholder="Additional notes..." />
                </div>
              </TabsContent>

              <TabsContent value="twitter" className="mt-3">
                <div className="p-3 rounded-lg bg-sky-400/3 border border-sky-400/10 space-y-2">
                  <div className="flex items-center gap-1.5"><AtSign className="w-3 h-3 text-sky-400" /><span className="font-mono text-[10px] uppercase tracking-widest text-sky-400 font-bold">Twitter / X</span></div>
                  <TwoColInput label1="Username" value1={form.twitterUsername} onChange1={f("twitterUsername")} placeholder1="handle (no @)" label2="Password" value2={form.twitterPassword} onChange2={f("twitterPassword")} placeholder2="••••••••" />
                  <TwoColInput label1="Linked Email" value1={form.twitterEmail} onChange1={f("twitterEmail")} placeholder1="twitter@gmail.com" label2="Email Pass" value2={form.twitterEmailPassword} onChange2={f("twitterEmailPassword")} placeholder2="••••••••" />
                  <TwoColInput label1="Followers" value1={form.twitterFollowers} onChange1={f("twitterFollowers")} placeholder1="e.g. 1200" type2="text" label2="2FA Secret" value2={form.twitter2fa} onChange2={f("twitter2fa")} placeholder2="TOTP or backup" />
                  <TwoColInput label1="Recovery Email" value1={form.twitterEmailRecovery} onChange1={f("twitterEmailRecovery")} placeholder1="recovery@gmail.com" label2="Recovery Pass" value2={form.twitterEmailRecoveryPassword} onChange2={f("twitterEmailRecoveryPassword")} placeholder2="••••••••" />
                </div>
              </TabsContent>

              <TabsContent value="discord" className="mt-3">
                <div className="p-3 rounded-lg bg-indigo-400/3 border border-indigo-400/10 space-y-2">
                  <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-indigo-400" /><span className="font-mono text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Discord</span></div>
                  <TwoColInput label1="Username" value1={form.discordUsername} onChange1={f("discordUsername")} placeholder1="user#1234" label2="Password" value2={form.discordPassword} onChange2={f("discordPassword")} placeholder2="••••••••" />
                  <TwoColInput label1="Linked Email" value1={form.discordEmail} onChange1={f("discordEmail")} placeholder1="discord@gmail.com" label2="Email Pass" value2={form.discordEmailPassword} onChange2={f("discordEmailPassword")} placeholder2="••••••••" />
                  <TwoColInput label1="2FA Secret" value1={form.discord2fa} onChange1={f("discord2fa")} placeholder1="TOTP or backup" type2="text" label2="Recovery Email" value2={form.discordEmailRecovery} onChange2={f("discordEmailRecovery")} placeholder2="recovery@gmail.com" />
                  <div className="space-y-1">
                    <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Recovery Email Pass</Label>
                    <Input type="password" value={form.discordEmailRecoveryPassword} onChange={f("discordEmailRecoveryPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="telegram" className="mt-3">
                <div className="p-3 rounded-lg bg-cyan-400/3 border border-cyan-400/10 space-y-2">
                  <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-cyan-400" /><span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Telegram</span></div>
                  <TwoColInput label1="Username" value1={form.telegramUsername} onChange1={f("telegramUsername")} placeholder1="@username" label2="Phone" value2={form.telegramPhone} onChange2={f("telegramPhone")} placeholder2="+1234567890" type2="text" />
                  <TwoColInput label1="2FA Pass" value1={form.telegram2fa} onChange1={f("telegram2fa")} placeholder1="Cloud password" type2="text" label2="Linked Email" value2={form.telegramLinkedEmail} onChange2={f("telegramLinkedEmail")} placeholder2="tg@gmail.com" />
                  <div className="space-y-1">
                    <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Linked Email Pass</Label>
                    <Input type="password" value={form.telegramLinkedEmailPassword} onChange={f("telegramLinkedEmailPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="other" className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-violet-400" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-violet-400 font-bold">Other Accounts</span>
                  </div>
                  <Button size="sm" variant="outline" className="font-mono text-[10px] h-7 gap-1 border-violet-400/30 text-violet-400" onClick={addOther}>
                    <Plus className="w-3 h-3" /> Add Account
                  </Button>
                </div>
                {otherAccounts.length === 0 ? (
                  <div className="py-8 flex flex-col items-center gap-3 border border-dashed border-violet-400/20 rounded-xl">
                    <UserPlus className="w-6 h-6 text-violet-400/30" />
                    <div className="font-mono text-xs text-muted-foreground/50">Add GitHub, TikTok, Reddit, or any other platform</div>
                    <Button size="sm" variant="outline" className="font-mono text-[10px] h-7 gap-1 border-violet-400/30 text-violet-400" onClick={addOther}><Plus className="w-3 h-3" /> Add Account</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {otherAccounts.map(acc => (
                      <OtherAccountForm key={acc.id} account={acc} onChange={u => updateOther(acc.id, u)} onRemove={() => removeOther(acc.id)} />
                    ))}
                    <Button size="sm" variant="ghost" className="w-full font-mono text-[10px] h-7 gap-1 text-violet-400/60 hover:text-violet-400 border border-dashed border-violet-400/20" onClick={addOther}>
                      <Plus className="w-3 h-3" /> Add Another
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="font-mono uppercase text-xs tracking-wider gap-2">
              {createMutation.isPending ? <span className="animate-pulse">Securing...</span> : <><Shield className="h-4 w-4" /> Secure Entity</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-red-400 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-mono text-muted-foreground">This will permanently remove this vault entity and all its credentials.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId !== null && handleDelete(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">
              {deleteMutation.isPending ? "Deleting..." : "Delete Entity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
