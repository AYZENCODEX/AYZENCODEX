import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { PluginsProvider } from "@/hooks/use-plugins";
import { AppLayout } from "@/components/layout/app-layout";
import { AiChat } from "@/components/ai-chat";
import { useRealtime } from "@/hooks/use-realtime";
import { CommandSearch } from "@/components/command-search";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ScrollToTop } from "@/components/scroll-to-top";

// Always eager-load auth pages (users hit these first)
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

// Lazy-load all authenticated pages for code splitting
const AdminDashboard    = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsers        = lazy(() => import("@/pages/admin/users"));
const AdminProjects     = lazy(() => import("@/pages/admin/projects"));
const AdminProjectDetail = lazy(() => import("@/pages/admin/project-detail"));
const AdminTasks        = lazy(() => import("@/pages/admin/tasks"));
const AdminGas          = lazy(() => import("@/pages/admin/tools/gas"));
const AdminWallet       = lazy(() => import("@/pages/admin/tools/wallet"));
const AdminStreak       = lazy(() => import("@/pages/admin/tools/streak"));
const AdminBroadcast    = lazy(() => import("@/pages/admin/broadcast"));
const AdminLeaderboard  = lazy(() => import("@/pages/admin/leaderboard"));
const AdminSettings     = lazy(() => import("@/pages/admin/settings"));
const AdminDeveloper    = lazy(() => import("@/pages/admin/developer"));
const AdminVault        = lazy(() => import("@/pages/admin/vault"));
const AdminPlugins      = lazy(() => import("@/pages/admin/plugins"));
const AdminSupport      = lazy(() => import("@/pages/admin/support"));
const AdminReferrals    = lazy(() => import("@/pages/admin/referrals"));
const AdminCreditsPage  = lazy(() => import("@/pages/admin/credits"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/subscriptions"));
const AdminActivity      = lazy(() => import("@/pages/admin/activity"));
const AdminCategories   = lazy(() => import("@/pages/admin/categories"));
const AdminNetworks     = lazy(() => import("@/pages/admin/tools/networks"));
const AdminHealthRules  = lazy(() => import("@/pages/admin/health-rules"));

const UserHome          = lazy(() => import("@/pages/user/home"));
const UserDashboard     = lazy(() => import("@/pages/user/dashboard"));
const UserProjects      = lazy(() => import("@/pages/user/projects"));
const UserProjectDetail = lazy(() => import("@/pages/user/project-detail"));
const UserTasks         = lazy(() => import("@/pages/user/tasks"));
const UserVault         = lazy(() => import("@/pages/user/vault"));
const UserLeaderboard   = lazy(() => import("@/pages/user/leaderboard"));
const UserInbox         = lazy(() => import("@/pages/user/inbox"));
const Authenticator     = lazy(() => import("@/pages/user/authenticator"));
const AyzenEmail        = lazy(() => import("@/pages/user/ayzen-email"));
const UserProfile       = lazy(() => import("@/pages/user/profile"));
const EmailAccounts     = lazy(() => import("@/pages/user/email-accounts"));
const UserSupport       = lazy(() => import("@/pages/user/support"));
const UserReferrals     = lazy(() => import("@/pages/user/referrals"));
const UserSettings      = lazy(() => import("@/pages/user/settings"));
const UserWallets       = lazy(() => import("@/pages/user/wallets"));
const SubscriptionPage  = lazy(() => import("@/pages/user/subscription"));
const CreditsPage       = lazy(() => import("@/pages/user/credits"));
const UserHistory       = lazy(() => import("@/pages/user/history"));
const EarnPage          = lazy(() => import("@/pages/user/earn"));
const CalculatorPage    = lazy(() => import("@/pages/user/calculator"));
const TeamsPage         = lazy(() => import("@/pages/user/teams"));
const ContentPage       = lazy(() => import("@/pages/user/content"));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="font-mono text-xs text-muted-foreground/50 animate-pulse tracking-widest uppercase">
        Loading...
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono">INITIALIZING...</div>;
  if (!user) return <Redirect to="/login" />;
  if (adminOnly && !isAdmin) return <Redirect to="/dashboard" />;

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Component {...rest} />
      </Suspense>
    </AppLayout>
  );
}

function Router() {
  const { user, isAdmin } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {user ? (isAdmin ? <Redirect to="/admin/dashboard" /> : <Redirect to="/home" />) : <Landing />}
      </Route>

      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />

      {/* Admin Routes */}
      <Route path="/admin/dashboard">{() => <ProtectedRoute component={AdminDashboard} adminOnly />}</Route>
      <Route path="/admin/users">{() => <ProtectedRoute component={AdminUsers} adminOnly />}</Route>
      <Route path="/admin/projects">{() => <ProtectedRoute component={AdminProjects} adminOnly />}</Route>
      <Route path="/admin/projects/:id">{() => <ProtectedRoute component={AdminProjectDetail} adminOnly />}</Route>
      <Route path="/admin/tasks">{() => <ProtectedRoute component={AdminTasks} adminOnly />}</Route>
      <Route path="/admin/tools/gas">{() => <ProtectedRoute component={AdminGas} adminOnly />}</Route>
      <Route path="/admin/tools/wallet">{() => <ProtectedRoute component={AdminWallet} adminOnly />}</Route>
      <Route path="/admin/tools/streak">{() => <ProtectedRoute component={AdminStreak} adminOnly />}</Route>
      <Route path="/admin/broadcast">{() => <ProtectedRoute component={AdminBroadcast} adminOnly />}</Route>
      <Route path="/admin/leaderboard">{() => <ProtectedRoute component={AdminLeaderboard} adminOnly />}</Route>
      <Route path="/admin/vault">{() => <ProtectedRoute component={AdminVault} adminOnly />}</Route>
      <Route path="/admin/plugins">{() => <ProtectedRoute component={AdminPlugins} adminOnly />}</Route>
      <Route path="/admin/settings">{() => <ProtectedRoute component={AdminSettings} adminOnly />}</Route>
      <Route path="/admin/developer">{() => <ProtectedRoute component={AdminDeveloper} adminOnly />}</Route>
      <Route path="/admin/support">{() => <ProtectedRoute component={AdminSupport} adminOnly />}</Route>
      <Route path="/admin/referrals">{() => <ProtectedRoute component={AdminReferrals} adminOnly />}</Route>
      <Route path="/admin/credits">{() => <ProtectedRoute component={AdminCreditsPage} adminOnly />}</Route>
      <Route path="/admin/subscriptions">{() => <ProtectedRoute component={AdminSubscriptions} adminOnly />}</Route>
      <Route path="/admin/activity">{() => <ProtectedRoute component={AdminActivity} adminOnly />}</Route>
      <Route path="/admin/categories">{() => <ProtectedRoute component={AdminCategories} adminOnly />}</Route>
      <Route path="/admin/tools/networks">{() => <ProtectedRoute component={AdminNetworks} adminOnly />}</Route>
      <Route path="/admin/health-rules">{() => <ProtectedRoute component={AdminHealthRules} adminOnly />}</Route>

      {/* User Routes */}
      <Route path="/home">{() => <ProtectedRoute component={UserHome} />}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={UserDashboard} />}</Route>
      <Route path="/projects">{() => <ProtectedRoute component={UserProjects} />}</Route>
      <Route path="/projects/:id">{() => <ProtectedRoute component={UserProjectDetail} />}</Route>
      <Route path="/tasks">{() => <ProtectedRoute component={UserTasks} />}</Route>
      <Route path="/vault">{() => <ProtectedRoute component={UserVault} />}</Route>
      <Route path="/leaderboard">{() => <ProtectedRoute component={UserLeaderboard} />}</Route>
      <Route path="/inbox">{() => <ProtectedRoute component={UserInbox} />}</Route>
      <Route path="/authenticator">{() => <ProtectedRoute component={Authenticator} />}</Route>
      <Route path="/ayzen-email">{() => <ProtectedRoute component={AyzenEmail} />}</Route>
      <Route path="/profile">{() => <ProtectedRoute component={UserProfile} />}</Route>
      <Route path="/email-accounts">{() => <ProtectedRoute component={EmailAccounts} />}</Route>
      <Route path="/support">{() => <ProtectedRoute component={UserSupport} />}</Route>
      <Route path="/referrals">{() => <ProtectedRoute component={UserReferrals} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={UserSettings} />}</Route>
      <Route path="/wallets">{() => <ProtectedRoute component={UserWallets} />}</Route>
      <Route path="/subscription">{() => <ProtectedRoute component={SubscriptionPage} />}</Route>
      <Route path="/credits">{() => <ProtectedRoute component={CreditsPage} />}</Route>
      <Route path="/history">{() => <ProtectedRoute component={UserHistory} />}</Route>
      <Route path="/earn">{() => <ProtectedRoute component={EarnPage} />}</Route>
      <Route path="/calculator">{() => <ProtectedRoute component={CalculatorPage} />}</Route>
      <Route path="/teams">{() => <ProtectedRoute component={TeamsPage} />}</Route>
      <Route path="/content">{() => <ProtectedRoute component={ContentPage} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  return <>{children}</>;
}

function App() {
  useEffect(() => {
    const saved = localStorage.getItem("ayzen_theme");
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <PluginsProvider>
              <RealtimeProvider>
                <Router />
                <AiChat />
                <CommandSearch />
                <KeyboardShortcuts />
                <ScrollToTop />
              </RealtimeProvider>
            </PluginsProvider>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
