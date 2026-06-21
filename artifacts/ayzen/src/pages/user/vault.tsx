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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, KeyRound, Trash2, Eye, EyeOff,
  Copy, Check, Mail, Hash, Lock, Shield,
  ChevronDown, Users, Phone, AtSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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

function FormSection({ title, color, icon: Icon, children }: {
  title: string; color: string; icon: React.ElementType; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={cn(
        "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
        open ? "bg-opacity-10 border-opacity-30" : "border-border/30 hover:border-opacity-50",
        `bg-${color.replace("text-", "")}/5 border-${color.replace("text-", "")}/20`
      )}>
        <div className="flex items-center gap-2">
          <Icon className={cn("w-3.5 h-3.5", color)} />
          <span className={cn("font-mono text-[10px] uppercase tracking-widest font-bold", color)}>{title}</span>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", color, open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn("mt-1 p-3 rounded-lg border space-y-2", `bg-${color.replace("text-", "")}/3 border-${color.replace("text-", "")}/10`)}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
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

type EntryAny = any;

const EMPTY_FORM = {
  category: "", projectName: "",
  // Email
  email: "", emailPassword: "", emailRecovery: "", emailRecoveryPassword: "",
  // Twitter
  twitterUsername: "", twitterPassword: "", twitterEmail: "", twitterEmailPassword: "",
  twitterFollowers: "", twitter2fa: "", twitterEmailRecovery: "", twitterEmailRecoveryPassword: "",
  // Discord
  discordUsername: "", discordPassword: "", discordEmail: "", discordEmailPassword: "",
  discord2fa: "", discordEmailRecovery: "", discordEmailRecoveryPassword: "",
  // Telegram
  telegramUsername: "", telegramPassword: "", telegramPhone: "", telegram2fa: "",
  telegramLinkedEmail: "", telegramLinkedEmailPassword: "",
  // Other
  walletAddresses: "", backupCodes: "", notes: "",
};

export default function UserVault() {
  const { data, isLoading } = useListVaultEntries();
  const createMutation = useCreateVaultEntry();
  const deleteMutation = useDeleteVaultEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const resetForm = () => setForm({ ...EMPTY_FORM });

  const handleCreate = () => {
    if (!form.category || !form.projectName) {
      toast({ variant: "destructive", title: "Category and Entity Name are required." });
      return;
    }
    const payload: Record<string, any> = {
      category: form.category, projectName: form.projectName,
    };
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

    createMutation.mutate({ data: payload as any }, {
      onSuccess: () => {
        toast({ title: "Entity secured", description: "Vault entity created with credentials." });
        queryClient.invalidateQueries();
        setOpen(false);
        resetForm();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create entity" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      { onSuccess: () => { toast({ title: "Entity removed" }); queryClient.invalidateQueries(); setDeleteId(null); } }
    );
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" /> Secure Vault
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">
            Each entity holds all credentials for one complete account identity
          </p>
        </div>
        <Button
          className="font-mono uppercase text-xs tracking-wider gap-2 self-start sm:self-auto animate-glow-pulse"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" /> New Entity
        </Button>
      </div>

      {/* Entity Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="h-12 bg-primary/5" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))
        ) : !data || data.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center gap-4 border border-dashed border-primary/20 rounded-xl bg-primary/2">
            <div className="w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center bg-primary/5">
              <KeyRound className="h-7 w-7 text-primary/30" />
            </div>
            <div className="text-center">
              <div className="font-mono font-bold text-foreground/70 mb-1">No entities yet</div>
              <div className="text-xs font-mono text-muted-foreground/50">Create your first identity entity to start tracking credentials</div>
            </div>
            <Button size="sm" className="font-mono text-xs mt-1 gap-2" onClick={() => setOpen(true)}>
              <Plus className="h-3 w-3" /> Create Entity
            </Button>
          </div>
        ) : (
          (data as EntryAny[]).map((entry) => (
            <div
              key={entry.id}
              className="bg-card border border-card-border hover:border-primary/40 transition-all duration-300 rounded-xl overflow-hidden group hover-lift hover-shimmer"
            >
              {/* Serial + category header */}
              <div className="bg-gradient-to-r from-primary/8 to-transparent border-b border-card-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-3 h-3 text-primary/60" />
                  <span className="font-mono font-bold text-primary text-xs tracking-[0.15em]">
                    {entry.entitySerial || `AYZNA${entry.id}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-mono uppercase border font-bold px-2 py-0.5",
                      CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.Other
                    )}
                  >
                    {entry.category}
                  </Badge>
                  <button
                    onClick={() => setDeleteId(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 transition-all duration-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Entity name */}
              <div className="px-4 pt-3 pb-1">
                <div className="font-mono font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary/40" />
                  {entry.projectName}
                </div>

                {/* Credential groups */}
                <div className="space-y-0">
                  <PlatformSection
                    title="Email"
                    icon={Mail}
                    color="text-emerald-400"
                    fields={[
                      { label: "address", value: entry.email },
                      { label: "pass", value: entry.emailPassword },
                      { label: "recovery", value: entry.emailRecovery },
                    ]}
                  />
                  <PlatformSection
                    title="Twitter"
                    icon={AtSign}
                    color="text-sky-400"
                    fields={[
                      { label: "handle", value: entry.twitterUsername ? `@${entry.twitterUsername}` : null },
                      { label: "pass", value: entry.twitterPassword },
                      { label: "email", value: entry.twitterEmail },
                      { label: "2fa", value: entry.twitter2fa },
                      { label: "follows", value: entry.twitterFollowers },
                    ]}
                  />
                  <PlatformSection
                    title="Discord"
                    icon={Users}
                    color="text-indigo-400"
                    fields={[
                      { label: "user", value: entry.discordUsername },
                      { label: "pass", value: entry.discordPassword },
                      { label: "email", value: entry.discordEmail },
                      { label: "2fa", value: entry.discord2fa },
                    ]}
                  />
                  <PlatformSection
                    title="Telegram"
                    icon={Phone}
                    color="text-cyan-400"
                    fields={[
                      { label: "user", value: entry.telegramUsername },
                      { label: "phone", value: entry.telegramPhone },
                      { label: "2fa", value: entry.telegram2fa },
                      { label: "email", value: entry.telegramLinkedEmail },
                    ]}
                  />
                </div>

                {entry.notes && (
                  <div className="border-t border-border/30 pt-2 mt-2 pb-1">
                    <p className="text-[10px] font-mono text-muted-foreground/50 truncate">{entry.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer timestamp */}
              <div className="px-4 py-2 border-t border-border/20">
                <span className="text-[9px] font-mono text-muted-foreground/30 tracking-wider">
                  {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="bg-card border-card-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <Hash className="w-4 h-4" /> New Vault Entity
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">
              Each entity gets a unique AYZEN serial and holds all credentials for one account identity.
            </p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Category + Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger className="font-mono text-xs h-9 border-border bg-input">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Entity Name *</Label>
                <Input
                  value={form.projectName}
                  onChange={f("projectName")}
                  className="font-mono text-xs h-9 bg-input"
                  placeholder="e.g. zkSync Main"
                />
              </div>
            </div>

            {/* Email Section */}
            <div className="space-y-2 p-3 rounded-lg bg-emerald-400/3 border border-emerald-400/10">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-emerald-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Email Identity</span>
              </div>
              <TwoColInput
                label1="Address" value1={form.email} onChange1={f("email")} placeholder1="user@gmail.com"
                label2="Password" value2={form.emailPassword} onChange2={f("emailPassword")} placeholder2="••••••••"
              />
              <TwoColInput
                label1="Recovery Email" value1={form.emailRecovery} onChange1={f("emailRecovery")} placeholder1="backup@gmail.com"
                label2="Recovery Pass" value2={form.emailRecoveryPassword} onChange2={f("emailRecoveryPassword")} placeholder2="••••••••"
              />
            </div>

            {/* Twitter Section */}
            <div className="space-y-2 p-3 rounded-lg bg-sky-400/3 border border-sky-400/10">
              <div className="flex items-center gap-1.5">
                <AtSign className="w-3 h-3 text-sky-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400 font-bold">Twitter / X</span>
              </div>
              <TwoColInput
                label1="Username" value1={form.twitterUsername} onChange1={f("twitterUsername")} placeholder1="handle (no @)"
                label2="Password" value2={form.twitterPassword} onChange2={f("twitterPassword")} placeholder2="••••••••"
              />
              <TwoColInput
                label1="Linked Email" value1={form.twitterEmail} onChange1={f("twitterEmail")} placeholder1="twitter@gmail.com"
                label2="Email Pass" value2={form.twitterEmailPassword} onChange2={f("twitterEmailPassword")} placeholder2="••••••••"
              />
              <TwoColInput
                label1="Followers" value1={form.twitterFollowers} onChange1={f("twitterFollowers")} placeholder1="e.g. 1200" type2="text"
                label2="2FA Secret" value2={form.twitter2fa} onChange2={f("twitter2fa")} placeholder2="TOTP or backup"
              />
              <TwoColInput
                label1="Recovery Email" value1={form.twitterEmailRecovery} onChange1={f("twitterEmailRecovery")} placeholder1="recovery@gmail.com"
                label2="Recovery Pass" value2={form.twitterEmailRecoveryPassword} onChange2={f("twitterEmailRecoveryPassword")} placeholder2="••••••••"
              />
            </div>

            {/* Discord Section */}
            <div className="space-y-2 p-3 rounded-lg bg-indigo-400/3 border border-indigo-400/10">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-indigo-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Discord</span>
              </div>
              <TwoColInput
                label1="Username" value1={form.discordUsername} onChange1={f("discordUsername")} placeholder1="user#1234"
                label2="Password" value2={form.discordPassword} onChange2={f("discordPassword")} placeholder2="••••••••"
              />
              <TwoColInput
                label1="Linked Email" value1={form.discordEmail} onChange1={f("discordEmail")} placeholder1="discord@gmail.com"
                label2="Email Pass" value2={form.discordEmailPassword} onChange2={f("discordEmailPassword")} placeholder2="••••••••"
              />
              <TwoColInput
                label1="2FA Secret" value1={form.discord2fa} onChange1={f("discord2fa")} placeholder1="TOTP or backup" type2="text"
                label2="Recovery Email" value2={form.discordEmailRecovery} onChange2={f("discordEmailRecovery")} placeholder2="recovery@gmail.com"
              />
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Recovery Email Pass</Label>
                <Input type="password" value={form.discordEmailRecoveryPassword} onChange={f("discordEmailRecoveryPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
              </div>
            </div>

            {/* Telegram Section */}
            <div className="space-y-2 p-3 rounded-lg bg-cyan-400/3 border border-cyan-400/10">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-cyan-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Telegram</span>
              </div>
              <TwoColInput
                label1="Username" value1={form.telegramUsername} onChange1={f("telegramUsername")} placeholder1="@username"
                label2="Phone" value2={form.telegramPhone} onChange2={f("telegramPhone")} placeholder2="+1234567890" type2="text"
              />
              <TwoColInput
                label1="2FA Pass" value1={form.telegram2fa} onChange1={f("telegram2fa")} placeholder1="Cloud password" type2="text"
                label2="Linked Email" value2={form.telegramLinkedEmail} onChange2={f("telegramLinkedEmail")} placeholder2="tg@gmail.com"
              />
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Linked Email Pass</Label>
                <Input type="password" value={form.telegramLinkedEmailPassword} onChange={f("telegramLinkedEmailPassword")} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
              </div>
            </div>

            {/* Wallets */}
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                Wallet Addresses <span className="text-muted-foreground/40">(one per line)</span>
              </Label>
              <Textarea
                value={form.walletAddresses}
                onChange={f("walletAddresses")}
                className="font-mono text-xs bg-input min-h-[60px] resize-none"
                placeholder={"0x1234...\n0xabcd..."}
              />
            </div>

            {/* Backup codes */}
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Backup Codes / Seeds <span className="text-muted-foreground/40">(one per line)</span>
              </Label>
              <Textarea
                value={form.backupCodes}
                onChange={f("backupCodes")}
                className="font-mono text-xs bg-input min-h-[50px] resize-none"
                placeholder="word1 word2 word3..."
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={f("notes")}
                className="font-mono text-xs bg-input min-h-[45px] resize-none"
                placeholder="Any extra info..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} className="font-mono text-xs">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="font-mono text-xs gap-2 animate-glow-pulse">
              <Hash className="w-3 h-3" />
              {createMutation.isPending ? "Securing..." : "Create Entity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-red-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Entity
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              This will permanently delete the vault entity and all stored credentials. This cannot be undone.
            </p>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId !== null && handleDelete(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
