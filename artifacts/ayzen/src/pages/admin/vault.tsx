import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Hash, Search, Twitter, MessageCircle, Wallet, Mail, ChevronDown, ChevronRight, Database } from "lucide-react";

interface AdminVaultEntry {
  id: number;
  userId: number;
  entitySerial: string | null;
  category: string;
  projectName: string;
  email: string | null;
  twitterUsername: string | null;
  discordUsername: string | null;
  telegramUsername: string | null;
  walletAddresses: string[];
  notes: string | null;
  createdAt: string;
  username: string | null;
  userEmail: string | null;
}

function EntityRow({ entry }: { entry: AdminVaultEntry }) {
  const [open, setOpen] = useState(false);
  const serial = entry.entitySerial || `AYZNA${entry.id}`;
  return (
    <div className="border border-card-border rounded-md overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors text-left">
        <Hash className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-2 items-center">
          <div className="font-mono text-sm font-bold text-primary">{serial}</div>
          <div className="font-mono text-xs text-foreground/80 truncate">{entry.projectName}</div>
          <div className="font-mono text-xs text-muted-foreground truncate">{entry.username} · {entry.userEmail}</div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[9px] border-primary/20 text-muted-foreground uppercase">{entry.category}</Badge>
          </div>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-card-border px-4 py-3 bg-muted/5 space-y-1.5">
          {entry.email && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Mail className="w-3 h-3 flex-shrink-0" /> <span className="text-foreground/80">{entry.email}</span>
            </div>
          )}
          {entry.twitterUsername && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Twitter className="w-3 h-3 flex-shrink-0 text-sky-400" /> <span>@{entry.twitterUsername}</span>
            </div>
          )}
          {entry.discordUsername && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <MessageCircle className="w-3 h-3 flex-shrink-0 text-violet-400" /> <span>{entry.discordUsername}</span>
            </div>
          )}
          {entry.telegramUsername && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <MessageCircle className="w-3 h-3 flex-shrink-0 text-blue-400" /> <span>{entry.telegramUsername}</span>
            </div>
          )}
          {entry.walletAddresses?.length > 0 && entry.walletAddresses.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Wallet className="w-3 h-3 flex-shrink-0 text-yellow-400" /> <span className="truncate">{w}</span>
            </div>
          ))}
          {entry.notes && <div className="text-[10px] font-mono text-muted-foreground/60 border-t border-border pt-2 mt-1">{entry.notes}</div>}
          <div className="text-[9px] font-mono text-muted-foreground/40 pt-1">Created {new Date(entry.createdAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

export default function AdminVault() {
  const [search, setSearch] = useState("");
  const token = localStorage.getItem("ayzen_token") || "";

  const { data: entries, isLoading } = useQuery<AdminVaultEntry[]>({
    queryKey: ["admin-vault"],
    queryFn: async () => {
      const res = await fetch("/api/admin/vault", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const filtered = entries?.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.entitySerial?.toLowerCase().includes(s) ||
      e.projectName.toLowerCase().includes(s) ||
      e.username?.toLowerCase().includes(s) ||
      e.userEmail?.toLowerCase().includes(s) ||
      e.category.toLowerCase().includes(s)
    );
  }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" /> All Entities
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">
            All vault entities across all operators — {entries?.length ?? 0} total
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by serial, name, user..."
          className="pl-9 font-mono bg-card border-card-border text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table header */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-2 px-4 text-[10px] font-mono uppercase text-muted-foreground/60 tracking-widest">
          <div>Serial</div>
          <div>Entity Name</div>
          <div>Operator</div>
          <div>Category</div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center font-mono text-muted-foreground bg-card border border-card-border border-dashed rounded-md">
            {search ? "No entities match your search." : "No vault entities found."}
          </div>
        ) : (
          filtered.map(entry => <EntityRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
