import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Trash2, Eye, EyeOff, Copy, Check,
  Lock, Shield, Users, TrendingUp,
  Calendar, DollarSign, Edit3, X, Tag, Smartphone,
  Clock, UserCheck, Star, BarChart2, GitBranch,
  Award, Linkedin, Github,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { customFetch } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LocalAccount {
  id: number;
  user_id: number;
  category: string;
  label: string | null;
  username: string | null;
  email: string | null;
  password: string | null;
  recovery_email: string | null;
  recovery_email_password: string | null;
  backup_codes: string | null;
  twofa: string | null;
  recovery_email_twofa: string | null;
  followers: string | null;
  account_worth: number;
  buy_price: number;
  account_create_date: string | null;
  account_buy_date: string | null;
  account_last_login_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string | number;
  name: string;
  color: string;
  icon: string;
  isCustom?: boolean;
}

// ─── Platform metric config ───────────────────────────────────────────────────
interface PlatformMeta {
  metricLabel: string;
  metricPlaceholder: string;
  icon: React.ElementType;
  tips: string[];
  color: string;
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  Google: {
    metricLabel: "Points / Rewards",
    metricPlaceholder: "e.g. 2500",
    icon: Award,
    color: "#EA4335",
    tips: ["Check Google One rewards", "Track Maps contributions", "Monitor Play Points balance"],
  },
  Facebook: {
    metricLabel: "Friends / Followers",
    metricPlaceholder: "e.g. 500",
    icon: Users,
    color: "#1877F2",
    tips: ["Profile vs Page accounts behave differently", "Keep profile active to avoid lock"],
  },
  Twitter: {
    metricLabel: "Followers",
    metricPlaceholder: "e.g. 1200",
    icon: Users,
    color: "#1DA1F2",
    tips: ["Age 6+ months for airdrops", "Minimum 50 followers typical", "Keep bio + avatar set"],
  },
  Reddit: {
    metricLabel: "Karma",
    metricPlaceholder: "e.g. 1500",
    icon: Award,
    color: "#FF4500",
    tips: ["Post karma + comment karma matter", "2FA required by most projects", "Old accounts valued more"],
  },
  GitHub: {
    metricLabel: "Repositories",
    metricPlaceholder: "e.g. 12",
    icon: Github,
    color: "#6e40c9",
    tips: ["Contribution graph visibility matters", "Star relevant repos for whitelist", "Fork target repos"],
  },
  LinkedIn: {
    metricLabel: "Connections",
    metricPlaceholder: "e.g. 500+",
    icon: Linkedin,
    color: "#0A66C2",
    tips: ["500+ connections = 'Level 1' trust", "Keep industry set to crypto/web3", "Engage with protocol posts"],
  },
  Discord: {
    metricLabel: "Servers Joined",
    metricPlaceholder: "e.g. 15",
    icon: Users,
    color: "#5865F2",
    tips: ["Join official server first", "Verify in every server", "Boost servers for higher roles"],
  },
};

function getPlatformMeta(category: string): PlatformMeta {
  return PLATFORM_META[category] ?? {
    metricLabel: "Social Metric",
    metricPlaceholder: "e.g. followers, points...",
    icon: Star,
    color: "#22d3ee",
    tips: ["Track your key metric for this platform"],
  };
}

// ─── Platform configs ─────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES: Category[] = [
  { id: "facebook", name: "Facebook", color: "#1877F2", icon: "F", isCustom: false },
  { id: "github",   name: "GitHub",   color: "#6e40c9", icon: "G", isCustom: false },
  { id: "google",   name: "Google",   color: "#EA4335", icon: "G", isCustom: false },
  { id: "twitter",   name: "Twitter",   color: "#1DA1F2", icon: "X", isCustom: false },
  { id: "discord",   name: "Discord",   color: "#5865F2", icon: "D", isCustom: false },
  { id: "linkedin",  name: "LinkedIn",  color: "#0A66C2", icon: "in", isCustom: false },
];

const PLATFORM_GRADIENTS: Record<string, string> = {
  facebook:  "from-blue-600/10 to-blue-400/5 border-blue-500/20",
  linkedin:  "from-blue-700/10 to-blue-500/5 border-blue-600/20",
  github:   "from-purple-600/10 to-purple-400/5 border-purple-500/20",
  google:   "from-red-500/10 to-orange-400/5 border-red-400/20",
  twitter:  "from-sky-500/10 to-sky-400/5 border-sky-400/20",
  discord:  "from-indigo-500/10 to-indigo-400/5 border-indigo-400/20",
};

function getPlatformGradient(cat: string) {
  return PLATFORM_GRADIENTS[cat.toLowerCase()] ?? "from-primary/8 to-transparent border-primary/20";
}

// ─── Utility: age from date ───────────────────────────────────────────────────
function calcAge(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const years = days / 365;
  return `${years.toFixed(1)}y`;
}

function calcROI(worth: number, buyPrice: number): number | null {
  if (!buyPrice || buyPrice === 0) return null;
  return ((worth - buyPrice) / buyPrice) * 100;
}

// ─── SecretField: masked with reveal + copy ───────────────────────────────────
function SecretField({ label, value }: { label: string; value: string | null | undefined }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex items-center gap-2 group/sf py-0.5">
      <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider w-16 flex-shrink-0">{label}</span>
      <span className="flex-1 font-mono text-[11px] truncate text-muted-foreground/70">
        {shown ? value : "•".repeat(Math.min(value.length, 12))}
      </span>
      <div className="flex gap-1 opacity-0 group-hover/sf:opacity-100 transition-opacity">
        <button onClick={() => setShown(s => !s)} className="text-muted-foreground/30 hover:text-primary transition-colors">
          {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
        <button onClick={copy} className={cn("transition-colors", copied ? "text-emerald-400" : "text-muted-foreground/30 hover:text-primary")}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────
function AccountCard({
  account, onEdit, onDelete,
}: {
  account: LocalAccount;
  onEdit: (a: LocalAccount) => void;
  onDelete: (id: number) => void;
}) {
  const roi = calcROI(account.account_worth, account.buy_price);
  const age = calcAge(account.account_create_date);
  const grad = getPlatformGradient(account.category);

  return (
    <div className={cn(
      "bg-card border rounded-xl overflow-hidden group hover-lift hover-shimmer transition-all duration-300",
      `bg-gradient-to-br ${grad}`
    )}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-3 h-3 text-primary/40 flex-shrink-0" />
          <span className="font-mono font-bold text-sm text-foreground truncate">
            {account.label || account.username || account.email || `Account #${account.id}`}
          </span>
          {account.username && account.label && (
            <span className="text-[10px] font-mono text-muted-foreground/50 truncate">@{account.username}</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(account)} className="text-muted-foreground/40 hover:text-primary transition-colors p-1">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(account.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-border/20 flex-wrap">
        {account.account_worth > 0 && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] font-mono font-bold text-emerald-400">${account.account_worth.toFixed(2)}</span>
          </div>
        )}
        {roi !== null && (
          <div className={cn("flex items-center gap-1", roi >= 0 ? "text-green-400" : "text-red-400")}>
            <BarChart2 className="w-3 h-3" />
            <span className="text-[11px] font-mono font-bold">{roi >= 0 ? "+" : ""}{roi.toFixed(1)}% ROI</span>
          </div>
        )}
        {age !== "—" && (
          <div className="flex items-center gap-1 text-muted-foreground/60">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-mono">{age} old</span>
          </div>
        )}
        {account.followers && (
          <div className="flex items-center gap-1 text-muted-foreground/60">
            <Users className="w-3 h-3" />
            <span className="text-[10px] font-mono">{account.followers}</span>
          </div>
        )}
      </div>

      {/* Credentials */}
      <div className="px-4 py-2 space-y-0.5">
        <SecretField label="Email" value={account.email} />
        <SecretField label="Password" value={account.password} />
        <SecretField label="Rec. Email" value={account.recovery_email} />
        <SecretField label="Rec. Pass" value={account.recovery_email_password} />
        <SecretField label="2FA" value={account.twofa} />
        <SecretField label="Rec. 2FA" value={account.recovery_email_twofa} />
        <SecretField label="Backups" value={account.backup_codes} />
      </div>

      {/* Dates */}
      {(account.account_create_date || account.account_buy_date || account.account_last_login_date) && (
        <div className="px-4 py-1.5 border-t border-border/20 flex flex-wrap gap-3">
          {account.account_create_date && (
            <div className="flex items-center gap-1 text-muted-foreground/40">
              <Calendar className="w-2.5 h-2.5" />
              <span className="text-[9px] font-mono">Created: {new Date(account.account_create_date).toLocaleDateString()}</span>
            </div>
          )}
          {account.account_buy_date && (
            <div className="flex items-center gap-1 text-muted-foreground/40">
              <Star className="w-2.5 h-2.5" />
              <span className="text-[9px] font-mono">Bought: {new Date(account.account_buy_date).toLocaleDateString()}</span>
            </div>
          )}
          {account.account_last_login_date && (
            <div className="flex items-center gap-1 text-muted-foreground/40">
              <UserCheck className="w-2.5 h-2.5" />
              <span className="text-[9px] font-mono">Login: {new Date(account.account_last_login_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}

      {account.notes && (
        <div className="px-4 pb-2 pt-1 border-t border-border/20">
          <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{account.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Empty form ───────────────────────────────────────────────────────────────
const EMPTY: Omit<LocalAccount, "id" | "user_id" | "created_at" | "updated_at"> = {
  category: "", label: null, username: null,
  email: null, password: null,
  recovery_email: null, recovery_email_password: null,
  backup_codes: null, twofa: null, recovery_email_twofa: null,
  followers: null, account_worth: 0, buy_price: 0,
  account_create_date: null, account_buy_date: null, account_last_login_date: null,
  notes: null,
};

function toFormState(a?: LocalAccount) {
  if (!a) return { ...EMPTY };
  return {
    category: a.category || "",
    label: a.label || "",
    username: a.username || "",
    email: a.email || "",
    password: a.password || "",
    recovery_email: a.recovery_email || "",
    recovery_email_password: a.recovery_email_password || "",
    backup_codes: a.backup_codes || "",
    twofa: a.twofa || "",
    recovery_email_twofa: a.recovery_email_twofa || "",
    followers: a.followers || "",
    account_worth: a.account_worth || 0,
    buy_price: a.buy_price || 0,
    account_create_date: a.account_create_date ? a.account_create_date.slice(0, 10) : "",
    account_buy_date: a.account_buy_date ? a.account_buy_date.slice(0, 10) : "",
    account_last_login_date: a.account_last_login_date ? a.account_last_login_date.slice(0, 10) : "",
    notes: a.notes || "",
  };
}

// ─── Account Form Dialog ──────────────────────────────────────────────────────
function AccountFormDialog({
  open, onClose, editAccount, selectedCategory, allCategories, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editAccount?: LocalAccount;
  selectedCategory: string;
  allCategories: Category[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(toFormState(editAccount));
  const [activeSection, setActiveSection] = useState<"creds" | "dates" | "value" | "platform">("creds");

  useEffect(() => {
    if (open) {
      const base = toFormState(editAccount);
      if (!editAccount && selectedCategory) base.category = selectedCategory;
      setForm(base);
      setActiveSection("creds");
    }
  }, [open, editAccount, selectedCategory]);

  const SECTIONS: { id: "creds" | "dates" | "value" | "platform"; label: string }[] = [
    { id: "creds",    label: "Credentials" },
    { id: "dates",    label: "Dates" },
    { id: "value",    label: "Value / ROI" },
    { id: "platform", label: form.category || "Platform" },
  ];

  const fv = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.category) { toast({ variant: "destructive", title: "Select a platform category" }); return; }
    setSaving(true);
    try {
      const payload = {
        category: form.category,
        label: form.label || null,
        username: form.username || null,
        email: form.email || null,
        password: form.password || null,
        recoveryEmail: form.recovery_email || null,
        recoveryEmailPassword: form.recovery_email_password || null,
        backupCodes: form.backup_codes || null,
        twofa: form.twofa || null,
        recoveryEmailTwofa: form.recovery_email_twofa || null,
        followers: form.followers || null,
        accountWorth: Number(form.account_worth) || 0,
        buyPrice: Number(form.buy_price) || 0,
        accountCreateDate: form.account_create_date || null,
        accountBuyDate: form.account_buy_date || null,
        accountLastLoginDate: form.account_last_login_date || null,
        notes: form.notes || null,
      };
      if (editAccount) {
        await customFetch<unknown>(`/api/local-accounts/${editAccount.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Account updated" });
      } else {
        await customFetch<unknown>("/api/local-accounts", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Account saved to vault" });
      }
      onSaved();
      onClose();
    } catch {
      toast({ variant: "destructive", title: "Failed to save account" });
    } finally {
      setSaving(false);
    }
  };

  const FField = ({ label, fkey, placeholder, type = "text" }: { label: string; fkey: string; placeholder?: string; type?: string }) => (
    <div className="space-y-1">
      <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</Label>
      <Input
        type={type}
        value={(form as any)[fkey] ?? ""}
        onChange={fv(fkey)}
        className="font-mono text-xs h-8 bg-input"
        placeholder={placeholder}
      />
    </div>
  );

  const TwoCol = ({ l1, k1, p1, t1, l2, k2, p2, t2 }: any) => (
    <div className="grid grid-cols-2 gap-2">
      <FField label={l1} fkey={k1} placeholder={p1} type={t1} />
      <FField label={l2} fkey={k2} placeholder={p2} type={t2 ?? "password"} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="bg-card border-card-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            {editAccount ? "Edit Account" : "Add Local Account"}
          </DialogTitle>
          <p className="text-[11px] font-mono text-muted-foreground">Account farming — store one account per entry.</p>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Platform category */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Platform *</Label>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setForm(p => ({ ...p, category: cat.name }))}
                  className={cn(
                    "px-3 py-1 rounded-full font-mono text-[10px] font-bold border transition-all",
                    form.category === cat.name
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "border-border/40 text-muted-foreground/50 hover:border-primary/30 hover:text-primary/60"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Section toggle (3 tabs) */}
          <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "flex-1 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider transition-all",
                  activeSection === s.id
                    ? "bg-card text-primary shadow-sm font-bold"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Credentials */}
          {activeSection === "creds" && (
            <div className="space-y-2">
              <TwoCol l1="Username" k1="username" p1="@handle" t1="text" l2="Password" k2="password" p2="••••••••" />
              <TwoCol l1="Email" k1="email" p1="account@gmail.com" t1="text" l2="Email Password" k2="password" p2="••••••••" />
              <TwoCol
                l1="Recovery Email" k1="recovery_email" p1="recovery@gmail.com" t1="text"
                l2="Recovery Pass" k2="recovery_email_password" p2="••••••••"
              />
              <TwoCol
                l1="2FA Secret" k1="twofa" p1="TOTP / backup code" t1="text"
                l2="Recovery 2FA" k2="recovery_email_twofa" p2="recovery email TOTP" t2="text"
              />
              <div className="space-y-1">
                <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Backup Codes</Label>
                <Textarea
                  value={(form as any).backup_codes ?? ""}
                  onChange={fv("backup_codes")}
                  className="font-mono text-xs bg-input min-h-[55px] resize-none"
                  placeholder="Paste backup codes (one per line or space separated)"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Dates & Meta */}
          {activeSection === "dates" && (
            <div className="space-y-3">
              <FField label="Label / Nickname" fkey="label" placeholder="e.g. Main acc, farming1..." type="text" />
              <div className="p-3 rounded-lg bg-primary/3 border border-primary/10 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-primary/60" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70 font-bold">Important Dates</span>
                </div>
                <FField label="Account Create Date" fkey="account_create_date" type="date" />
                <FField label="Account Buy Date" fkey="account_buy_date" type="date" />
                <FField label="Last Login Date" fkey="account_last_login_date" type="date" />
                {form.account_create_date && (
                  <div className="flex items-center gap-1.5 text-muted-foreground/50">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-mono">Account Age: <strong className="text-foreground/70">{calcAge(form.account_create_date)}</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Value & ROI */}
          {activeSection === "value" && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/10 space-y-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Account Value & ROI</span>
                </div>
                <TwoCol
                  l1="Account Worth ($)" k1="account_worth" p1="0.00" t1="number"
                  l2="Buy Price ($)" k2="buy_price" p2="0.00" t2="number"
                />
                {Number(form.account_worth) > 0 && Number(form.buy_price) > 0 && (
                  <div className={cn(
                    "flex items-center gap-2 p-2 rounded-md text-[11px] font-mono font-bold",
                    calcROI(Number(form.account_worth), Number(form.buy_price))! >= 0
                      ? "bg-green-400/10 text-green-400"
                      : "bg-red-400/10 text-red-400"
                  )}>
                    <BarChart2 className="w-3.5 h-3.5" />
                    ROI: {calcROI(Number(form.account_worth), Number(form.buy_price))! >= 0 ? "+" : ""}
                    {calcROI(Number(form.account_worth), Number(form.buy_price))!.toFixed(2)}%
                    &nbsp;(${(Number(form.account_worth) - Number(form.buy_price)).toFixed(2)} profit)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Platform-specific */}
          {activeSection === "platform" && (() => {
            const meta = getPlatformMeta(form.category);
            const MetaIcon = meta.icon;
            return (
              <div className="space-y-3">
                {/* Platform header */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/30 bg-muted/20">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: meta.color + "22", border: `1px solid ${meta.color}44` }}>
                    <MetaIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold text-foreground">{form.category || "Platform"}</div>
                    <div className="font-mono text-[9px] text-muted-foreground/50">Platform-specific stats & notes</div>
                  </div>
                </div>

                {/* Primary metric */}
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                    <MetaIcon className="w-3 h-3" style={{ color: meta.color }} />
                    {meta.metricLabel}
                  </Label>
                  <Input
                    value={(form as any).followers ?? ""}
                    onChange={fv("followers")}
                    className="font-mono text-xs h-8 bg-input"
                    placeholder={meta.metricPlaceholder}
                  />
                </div>

                {/* Tips */}
                {meta.tips.length > 0 && (
                  <div className="p-3 rounded-lg border border-primary/10 bg-primary/3 space-y-1.5">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-primary/60 font-bold flex items-center gap-1">
                      <Star className="w-2.5 h-2.5" /> Farming Tips
                    </div>
                    {meta.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="font-mono text-[9px] text-primary/40 mt-0.5">→</span>
                        <span className="font-mono text-[10px] text-muted-foreground/70">{tip}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Notes</Label>
                  <Textarea
                    value={(form as any).notes ?? ""}
                    onChange={fv("notes")}
                    className="font-mono text-xs bg-input min-h-[70px] resize-none"
                    placeholder={`Notes about this ${form.category || "account"}...`}
                  />
                </div>
              </div>
            );
          })()}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="font-mono text-xs">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="font-mono text-xs uppercase tracking-wider gap-2">
            {saving ? <><span className="animate-pulse">Saving...</span></> : <><Shield className="w-3.5 h-3.5" /> {editAccount ? "Update" : "Save Account"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Category Dialog ──────────────────────────────────────────────────────
function AddCategoryDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await customFetch<unknown>("/api/local-accounts/categories", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      toast({ title: `"${name.trim()}" category added` });
      setName("");
      onAdded();
      onClose();
    } catch {
      toast({ variant: "destructive", title: "Failed to add category" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="bg-card border-card-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <Tag className="w-4 h-4" /> New Category
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Platform Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="font-mono text-xs h-9 bg-input"
            placeholder="e.g. TikTok, Reddit, LinkedIn..."
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="font-mono text-xs">Cancel</Button>
          <Button onClick={handleAdd} disabled={saving || !name.trim()} className="font-mono text-xs gap-2">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main LocalAccounts Component ─────────────────────────────────────────────
export default function LocalAccounts() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [selectedCat, setSelectedCat] = useState<string>(DEFAULT_CATEGORIES[0].name);
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<LocalAccount[]>([]);
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<LocalAccount | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  // Load categories from API (default + custom)
  const loadCategories = useCallback(async () => {
    try {
      const data = await customFetch<{ defaults: any[]; custom: any[] }>("/api/local-accounts/categories");
      const custom: Category[] = (data.custom || []).map((c: any) => ({
        id: c.id, name: c.name, color: "#8b5cf6", icon: c.name[0], isCustom: true,
      }));
      setCategories([...DEFAULT_CATEGORIES, ...custom]);
    } catch { /* keep defaults */ }
  }, []);

  // Load all accounts
  const loadAccounts = useCallback(async () => {
    setLoadingAccts(true);
    try {
      const data = await customFetch<LocalAccount[]>("/api/local-accounts");
      setAllAccounts(Array.isArray(data) ? data : []);
    } catch { setAllAccounts([]); } finally { setLoadingAccts(false); }
  }, []);

  useEffect(() => {
    loadCategories();
    loadAccounts();
  }, [loadCategories, loadAccounts]);

  // Filter by selected category
  useEffect(() => {
    setAccounts(allAccounts.filter(a => a.category === selectedCat));
  }, [selectedCat, allAccounts]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await customFetch<unknown>(`/api/local-accounts/${deleteId}`, { method: "DELETE" });
      toast({ title: "Account deleted" });
      await loadAccounts();
    } catch { toast({ variant: "destructive", title: "Delete failed" }); }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!cat.isCustom) return;
    try {
      await customFetch<unknown>(`/api/local-accounts/categories/${cat.id}`, { method: "DELETE" });
      toast({ title: `"${cat.name}" removed` });
      loadCategories();
      if (selectedCat === cat.name) setSelectedCat(DEFAULT_CATEGORIES[0].name);
    } catch { toast({ variant: "destructive", title: "Failed to delete category" }); }
  };

  // Stats for each category
  const catStats = (name: string) => {
    const items = allAccounts.filter(a => a.category === name);
    const totalWorth = items.reduce((s, a) => s + (a.account_worth || 0), 0);
    return { count: items.length, totalWorth };
  };

  const [view, setView] = useState<"accounts" | "dashboard">("accounts");
  const totalWorth = allAccounts.reduce((s, a) => s + (a.account_worth || 0), 0);
  const totalBuyPrice = allAccounts.reduce((s, a) => s + (a.buy_price || 0), 0);
  const overallRoi = totalBuyPrice > 0 ? ((totalWorth - totalBuyPrice) / totalBuyPrice) * 100 : null;

  return (
    <div className="space-y-4">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 p-1 bg-muted/20 rounded-lg border border-border/30">
          {([
            { id: "accounts", label: "Accounts" },
            { id: "dashboard", label: "Dashboard" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                "px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wider transition-all",
                view === id
                  ? "bg-card text-primary font-bold shadow-sm border border-border/40"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >{label}</button>
          ))}
        </div>
        {view === "accounts" && (
          <Button
            size="sm"
            className="font-mono text-[10px] uppercase tracking-wider gap-1.5 h-8"
            onClick={() => { setEditAccount(undefined); setFormOpen(true); }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Account
          </Button>
        )}
      </div>

      {/* ── Dashboard view ────────────────────────────────────────────────── */}
      {view === "dashboard" && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Accounts", value: allAccounts.length.toString(), sub: "across all platforms", color: "text-foreground" },
              { label: "Portfolio Worth", value: `$${totalWorth.toFixed(2)}`, sub: "current total value", color: "text-emerald-400" },
              { label: "Total Invested", value: `$${totalBuyPrice.toFixed(2)}`, sub: "buy price sum", color: "text-muted-foreground" },
              { label: "Overall ROI", value: overallRoi !== null ? `${overallRoi >= 0 ? "+" : ""}${overallRoi.toFixed(1)}%` : "—", sub: "profit/loss", color: overallRoi !== null ? (overallRoi >= 0 ? "text-green-400" : "text-red-400") : "text-muted-foreground" },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-card-border rounded-xl p-4">
                <div className={cn("font-mono font-bold text-xl", stat.color)}>{stat.value}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-1">{stat.label}</div>
                <div className="font-mono text-[9px] text-muted-foreground/40 mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Per-platform breakdown */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Platform Breakdown
            </div>
            <div className="divide-y divide-border/30">
              {categories
                .map(cat => ({ cat, stats: catStats(cat.name) }))
                .filter(({ stats }) => stats.count > 0)
                .sort((a, b) => b.stats.totalWorth - a.stats.totalWorth)
                .map(({ cat, stats }) => {
                  const roi = totalBuyPrice > 0 ? ((stats.totalWorth - allAccounts.filter(a => a.category === cat.name).reduce((s, a) => s + (a.buy_price || 0), 0)) / allAccounts.filter(a => a.category === cat.name).reduce((s, a) => s + (a.buy_price || 0), 0)) * 100 : null;
                  return (
                    <div key={cat.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <div>
                          <div className="font-mono text-xs font-bold text-foreground">{cat.name}</div>
                          <div className="font-mono text-[9px] text-muted-foreground/50">{stats.count} account{stats.count !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold text-emerald-400">${stats.totalWorth.toFixed(2)}</div>
                        {roi !== null && !isNaN(roi) && isFinite(roi) && (
                          <div className={cn("font-mono text-[10px]", roi >= 0 ? "text-green-400" : "text-red-400")}>
                            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}% ROI
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              {allAccounts.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground font-mono text-xs">No accounts yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Accounts view ─────────────────────────────────────────────────── */}
      {view === "accounts" && (
        <div className="flex gap-4 h-full min-h-0">
          {/* ── Sidebar ─────────────────────────────────────────────────────── */}
          <div className="w-44 flex-shrink-0 space-y-0.5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Platforms</span>
              <button
                onClick={() => setCatDialogOpen(true)}
                className="text-muted-foreground/40 hover:text-primary transition-colors"
                title="Add category"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {categories.map(cat => {
              const stats = catStats(cat.name);
              const isActive = selectedCat === cat.name;
              return (
                <div key={cat.id} className="relative group/cat">
                  <button
                    onClick={() => setSelectedCat(cat.name)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg font-mono text-xs transition-all text-left",
                      isActive
                        ? "bg-primary/15 text-primary font-bold border border-primary/20"
                        : "text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
                        style={{ backgroundColor: cat.color, boxShadow: isActive ? `0 0 6px ${cat.color}80` : "none" }}
                      />
                      <span className="truncate">{cat.name}</span>
                    </div>
                    {stats.count > 0 && (
                      <span className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0",
                        isActive ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground/50"
                      )}>
                        {stats.count}
                      </span>
                    )}
                  </button>
                  {cat.isCustom && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cat:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-all p-1"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Portfolio summary */}
            {allAccounts.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/20 space-y-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40">Portfolio</span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" />
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    ${totalWorth.toFixed(2)}
                  </span>
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/40">{allAccounts.length} accounts total</div>
              </div>
            )}
          </div>

          {/* ── Content ──────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono font-bold text-base uppercase tracking-wider text-foreground flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: categories.find(c => c.name === selectedCat)?.color ?? "#8b5cf6" }}
                  />
                  {selectedCat}
                </h2>
                <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">
                  {accounts.length} account{accounts.length !== 1 ? "s" : ""}
                  {accounts.length > 0 && ` · $${accounts.reduce((s, a) => s + (a.account_worth || 0), 0).toFixed(2)} total`}
                </p>
              </div>
            </div>

            {/* Accounts grid */}
            {loadingAccts ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-44 bg-card border border-card-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-4 border border-dashed border-primary/15 rounded-xl bg-primary/2">
                <div className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center bg-primary/5">
                  <Smartphone className="w-5 h-5 text-primary/30" />
                </div>
                <div className="text-center">
                  <div className="font-mono font-bold text-foreground/60 text-sm mb-1">No {selectedCat} accounts</div>
                  <div className="text-[10px] font-mono text-muted-foreground/40">Add your first {selectedCat} account</div>
                </div>
                <Button size="sm" className="font-mono text-[10px] gap-1.5" onClick={() => { setEditAccount(undefined); setFormOpen(true); }}>
                  <Plus className="w-3.5 h-3.5" /> Add Account
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {accounts.map(acc => (
                  <AccountCard
                    key={acc.id}
                    account={acc}
                    onEdit={a => { setEditAccount(a); setFormOpen(true); }}
                    onDelete={id => setDeleteId(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <AccountFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editAccount={editAccount}
        selectedCategory={selectedCat}
        allCategories={categories}
        onSaved={loadAccounts}
      />

      <AddCategoryDialog
        open={catDialogOpen}
        onClose={() => setCatDialogOpen(false)}
        onAdded={loadCategories}
      />

      <Dialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-red-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Account?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm font-mono text-muted-foreground">This will permanently remove this account and all its credentials.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="font-mono text-xs">
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
