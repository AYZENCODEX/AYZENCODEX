import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { AiChat } from "@/components/ai-chat";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminProjects from "@/pages/admin/projects";
import AdminProjectDetail from "@/pages/admin/project-detail";
import AdminTasks from "@/pages/admin/tasks";
import AdminGas from "@/pages/admin/tools/gas";
import AdminWallet from "@/pages/admin/tools/wallet";
import AdminStreak from "@/pages/admin/tools/streak";
import AdminBroadcast from "@/pages/admin/broadcast";
import AdminLeaderboard from "@/pages/admin/leaderboard";
import AdminSettings from "@/pages/admin/settings";
import AdminDeveloper from "@/pages/admin/developer";
import AdminVault from "@/pages/admin/vault";
import UserDashboard from "@/pages/user/dashboard";
import UserProjects from "@/pages/user/projects";
import UserProjectDetail from "@/pages/user/project-detail";
import UserTasks from "@/pages/user/tasks";
import UserVault from "@/pages/user/vault";
import UserLeaderboard from "@/pages/user/leaderboard";
import UserInbox from "@/pages/user/inbox";
import Authenticator from "@/pages/user/authenticator";
import AyzenEmail from "@/pages/user/ayzen-email";

import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono">INITIALIZING...</div>;

  if (!user) return <Redirect to="/login" />;

  if (adminOnly && !isAdmin) return <Redirect to="/dashboard" />;

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function Router() {
  const { user, isAdmin } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {user ? (isAdmin ? <Redirect to="/admin/dashboard" /> : <Redirect to="/dashboard" />) : <Redirect to="/login" />}
      </Route>

      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

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
      <Route path="/admin/settings">{() => <ProtectedRoute component={AdminSettings} adminOnly />}</Route>
      <Route path="/admin/developer">{() => <ProtectedRoute component={AdminDeveloper} adminOnly />}</Route>

      {/* User Routes */}
      <Route path="/dashboard">{() => <ProtectedRoute component={UserDashboard} />}</Route>
      <Route path="/projects">{() => <ProtectedRoute component={UserProjects} />}</Route>
      <Route path="/projects/:id">{() => <ProtectedRoute component={UserProjectDetail} />}</Route>
      <Route path="/tasks">{() => <ProtectedRoute component={UserTasks} />}</Route>
      <Route path="/vault">{() => <ProtectedRoute component={UserVault} />}</Route>
      <Route path="/leaderboard">{() => <ProtectedRoute component={UserLeaderboard} />}</Route>
      <Route path="/inbox">{() => <ProtectedRoute component={UserInbox} />}</Route>
      <Route path="/authenticator">{() => <ProtectedRoute component={Authenticator} />}</Route>
      <Route path="/ayzen-email">{() => <ProtectedRoute component={AyzenEmail} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <AiChat />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
