import { useState, useEffect } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Mail, Send, CheckCircle2, Eye, EyeOff, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { data: settings, isLoading, refetch } = useGetSettings();
  const { toast } = useToast();
  const token = localStorage.getItem("ayzen_token") || "";

  const [smtpForm, setSmtpForm] = useState({ smtpHost: "", smtpPort: "587", smtpUser: "", smtpPassword: "", smtpFrom: "" });
  const [showPass, setShowPass] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings) {
      setSmtpForm({
        smtpHost: settings.smtpHost ?? "",
        smtpPort: String(settings.smtpPort ?? 587),
        smtpUser: settings.smtpUser ?? "",
        smtpPassword: "",
        smtpFrom: (settings as any).smtpFrom ?? "",
      });
    }
  }, [settings]);

  const saveSmtp = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        smtpHost: smtpForm.smtpHost,
        smtpPort: parseInt(smtpForm.smtpPort, 10),
        smtpUser: smtpForm.smtpUser,
        smtpFrom: smtpForm.smtpFrom,
      };
      if (smtpForm.smtpPassword) body.smtpPassword = smtpForm.smtpPassword;

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast({ title: "SMTP settings saved" });
        refetch();
        setSmtpForm(f => ({ ...f, smtpPassword: "" }));
      } else {
        toast({ variant: "destructive", title: "Failed to save settings" });
      }
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testEmail) { toast({ variant: "destructive", title: "Enter a test email address" }); return; }
    setTesting(true);
    try {
      const res = await fetch("/api/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (res.ok) toast({ title: "Test email sent!", description: `Check ${testEmail} for the confirmation.` });
      else toast({ variant: "destructive", title: data.error || "Failed to send" });
    } finally { setTesting(false); }
  };

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  const smtpConfigured = !!(settings?.smtpHost && settings?.smtpUser);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tighter uppercase">System Configuration</h1>
        <p className="text-muted-foreground font-mono text-xs mt-1">Platform settings and external integrations</p>
      </div>

      {/* Platform Info */}
      <Card className="bg-card border-card-border shadow-none">
        <CardHeader>
          <CardTitle className="font-mono uppercase text-xs flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" /> Core Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="font-mono text-sm space-y-3">
          {[
            { label: "Platform Name", value: settings?.platformName || "AYZEN" },
            { label: "Primary Accent", value: settings?.primaryColor || "#06b6d4" },
            { label: "2FA Issuer", value: settings?.twoFaIssuerName || "AYZEN" },
            { label: "Telegram Bot", value: settings?.telegramBotUsername || "Not configured" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center border-b border-card-border pb-2 last:border-0 last:pb-0">
              <span className="text-muted-foreground text-xs">{label}</span>
              <span className="text-xs font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SMTP Config */}
      <Card className="bg-card border-card-border shadow-none">
        <CardHeader>
          <CardTitle className="font-mono uppercase text-xs flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> SMTP Email Configuration
            {smtpConfigured && <span className="ml-auto flex items-center gap-1 text-green-400 text-[10px] font-normal"><CheckCircle2 className="w-3 h-3" /> Configured</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SMTP Host</Label>
              <Input value={smtpForm.smtpHost} onChange={e => setSmtpForm(f => ({ ...f, smtpHost: e.target.value }))} className="font-mono text-xs h-10 bg-input border-border" placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Port</Label>
              <Input value={smtpForm.smtpPort} onChange={e => setSmtpForm(f => ({ ...f, smtpPort: e.target.value }))} className="font-mono text-xs h-10 bg-input border-border" placeholder="587" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SMTP Username / Email</Label>
            <Input type="email" value={smtpForm.smtpUser} onChange={e => setSmtpForm(f => ({ ...f, smtpUser: e.target.value }))} className="font-mono text-xs h-10 bg-input border-border" placeholder="noreply@ayzen.tech" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Password / App Password</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={smtpForm.smtpPassword}
                onChange={e => setSmtpForm(f => ({ ...f, smtpPassword: e.target.value }))}
                className="font-mono text-xs h-10 bg-input border-border pr-10"
                placeholder={smtpConfigured ? "Leave blank to keep current" : "App password or SMTP password"}
              />
              <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">From Address <span className="text-muted-foreground/50">(optional)</span></Label>
            <Input type="email" value={smtpForm.smtpFrom} onChange={e => setSmtpForm(f => ({ ...f, smtpFrom: e.target.value }))} className="font-mono text-xs h-10 bg-input border-border" placeholder="AYZEN <noreply@ayzen.tech>" />
          </div>

          <div className="bg-muted/20 border border-border rounded-md p-3 text-[10px] font-mono text-muted-foreground space-y-1">
            <div className="text-primary font-bold uppercase tracking-widest mb-2">Gmail Setup Guide</div>
            <div>1. Go to Google Account → Security → 2-Step Verification</div>
            <div>2. Scroll to "App passwords" → Generate for "Mail"</div>
            <div>3. Use smtp.gmail.com · Port 587 · your@gmail.com · App Password</div>
          </div>

          <Button onClick={saveSmtp} disabled={saving} className="font-mono text-xs gap-2">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <SettingsIcon className="w-3 h-3" />}
            {saving ? "Saving..." : "Save SMTP Config"}
          </Button>
        </CardContent>
      </Card>

      {/* Email Test */}
      <Card className="bg-card border-card-border shadow-none">
        <CardHeader>
          <CardTitle className="font-mono uppercase text-xs flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Send Test Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              className="font-mono text-xs h-10 bg-input border-border flex-1"
              placeholder="your@email.com"
            />
            <Button onClick={sendTest} disabled={testing || !smtpConfigured} className="font-mono text-xs gap-2 flex-shrink-0">
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {testing ? "Sending..." : "Send Test"}
            </Button>
          </div>
          {!smtpConfigured && <p className="text-[10px] font-mono text-yellow-500/80 mt-2">Configure SMTP above before sending a test.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
