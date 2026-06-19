import { useListTasks } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare } from "lucide-react";

export default function AdminTasks() {
  const { data, isLoading } = useListTasks();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Task Execution</h1>
          <p className="text-muted-foreground font-mono text-sm">Define and monitor system operations</p>
        </div>
        <Button className="font-mono uppercase text-xs tracking-wider gap-2">
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

      <div className="border border-card-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-card-border hover:bg-transparent">
              <TableHead className="font-mono uppercase text-xs">Task Name</TableHead>
              <TableHead className="font-mono uppercase text-xs">Protocol</TableHead>
              <TableHead className="font-mono uppercase text-xs">Type</TableHead>
              <TableHead className="font-mono uppercase text-xs">Verification</TableHead>
              <TableHead className="font-mono uppercase text-xs text-right">Reward</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-card-border">
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 font-mono text-muted-foreground">
                  No tasks configured in the database.
                </TableCell>
              </TableRow>
            ) : (
              data.map((task) => (
                <TableRow key={task.id} className="border-card-border hover:bg-muted/50">
                  <TableCell className="font-mono font-medium">{task.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{task.projectName || `Project ${task.projectId}`}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm border-muted-foreground/30">
                      {task.taskType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase rounded-sm">
                      {task.verificationType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">
                    {task.rewardAmount ? `$${task.rewardAmount}` : '-'}
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
