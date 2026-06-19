import { useState } from "react";
import { useListVaultEntries, useCreateVaultEntry, useDeleteVaultEntry } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, KeyRound, Trash2, Eye, EyeOff, Twitter, MessageCircle, Wallet, Copy, Check, Mail, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Social", "Other"];

function MaskedValue({ value, label, icon: Icon }: { value: string; label: string; icon?: React.ElementType }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono">
      {Icon && <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      <span className="text-muted-foreground min-w-[52px] flex-shrink-0">{label}</span>
      <span className="flex-1 truncate text-foreground/80">{shown ? value : "••••••••"}</span>
      <button onClick={() => setShown(s => !s)} className="text-muted-foreground/50 hover:text-foreground ml-1 flex-shrink-0">{shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
      <button onClick={copy} className={`flex-shrink-0 ${copied ? "text-green-400" : "text-muted-foreground/50 hover:text-primary"}`}>{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</button>
    </div>
  );
}

export default function UserVault() {
  const { data, isLoading } = useListVaultEntries();
  const createMutation = useCreateVaultEntry();
  const deleteMutation = useDeleteVaultEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "", projectName: "", email: "", twitterUsername: "", discordUsername: "", telegramUsername: "", walletAddresses: "", backupCodes: "", notes: "" });

  const resetForm = () => setForm({ category: "", projectName: "", email: "", twitterUsername: "", discordUsername: "", telegramUsername: "", walletAddresses: "", backupCodes: "", notes: "" });

  const handleCreate = () => {
    if (!form.category || !form.projectName) { toast({ variant: "destructive", title: "Category and Entity Name are required." }); return; }
    createMutation.mutate({
      data: {
        category: form.category, projectName: form.projectName,
        email: form.email || undefined,
        twitterUsername: form.twitterUsername || undefined,
        discordUsername: form.discordUsername || undefined,
        telegramUsername: form.telegramUsername || undefined,
        walletAddresses: form.walletAddresses ? form.walletAddresses.split("\n").map(s => s.trim()).filter(Boolean) : undefined,
        backupCodes: form.backupCodes ? form.backupCodes.split("\n").map(s => s.trim()).filter(Boolean) : undefined,
        notes: form.notes || undefined,
      }
    }, {
      onSuccess: () => { toast({ title: "Entity secured", description: "New vault entity created." }); queryClient.invalidateQueries(); setOpen(false); resetForm(); },
      onError: () => toast({ variant: "destructive", title: "Failed to create entity" })
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, { onSuccess: () => { toast({ title: "Entity removed" }); queryClient.invalidateQueries(); setDeleteId(null); } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" /> Secure Vault
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">Identity entities — each entity is one complete account identity used to join protocols</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2 self-start sm:self-auto" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Entity
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ))
        ) : !data || data.length === 0 ? (
          <div className="col-span-full py-16 text-center font-mono text-muted-foreground bg-card border border-card-border border-dashed rounded-md flex flex-col items-center gap-3">
            <KeyRound className="h-10 w-10 opacity-20" />
            <div><div className="font-bold mb-1">No entities yet</div><div className="text-xs opacity-70">Create your first identity entity to join protocols</div></div>
            <Button size="sm" className="font-mono text-xs mt-2 gap-2" onClick={() => setOpen(true)}><Plus className="h-3 w-3" /> Create Entity</Button>
          </div>
        ) : (
          data.map((entry) => (
            <div key={entry.id} className="bg-card border border-card-border hover:border-primary/30 transition-colors rounded-lg overflow-hidden group">
              {/* Serial header */}
              <div className="bg-primary/5 border-b border-card-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono font-bold text-primary text-sm tracking-widest">{entry.entitySerial || `AYZNA${entry.id}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-mono uppercase border-primary/20 text-muted-foreground">{entry.category}</Badge>
                  <button onClick={() => setDeleteId(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Entity name */}
              <div className="px-4 pt-3 pb-2">
                <div className="font-mono font-bold text-sm text-foreground mb-3">{entry.projectName}</div>
                <div className="space-y-1.5">
                  {entry.email && <MaskedValue value={entry.email} label="Email" icon={Mail} />}
                  {entry.twitterUsername && <MaskedValue value={`@${entry.twitterUsername}`} label="Twitter" icon={Twitter} />}
                  {entry.discordUsername && <MaskedValue value={entry.discordUsername} label="Discord" icon={MessageCircle} />}
                  {entry.telegramUsername && <MaskedValue value={entry.telegramUsername} label="Telegram" icon={MessageCircle} />}
                  {Array.isArray(entry.walletAddresses) && entry.walletAddresses.length > 0 && (
                    <MaskedValue value={(entry.walletAddresses as string[])[0]} label="Wallet" icon={Wallet} />
                  )}
                  {Array.isArray(entry.walletAddresses) && entry.walletAddresses.length > 1 && (
                    <div className="text-[10px] font-mono text-muted-foreground/50 pl-5">+{entry.walletAddresses.length - 1} more wallets</div>
                  )}
                </div>
              </div>
              {entry.notes && (
                <div className="px-4 pb-3">
                  <div className="text-[10px] font-mono text-muted-foreground/60 border-t border-border pt-2 mt-1 truncate">{entry.notes}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Entity Dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="bg-card border-card-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <Hash className="w-4 h-4" /> Create Vault Entity
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">Each entity gets a unique serial (AYZNA{"{id}"}) and holds all credentials for one account identity.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="font-mono text-xs h-10 border-border bg-input"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Entity Name *</Label>
                <Input value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} className="font-mono text-xs h-10 bg-input" placeholder="e.g. zkSync Main Acc" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email Address</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="font-mono text-xs h-10 bg-input" placeholder="account@gmail.com" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Twitter Username</Label>
                <Input value={form.twitterUsername} onChange={e => setForm(f => ({ ...f, twitterUsername: e.target.value }))} className="font-mono text-xs h-10 bg-input" placeholder="handle (no @)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Discord</Label>
                  <Input value={form.discordUsername} onChange={e => setForm(f => ({ ...f, discordUsername: e.target.value }))} className="font-mono text-xs h-10 bg-input" placeholder="user#1234" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Telegram</Label>
                  <Input value={form.telegramUsername} onChange={e => setForm(f => ({ ...f, telegramUsername: e.target.value }))} className="font-mono text-xs h-10 bg-input" placeholder="@username" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Wallet Addresses <span className="text-muted-foreground/50">(one per line)</span></Label>
              <Textarea value={form.walletAddresses} onChange={e => setForm(f => ({ ...f, walletAddresses: e.target.value }))} className="font-mono text-xs bg-input min-h-[70px] resize-none" placeholder={"0x1234...\n0xabcd..."} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Backup Codes / Seeds <span className="text-muted-foreground/50">(one per line)</span></Label>
              <Textarea value={form.backupCodes} onChange={e => setForm(f => ({ ...f, backupCodes: e.target.value }))} className="font-mono text-xs bg-input min-h-[55px] resize-none" placeholder="word1 word2 word3..." />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="font-mono text-xs bg-input min-h-[50px] resize-none" placeholder="Any extra info..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="font-mono text-xs gap-2">
              <Hash className="w-3 h-3" />{createMutation.isPending ? "Securing..." : "Create Entity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader><DialogTitle className="font-mono text-sm text-red-400">Delete Entity</DialogTitle></DialogHeader>
          <p className="text-xs font-mono text-muted-foreground">This entity and all its credentials will be permanently deleted. Any project enrollments using this entity will also be removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
