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
import {
  Plus, KeyRound, Trash2, Eye, EyeOff, Twitter, MessageCircle, Wallet,
  Copy, Check, Mail, Hash, Lock, Shield,
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

function CredField({ label, value, icon: Icon, color = "text-muted-foreground" }: {
  label: string; value: string | null | undefined; icon?: React.ElementType; color?: string;
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
      <div className={cn("w-3 h-3 flex-shrink-0", color)}>
        {Icon && <Icon className="w-3 h-3" />}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider w-12 flex-shrink-0">{label}</span>
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

function CredGroup({ title, icon: Icon, color, fields }: {
  title: string; icon: React.ElementType; color: string;
  fields: { label: string; value: string | null | undefined; }[];
}) {
  const hasAny = fields.some(f => f.value);
  if (!hasAny) return null;
  return (
    <div className="space-y-1 py-2 border-t border-border/30 first:border-0 first:pt-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("w-3 h-3", color)} />
        <span className={cn("text-[9px] font-mono uppercase tracking-widest font-bold", color)}>{title}</span>
      </div>
      {fields.map(f => <CredField key={f.label} label={f.label} value={f.value} color={color} />)}
    </div>
  );
}

type EntryAny = any;

export default function UserVault() {
  const { data, isLoading } = useListVaultEntries();
  const createMutation = useCreateVaultEntry();
  const deleteMutation = useDeleteVaultEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    category: "", projectName: "",
    email: "", emailPassword: "",
    twitterUsername: "", twitterPassword: "",
    discordUsername: "", discordPassword: "",
    telegramUsername: "", telegramPassword: "",
    walletAddresses: "", backupCodes: "", notes: "",
  });

  const resetForm = () => setForm({
    category: "", projectName: "",
    email: "", emailPassword: "",
    twitterUsername: "", twitterPassword: "",
    discordUsername: "", discordPassword: "",
    telegramUsername: "", telegramPassword: "",
    walletAddresses: "", backupCodes: "", notes: "",
  });

  const handleCreate = () => {
    if (!form.category || !form.projectName) {
      toast({ variant: "destructive", title: "Category and Entity Name are required." });
      return;
    }
    createMutation.mutate({
      data: {
        category: form.category,
        projectName: form.projectName,
        email: form.email || undefined,
        ...(form.emailPassword ? { emailPassword: form.emailPassword } : {}),
        twitterUsername: form.twitterUsername || undefined,
        ...(form.twitterPassword ? { twitterPassword: form.twitterPassword } : {}),
        discordUsername: form.discordUsername || undefined,
        ...(form.discordPassword ? { discordPassword: form.discordPassword } : {}),
        telegramUsername: form.telegramUsername || undefined,
        ...(form.telegramPassword ? { telegramPassword: form.telegramPassword } : {}),
        walletAddresses: form.walletAddresses
          ? form.walletAddresses.split("\n").map(s => s.trim()).filter(Boolean)
          : undefined,
        backupCodes: form.backupCodes
          ? form.backupCodes.split("\n").map(s => s.trim()).filter(Boolean)
          : undefined,
        notes: form.notes || undefined,
      } as any,
    }, {
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
                  <CredGroup
                    title="Email"
                    icon={Mail}
                    color="text-emerald-400"
                    fields={[
                      { label: "address", value: entry.email },
                      { label: "password", value: (entry as any).emailPassword },
                    ]}
                  />
                  <CredGroup
                    title="Twitter"
                    icon={Twitter}
                    color="text-sky-400"
                    fields={[
                      { label: "handle", value: entry.twitterUsername ? `@${entry.twitterUsername}` : null },
                      { label: "pass", value: (entry as any).twitterPassword },
                    ]}
                  />
                  <CredGroup
                    title="Discord"
                    icon={MessageCircle}
                    color="text-indigo-400"
                    fields={[
                      { label: "user", value: entry.discordUsername },
                      { label: "pass", value: (entry as any).discordPassword },
                    ]}
                  />
                  <CredGroup
                    title="Telegram"
                    icon={MessageCircle}
                    color="text-cyan-400"
                    fields={[
                      { label: "user", value: entry.telegramUsername },
                      { label: "pass", value: (entry as any).telegramPassword },
                    ]}
                  />
                  {Array.isArray(entry.walletAddresses) && entry.walletAddresses.length > 0 && (
                    <div className="space-y-1 py-2 border-t border-border/30">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wallet className="w-3 h-3 text-amber-400" />
                        <span className="text-[9px] font-mono uppercase tracking-widest font-bold text-amber-400">Wallets</span>
                      </div>
                      {(entry.walletAddresses as string[]).slice(0, 2).map((addr: string, idx: number) => (
                        <CredField key={idx} label={`${idx + 1}`} value={addr} color="text-amber-400" />
                      ))}
                      {entry.walletAddresses.length > 2 && (
                        <div className="text-[10px] font-mono text-muted-foreground/40 pl-5">+{entry.walletAddresses.length - 2} more</div>
                      )}
                    </div>
                  )}
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

          <div className="space-y-4 py-2">
            {/* Category + Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
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
                  onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))}
                  className="font-mono text-xs h-9 bg-input"
                  placeholder="e.g. zkSync Main"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2 p-3 rounded-lg bg-emerald-400/3 border border-emerald-400/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Mail className="w-3 h-3 text-emerald-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Email</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60">Address</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="user@gmail.com" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label>
                  <Input type="password" value={form.emailPassword} onChange={e => setForm(f => ({ ...f, emailPassword: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
                </div>
              </div>
            </div>

            {/* Twitter */}
            <div className="space-y-2 p-3 rounded-lg bg-sky-400/3 border border-sky-400/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Twitter className="w-3 h-3 text-sky-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400 font-bold">Twitter / X</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60">Username</Label>
                  <Input value={form.twitterUsername} onChange={e => setForm(f => ({ ...f, twitterUsername: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="handle (no @)" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label>
                  <Input type="password" value={form.twitterPassword} onChange={e => setForm(f => ({ ...f, twitterPassword: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
                </div>
              </div>
            </div>

            {/* Discord */}
            <div className="space-y-2 p-3 rounded-lg bg-indigo-400/3 border border-indigo-400/10">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-3 h-3 text-indigo-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Discord</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60">Username</Label>
                  <Input value={form.discordUsername} onChange={e => setForm(f => ({ ...f, discordUsername: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="user#1234" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label>
                  <Input type="password" value={form.discordPassword} onChange={e => setForm(f => ({ ...f, discordPassword: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
                </div>
              </div>
            </div>

            {/* Telegram */}
            <div className="space-y-2 p-3 rounded-lg bg-cyan-400/3 border border-cyan-400/10">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-3 h-3 text-cyan-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Telegram</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60">Username</Label>
                  <Input value={form.telegramUsername} onChange={e => setForm(f => ({ ...f, telegramUsername: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="@username" />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Password</Label>
                  <Input type="password" value={form.telegramPassword} onChange={e => setForm(f => ({ ...f, telegramPassword: e.target.value }))} className="font-mono text-xs h-8 bg-input" placeholder="••••••••" />
                </div>
              </div>
            </div>

            {/* Wallets */}
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Wallet className="w-3 h-3 text-amber-400" /> Wallet Addresses
                <span className="text-muted-foreground/40">(one per line)</span>
              </Label>
              <Textarea
                value={form.walletAddresses}
                onChange={e => setForm(f => ({ ...f, walletAddresses: e.target.value }))}
                className="font-mono text-xs bg-input min-h-[60px] resize-none"
                placeholder={"0x1234...\n0xabcd..."}
              />
            </div>

            {/* Backup codes */}
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Backup Codes / Seeds
                <span className="text-muted-foreground/40">(one per line)</span>
              </Label>
              <Textarea
                value={form.backupCodes}
                onChange={e => setForm(f => ({ ...f, backupCodes: e.target.value }))}
                className="font-mono text-xs bg-input min-h-[50px] resize-none"
                placeholder="word1 word2 word3..."
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
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
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-red-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Entity
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs font-mono text-muted-foreground">
            This entity and all its credentials will be permanently deleted.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleteMutation.isPending}
              className="font-mono text-xs"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
