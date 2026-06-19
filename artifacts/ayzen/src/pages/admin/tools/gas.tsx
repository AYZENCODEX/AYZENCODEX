import { useGetGasPrices } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Fuel, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NETWORK_UNITS: Record<string, string> = {
  ethereum: "Gwei", bsc: "Gwei", polygon: "Gwei", avalanche: "nAVAX",
  fantom: "Gwei", moonbeam: "Gwei", cronos: "Gwei", klaytn: "Ston",
  default: "Gwei",
};

const NETWORK_COLORS: Record<string, string> = {
  ethereum: "text-blue-400", arbitrum: "text-blue-300", optimism: "text-red-400",
  polygon: "text-purple-400", bsc: "text-yellow-400", avalanche: "text-red-500",
  zksync: "text-violet-400", base: "text-blue-500", scroll: "text-yellow-300",
  linea: "text-green-400", blast: "text-yellow-500", berachain: "text-orange-400",
  sei: "text-cyan-400", starknet: "text-purple-300", mantle: "text-teal-400",
  default: "text-primary",
};

function fmtGas(val: number): string {
  if (val === 0) return "0";
  if (val < 0.001) return val.toExponential(2);
  if (val < 1) return val.toFixed(4);
  if (val < 100) return val.toFixed(2);
  return Math.round(val).toLocaleString();
}

function getUnit(networkId: string): string {
  return NETWORK_UNITS[networkId] ?? NETWORK_UNITS.default;
}

function getColor(networkId: string): string {
  return NETWORK_COLORS[networkId] ?? NETWORK_COLORS.default;
}

function getUsdClass(usd: number): string {
  if (usd < 0.10) return "text-green-400";
  if (usd < 1.00) return "text-yellow-400";
  return "text-red-400";
}

export default function AdminGas() {
  const { data: prices, isLoading, refetch, dataUpdatedAt } = useGetGasPrices();
  const updatedTime = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Gas Tracker</h1>
          <p className="text-muted-foreground font-mono text-xs mt-1">
            Live network transaction costs across {prices?.length ?? 0} chains
            {updatedTime && <span className="ml-2 text-muted-foreground/50">· Updated {updatedTime}</span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="font-mono uppercase text-xs border-card-border self-start sm:self-auto"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary row */}
      {prices && prices.length > 0 && (() => {
        const eth = prices.find(p => p.networkId === "ethereum");
        const cheapest = [...prices].sort((a, b) => (a.usdPerTx ?? 0) - (b.usdPerTx ?? 0))[0];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {eth && (
              <Card className="bg-card border-card-border shadow-none">
                <CardContent className="p-4">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Ethereum Standard</div>
                  <div className="text-xl font-bold font-mono text-blue-400">{fmtGas(eth.standard ?? 0)} <span className="text-xs text-muted-foreground">Gwei</span></div>
                  <div className={`text-xs font-mono mt-1 ${getUsdClass(eth.usdPerTx ?? 0)}`}>${(eth.usdPerTx ?? 0).toFixed(2)} / swap</div>
                </CardContent>
              </Card>
            )}
            <Card className="bg-card border-card-border shadow-none">
              <CardContent className="p-4">
                <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Cheapest Chain</div>
                <div className={`text-xl font-bold font-mono ${getColor(cheapest?.networkId ?? '')}`}>{cheapest?.network}</div>
                <div className="text-xs font-mono text-green-400 mt-1">${(cheapest?.usdPerTx ?? 0).toFixed(4)} / swap</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-card-border shadow-none col-span-2 sm:col-span-1">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary opacity-40" />
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Networks Tracked</div>
                  <div className="text-xl font-bold font-mono text-primary">{prices.length}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardHeader className="pb-2"><Skeleton className="h-5 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))
        ) : !prices || prices.length === 0 ? (
          <div className="col-span-full py-12 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-md">
            Gas oracle currently unavailable.
          </div>
        ) : (
          prices.map((gas) => {
            const unit = getUnit(gas.networkId ?? '');
            const color = getColor(gas.networkId ?? '');
            const usdClass = getUsdClass(gas.usdPerTx ?? 0);
            return (
              <Card key={gas.network} className="bg-card border-card-border shadow-none hover:border-primary/20 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                  <CardTitle className={`font-mono text-sm font-bold uppercase ${color}`}>{gas.network}</CardTitle>
                  <Badge variant="outline" className={`text-[9px] font-mono uppercase border-0 bg-transparent px-0 ${usdClass}`}>
                    ${(gas.usdPerTx ?? 0) < 0.01 ? (gas.usdPerTx ?? 0).toFixed(4) : (gas.usdPerTx ?? 0).toFixed(2)}
                  </Badge>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-background/50 rounded p-2 border border-border">
                      <div className="text-[9px] text-muted-foreground mb-1 uppercase font-mono">Slow</div>
                      <div className="font-bold font-mono text-xs">{fmtGas(gas.slow ?? 0)}</div>
                      <div className="text-[8px] text-muted-foreground/60 font-mono">{unit}</div>
                    </div>
                    <div className="bg-primary/5 rounded p-2 border border-primary/20">
                      <div className="text-[9px] text-primary mb-1 uppercase font-mono">Std</div>
                      <div className={`font-bold font-mono text-xs ${color}`}>{fmtGas(gas.standard ?? 0)}</div>
                      <div className="text-[8px] text-muted-foreground/60 font-mono">{unit}</div>
                    </div>
                    <div className="bg-background/50 rounded p-2 border border-border">
                      <div className="text-[9px] text-muted-foreground mb-1 uppercase font-mono">Fast</div>
                      <div className="font-bold font-mono text-xs">{fmtGas(gas.fast ?? 0)}</div>
                      <div className="text-[8px] text-muted-foreground/60 font-mono">{unit}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
