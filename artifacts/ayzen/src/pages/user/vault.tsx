import { useListVaultEntries } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, KeyRound } from "lucide-react";

export default function UserVault() {
  const { data, isLoading } = useListVaultEntries();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Secure Vault</h1>
          <p className="text-muted-foreground font-mono text-sm">Encrypted storage for protocol assets and keys</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2">
          <Plus className="h-4 w-4" /> Add Entry
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-6 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))
        ) : !data || data.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-muted-foreground bg-card border border-card-border border-dashed rounded-md flex flex-col items-center justify-center">
            <KeyRound className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
            Vault is empty. Secure your first asset.
          </div>
        ) : (
          data.map((entry) => (
            <Card key={entry.id} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-sm font-bold text-primary">{entry.projectName}</CardTitle>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{entry.category}</div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs font-mono">
                  {entry.walletAddresses && entry.walletAddresses.length > 0 && (
                    <div className="truncate text-muted-foreground">
                      <span className="text-foreground">Wallet:</span> {entry.walletAddresses[0]}
                    </div>
                  )}
                  {entry.twitterUsername && (
                    <div className="text-muted-foreground">
                      <span className="text-foreground">Twitter:</span> @{entry.twitterUsername}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
