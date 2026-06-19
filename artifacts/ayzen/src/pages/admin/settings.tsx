import { useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon } from "lucide-react";

export default function AdminSettings() {
  const { data: settings, isLoading } = useGetSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">System Configuration</h1>
        <p className="text-muted-foreground font-mono text-sm">Platform variables and external integrations</p>
      </div>

      {isLoading ? (
        <Card className="bg-card border-card-border shadow-none">
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-card-border shadow-none">
          <CardHeader>
            <CardTitle className="font-mono uppercase text-sm flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-primary" /> Core Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm space-y-4">
            <div className="grid grid-cols-3 border-b border-card-border pb-2">
              <div className="text-muted-foreground">Platform Name</div>
              <div className="col-span-2 text-foreground font-bold">{settings?.platformName || 'AYZEN'}</div>
            </div>
            <div className="grid grid-cols-3 border-b border-card-border pb-2">
              <div className="text-muted-foreground">Primary Accent</div>
              <div className="col-span-2 text-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                {settings?.primaryColor || 'Cyan'}
              </div>
            </div>
            <div className="grid grid-cols-3 border-b border-card-border pb-2">
              <div className="text-muted-foreground">SMTP Gateway</div>
              <div className="col-span-2 text-foreground">{settings?.smtpHost || 'Offline'}</div>
            </div>
            <div className="grid grid-cols-3 pb-2">
              <div className="text-muted-foreground">Telegram Bot</div>
              <div className="col-span-2 text-foreground">{settings?.telegramBotUsername || 'Not Configured'}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
