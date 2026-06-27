import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { apiRequest, setToken, removeToken, queryClient } from "@/lib/query-client";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  username: string;
  role: "admin" | "user";
  avatarUrl?: string;
  xpBalance?: number;
  aznBalance?: number;
  credits?: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  /** Standard email+password login — returns token directly */
  login: (email: string, password: string) => Promise<void>;
  /** Magic-link: step 1 — sends OTP to email */
  sendMagicLink: (email: string) => Promise<void>;
  /** Magic-link: step 2 — verifies OTP and establishes session */
  verifyMagicLink: (email: string, code: string) => Promise<void>;
  /** Register — step 1 sends OTP, step 2 posts with emailOtp */
  sendOtp: (email: string) => Promise<void>;
  register: (email: string, username: string, password: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = "ayzen_user";

async function storeUser(user: User): Promise<void> {
  const json = JSON.stringify(user);
  if (Platform.OS === "web") {
    localStorage.setItem(USER_KEY, json);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, json);
}

async function loadUser(): Promise<User | null> {
  try {
    let json: string | null = null;
    if (Platform.OS === "web") {
      json = localStorage.getItem(USER_KEY);
    } else {
      json = await SecureStore.getItemAsync(USER_KEY);
    }
    return json ? (JSON.parse(json) as User) : null;
  } catch {
    return null;
  }
}

async function clearUser(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(USER_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(USER_KEY);
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    loadUser().then((user) => {
      setState({ user, isLoading: false, isAuthenticated: !!user });
    });
  }, []);

  /** Standard login: email + password → token + user */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await apiRequest<{ token: string; user: User }>(
      "POST",
      "/api/auth/login",
      { email, password }
    );
    await setToken(res.token);
    await storeUser(res.user);
    setState({ user: res.user, isLoading: false, isAuthenticated: true });
  }, []);

  /** Magic link step 1: sends OTP */
  const sendMagicLink = useCallback(async (email: string): Promise<void> => {
    await apiRequest("POST", "/api/auth/magic-link", { email });
  }, []);

  /** Magic link step 2: verify OTP → session */
  const verifyMagicLink = useCallback(async (email: string, code: string): Promise<void> => {
    const res = await apiRequest<{ token: string; user: User }>(
      "POST",
      "/api/auth/magic-link/verify",
      { email, code }
    );
    await setToken(res.token);
    await storeUser(res.user);
    setState({ user: res.user, isLoading: false, isAuthenticated: true });
  }, []);

  /** Registration step 1: sends OTP for email verification */
  const sendOtp = useCallback(async (email: string): Promise<void> => {
    await apiRequest("POST", "/api/auth/send-otp", { email });
  }, []);

  /** Registration step 2: creates account with verified OTP */
  const register = useCallback(
    async (email: string, username: string, password: string, otp: string): Promise<void> => {
      const res = await apiRequest<{ token: string; user: User }>(
        "POST",
        "/api/auth/register",
        { email, username, password, emailOtp: otp }
      );
      await setToken(res.token);
      await storeUser(res.user);
      setState({ user: res.user, isLoading: false, isAuthenticated: true });
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await removeToken();
    await clearUser();
    queryClient.clear();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, sendMagicLink, verifyMagicLink, sendOtp, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
