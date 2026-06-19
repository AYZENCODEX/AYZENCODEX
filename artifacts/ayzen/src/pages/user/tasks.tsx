import { useListTasks } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default function UserTasks() {
  const { data, isLoading } = useListTasks();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Task Center</h1>
        <p className="text-muted-foreground font-mono text-sm">Pending executions and active operations</p>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent>
            </Card>
          ))
        ) : !data || data.length === 0 ? (
          <div className="py-12 text-center font-mono text-muted-foreground bg-card border border-card-border rounded-md">
            No pending tasks. Queue is empty.
          </div>
        ) : (
          data.map((task) => (
            <Card key={task.id} className="bg-card border-card-border shadow-none hover:border-primary/50 transition-colors">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-bold text-primary">{task.name}</h3>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase rounded-sm border-muted-foreground/30">{task.taskType}</Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{task.projectName}</p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="text-right flex-1 sm:flex-none">
                    <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Reward</div>
                    <div className="font-bold font-mono text-sm">{task.rewardAmount ? `$${task.rewardAmount}` : 'XP'}</div>
                  </div>
                  <Button size="sm" className="font-mono uppercase text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                    <Play className="h-3 w-3 mr-2" /> Execute
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
