import { useGetTelemetryFunctions, useGetTelemetryErrors } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Terminal } from "lucide-react";

export default function AdminDeveloper() {
  const { data: functions, isLoading: fnLoading } = useGetTelemetryFunctions();
  const { data: errors, isLoading: errLoading } = useGetTelemetryErrors({ limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" /> Developer Console
        </h1>
        <p className="text-muted-foreground font-mono text-sm">API telemetry, error logs, and system diagnostics</p>
      </div>

      <Tabs defaultValue="telemetry" className="w-full">
        <TabsList className="bg-card border border-card-border w-full justify-start rounded-md h-12 p-1">
          <TabsTrigger value="telemetry" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Telemetry</TabsTrigger>
          <TabsTrigger value="errors" className="font-mono uppercase text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Error Log</TabsTrigger>
        </TabsList>
        
        <TabsContent value="telemetry" className="mt-4">
          <div className="border border-card-border rounded-md bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-card-border hover:bg-transparent">
                  <TableHead className="font-mono uppercase text-xs">Function</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Route</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Status</TableHead>
                  <TableHead className="font-mono uppercase text-xs text-right">24h Calls</TableHead>
                  <TableHead className="font-mono uppercase text-xs text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fnLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
                ) : !functions || functions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 font-mono text-muted-foreground">No telemetry data.</TableCell></TableRow>
                ) : (
                  functions.map((fn) => (
                    <TableRow key={fn.name} className="border-card-border hover:bg-muted/50">
                      <TableCell className="font-mono font-medium text-primary">{fn.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{fn.route}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase rounded-sm ${fn.status === 'wired' ? 'border-primary/50 text-primary' : 'border-destructive/50 text-destructive'}`}>
                          {fn.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fn.callCount24h}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{fn.avgLatencyMs ? `${fn.avgLatencyMs}ms` : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        
        <TabsContent value="errors" className="mt-4">
          <div className="border border-card-border rounded-md bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-card-border hover:bg-transparent">
                  <TableHead className="font-mono uppercase text-xs">Level</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Message</TableHead>
                  <TableHead className="font-mono uppercase text-xs">Endpoint</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
                ) : !errors || errors.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 font-mono text-muted-foreground">System clear. No errors logged.</TableCell></TableRow>
                ) : (
                  errors.map((err) => (
                    <TableRow key={err.id} className="border-card-border">
                      <TableCell>
                        <Badge variant="destructive" className="font-mono text-[10px] uppercase rounded-sm">{err.level}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{err.message}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{err.endpoint}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
