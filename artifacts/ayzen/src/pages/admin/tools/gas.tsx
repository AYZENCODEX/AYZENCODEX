import { useGetGasPrices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Fuel, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminGas() {
  const { data: prices, isLoading, refetch } = useGetGasPrices();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Gas Tracker</h1>
          <p className="text-muted-foreground font-mono text-sm">Real-time network transaction costs</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="font-mono uppercase text-xs border-card-border">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : !prices || prices.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-md">
            Gas oracle currently unavailable.
          </div>
        ) : (
          prices.map((gas) => (
            <Card key={gas.network} className="bg-card border-card-border shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-mono text-lg font-bold uppercase">{gas.network}</CardTitle>
                <Fuel className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="bg-background/50 rounded p-2 border border-border">
                    <div className="text-[10px] text-muted-foreground mb-1 uppercase font-mono">Slow</div>
                    <div className="font-bold font-mono text-sm">{gas.slow}</div>
                  </div>
                  <div className="bg-primary/10 rounded p-2 border border-primary/20">
                    <div className="text-[10px] text-primary mb-1 uppercase font-mono">Standard</div>
                    <div className="font-bold font-mono text-sm text-primary">{gas.standard}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 border border-border">
                    <div className="text-[10px] text-muted-foreground mb-1 uppercase font-mono">Fast</div>
                    <div className="font-bold font-mono text-sm">{gas.fast}</div>
                  </div>
                </div>
                <div className="text-xs font-mono text-center text-muted-foreground bg-muted/20 py-2 rounded">
                  Estimated Swap: <span className="font-bold text-foreground">${gas.usdPerTx.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
