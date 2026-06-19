import { useListBroadcasts } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Plus } from "lucide-react";
import { format } from "date-fns";

export default function AdminBroadcast() {
  const { data: broadcasts, isLoading } = useListBroadcasts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Comms Broadcast</h1>
          <p className="text-muted-foreground font-mono text-sm">System-wide operator notifications</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2">
          <Plus className="h-4 w-4" /> New Broadcast
        </Button>
      </div>

      <div className="border border-card-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-card-border hover:bg-transparent">
              <TableHead className="font-mono uppercase text-xs">Title</TableHead>
              <TableHead className="font-mono uppercase text-xs">Channel</TableHead>
              <TableHead className="font-mono uppercase text-xs">Status</TableHead>
              <TableHead className="font-mono uppercase text-xs">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="border-card-border">
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : !broadcasts || broadcasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 font-mono text-muted-foreground">
                  No transmission history found.
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map((broadcast) => (
                <TableRow key={broadcast.id} className="border-card-border hover:bg-muted/50">
                  <TableCell className="font-mono font-medium">{broadcast.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm border-muted-foreground/30">
                      {broadcast.channel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase rounded-sm text-primary bg-primary/10">
                      {broadcast.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {format(new Date(broadcast.createdAt), 'MMM dd, HH:mm')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
