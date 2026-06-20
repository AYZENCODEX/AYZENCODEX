import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { User } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const doLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("ayzen_user");
    localStorage.removeItem("ayzen_token");
    setAuthTokenGetter(null);
  }, []);

  const syncSupabaseSession = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/auth/supabase-sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem("ayzen_user", JSON.stringify(data.user));
        localStorage.setItem("ayzen_token", token);
        setAuthTokenGetter(() => localStorage.getItem("ayzen_token"));
      }
    } catch {
      // Supabase sync failed — user must use demo login
    }
  }, []);

  useEffect(() => {
    // Wire up the auth token getter immediately so all API calls include the token
    setAuthTokenGetter(() => localStorage.getItem("ayzen_token"));

    // Restore session from localStorage (demo / password accounts)
    const storedUser = localStorage.getItem("ayzen_user");
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch { /* invalid json */ }
    }

    // Listen for Supabase OAuth / magic link completions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.access_token && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        await syncSupabaseSession(session.access_token);
      } else if (event === "SIGNED_OUT") {
        doLogout();
      }
    });

    setIsLoading(false);
    return () => subscription.unsubscribe();
  }, [syncSupabaseSession, doLogout]);

  const login = (newUser: User, token: string) => {
    setUser(newUser);
    localStorage.setItem("ayzen_user", JSON.stringify(newUser));
    localStorage.setItem("ayzen_token", token);
    setAuthTokenGetter(() => localStorage.getItem("ayzen_token"));
  };

  const logout = async () => {
    await supabase.auth.signOut().catch(() => {});
    doLogout();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === "admin", isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
