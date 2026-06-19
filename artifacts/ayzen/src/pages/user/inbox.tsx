import { useGetBroadcastInbox } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default function UserInbox() {
  const { data, isLoading } = useGetBroadcastInbox();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">Comms Inbox</h1>
        <p className="text-muted-foreground font-mono text-sm">System broadcasts and protocol alerts</p>
      </div>

      <div className="grid gap-4 max-w-3xl">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-card-border shadow-none">
              <CardContent className="p-6 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))
        ) : !data || data.length === 0 ? (
          <div className="py-12 text-center font-mono text-muted-foreground bg-card border border-card-border border-dashed rounded-md flex flex-col items-center justify-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
            No new transmissions.
          </div>
        ) : (
          data.map((msg) => (
            <Card key={msg.id} className="bg-card border-card-border shadow-none border-l-4 border-l-primary hover:bg-muted/10 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-mono text-sm font-bold text-foreground">{msg.title}</CardTitle>
                  <span className="text-[10px] font-mono text-muted-foreground">{format(new Date(msg.createdAt), 'MMM dd, HH:mm')}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">{msg.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
