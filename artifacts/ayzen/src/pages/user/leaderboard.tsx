import { useGetLeaderboard } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserLeaderboard() {
  const { data, isLoading } = useGetLeaderboard({ period: "all", limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Leaderboard</h1>
        <p className="text-muted-foreground font-mono text-sm">Global operator rankings</p>
      </div>

      <div className="border border-card-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-card-border hover:bg-transparent">
              <TableHead className="font-mono uppercase text-xs w-16 text-center">Rank</TableHead>
              <TableHead className="font-mono uppercase text-xs">Operator</TableHead>
              <TableHead className="font-mono uppercase text-xs text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-card-border">
                  <TableCell className="text-center"><Skeleton className="h-4 w-6 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 font-mono text-muted-foreground">
                  Rankings unavailable.
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry) => (
                <TableRow key={entry.userId} className="border-card-border hover:bg-muted/50">
                  <TableCell className="font-mono font-bold text-center">
                    {entry.rank <= 3 ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                        entry.rank === 2 ? 'bg-gray-300/20 text-gray-300' :
                        'bg-amber-700/20 text-amber-700'
                      }`}>
                        {entry.rank}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{entry.rank}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-medium">{entry.username}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">{entry.tasksCompleted * 100}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
