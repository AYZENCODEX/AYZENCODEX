import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

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

    setIsLoading(false);
  }, []);

  const login = useCallback((u: User, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("ayzen_user", JSON.stringify(u));
    localStorage.setItem("ayzen_token", t);
    setAuthTokenGetter(() => t);
  }, []);

  const logout = useCallback(() => {
    doLogout();
  }, [doLogout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === "admin", isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
