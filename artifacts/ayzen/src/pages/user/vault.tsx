import { useState } from "react";
import { useListVaultEntries, useCreateVaultEntry, useDeleteVaultEntry } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, KeyRound, Trash2, Eye, EyeOff, Twitter, MessageCircle, Wallet, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["DeFi", "NFT", "GameFi", "Layer2", "Testnet", "CEX", "Social", "Other"];

function MaskedField({ value, label }: { value: string; label: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground min-w-[60px]">{label}:</span>
      <span className="flex-1 truncate font-mono text-foreground/90">{shown ? value : "••••••••••••"}</span>
      <button onClick={() => setShown(s => !s)} className="text-muted-foreground hover:text-foreground transition-colors">
        {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors">
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      </button>
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
  const [form, setForm] = useState({
    category: "",
    projectName: "",
    twitterUsername: "",
    discordUsername: "",
    telegramUsername: "",
    walletAddresses: "",
    backupCodes: "",
    notes: "",
  });

  const handleCreate = () => {
    if (!form.category || !form.projectName) {
      toast({ variant: "destructive", title: "Missing fields", description: "Category and Project Name are required." });
      return;
    }
    createMutation.mutate({
      data: {
        category: form.category,
        projectName: form.projectName,
        twitterUsername: form.twitterUsername || undefined,
        discordUsername: form.discordUsername || undefined,
        telegramUsername: form.telegramUsername || undefined,
        walletAddresses: form.walletAddresses ? form.walletAddresses.split("\n").map(s => s.trim()).filter(Boolean) : undefined,
        backupCodes: form.backupCodes ? form.backupCodes.split("\n").map(s => s.trim()).filter(Boolean) : undefined,
        notes: form.notes || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Entry secured", description: `${form.projectName} added to vault.` });
        queryClient.invalidateQueries();
        setOpen(false);
        setForm({ category: "", projectName: "", twitterUsername: "", discordUsername: "", telegramUsername: "", walletAddresses: "", backupCodes: "", notes: "" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to save entry" })
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Entry removed" });
        queryClient.invalidateQueries();
        setDeleteId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Secure Vault</h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">Encrypted credential storage for all your protocols</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2 self-start sm:self-auto" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Entry
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-5 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ))
        ) : !data || data.length === 0 ? (
          <div className="col-span-full py-16 text-center font-mono text-muted-foreground bg-card border border-card-border border-dashed rounded-md flex flex-col items-center justify-center gap-3">
            <KeyRound className="h-10 w-10 text-muted-foreground opacity-30" />
            <div>
              <div className="font-bold mb-1">Vault is empty</div>
              <div className="text-xs text-muted-foreground/70">Secure your first protocol credentials</div>
            </div>
            <Button size="sm" className="font-mono text-xs mt-2 gap-2" onClick={() => setOpen(true)}>
              <Plus className="h-3 w-3" /> Add First Entry
            </Button>
          </div>
        ) : (
          data.map((entry) => (
            <Card key={entry.id} className="bg-card border-card-border shadow-none hover:border-primary/20 transition-colors group">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="font-mono text-sm font-bold text-primary">{entry.projectName}</CardTitle>
                  <Badge variant="outline" className="text-[9px] font-mono mt-1 border-primary/20 text-muted-foreground uppercase">
                    {entry.category}
                  </Badge>
                </div>
                <button
                  onClick={() => setDeleteId(entry.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs font-mono">
                {entry.twitterUsername && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Twitter className="w-3 h-3 text-sky-400 flex-shrink-0" />
                    <span className="text-foreground/80">@{entry.twitterUsername}</span>
                  </div>
                )}
                {entry.discordUsername && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageCircle className="w-3 h-3 text-violet-400 flex-shrink-0" />
                    <span className="text-foreground/80">{entry.discordUsername}</span>
                  </div>
                )}
                {entry.walletAddresses && entry.walletAddresses.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    <span className="text-foreground/80 truncate">{entry.walletAddresses[0]}</span>
                    {entry.walletAddresses.length > 1 && (
                      <span className="text-muted-foreground/50 flex-shrink-0">+{entry.walletAddresses.length - 1}</span>
                    )}
                  </div>
                )}
                {entry.backupCodes && Array.isArray(entry.backupCodes) && entry.backupCodes.length > 0 && (
                  <MaskedField value={(entry.backupCodes as string[]).join(", ")} label="Codes" />
                )}
                {entry.notes && (
                  <div className="text-muted-foreground/70 text-[10px] pt-1 border-t border-border truncate">{entry.notes}</div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-card-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> New Vault Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="font-mono text-xs h-10 border-border bg-input">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Project Name *</Label>
                <Input value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} className="font-mono text-xs h-10 border-border bg-input" placeholder="e.g. zkSync Era" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Twitter Username</Label>
                <Input value={form.twitterUsername} onChange={e => setForm(f => ({ ...f, twitterUsername: e.target.value }))} className="font-mono text-xs h-10 border-border bg-input" placeholder="@handle (without @)" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Discord Username</Label>
                <Input value={form.discordUsername} onChange={e => setForm(f => ({ ...f, discordUsername: e.target.value }))} className="font-mono text-xs h-10 border-border bg-input" placeholder="user#1234" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Telegram Username</Label>
                <Input value={form.telegramUsername} onChange={e => setForm(f => ({ ...f, telegramUsername: e.target.value }))} className="font-mono text-xs h-10 border-border bg-input" placeholder="@username" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Wallet Addresses <span className="text-muted-foreground/50">(one per line)</span></Label>
              <Textarea value={form.walletAddresses} onChange={e => setForm(f => ({ ...f, walletAddresses: e.target.value }))} className="font-mono text-xs border-border bg-input min-h-[80px] resize-none" placeholder={"0x1234...\n0xabcd..."} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Backup Codes / Seeds <span className="text-muted-foreground/50">(one per line)</span></Label>
              <Textarea value={form.backupCodes} onChange={e => setForm(f => ({ ...f, backupCodes: e.target.value }))} className="font-mono text-xs border-border bg-input min-h-[60px] resize-none" placeholder={"word1 word2...\ncode-1234"} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="font-mono text-xs border-border bg-input min-h-[60px] resize-none" placeholder="Any extra info about this account..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="font-mono text-xs border-border">Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="font-mono text-xs">
              {createMutation.isPending ? "Securing..." : "Secure Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-red-400">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-xs font-mono text-muted-foreground">This vault entry will be permanently deleted. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs border-border">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={deleteMutation.isPending} className="font-mono text-xs">
              {deleteMutation.isPending ? "Deleting..." : "Delete Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
