import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { auth, firebaseSignOut } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const doLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("ayzen_user");
    localStorage.removeItem("ayzen_token");
    setAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("ayzen_token"));

    const storedUser = localStorage.getItem("ayzen_user");
    const storedToken = localStorage.getItem("ayzen_token");
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch { }
    }

    // Hard timeout — if Firebase never calls back (misconfigured domain,
    // network issue, blocked by Replit proxy), resolve after 2 s anyway.
    const fallback = setTimeout(() => setIsLoading(false), 2000);

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = onAuthStateChanged(auth, () => {
        clearTimeout(fallback);
        setIsLoading(false);
      });
    } catch {
      // Firebase not available at all — clear immediately
      clearTimeout(fallback);
      setIsLoading(false);
    }

    return () => {
      clearTimeout(fallback);
      unsubscribe?.();
    };
  }, [doLogout]);

  const login = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem("ayzen_user", JSON.stringify(newUser));
    localStorage.setItem("ayzen_token", newToken);
    setAuthTokenGetter(() => localStorage.getItem("ayzen_token"));
  };

  const logout = async () => {
    try { await firebaseSignOut(auth); } catch { }
    doLogout();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === "admin", isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
