import { QueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// ─── API URL ────────────────────────────────────────────────────────────────
export function getApiUrl(): string {
  // EXPO_PUBLIC_API_URL is the full URL including protocol and port
  // e.g. https://8000-my-repl.replit.dev
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl;
  // Fallback for local dev
  return "http://localhost:8000";
}

// ─── Token helpers ──────────────────────────────────────────────────────────
const TOKEN_KEY = "ayzen_token";

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── API Request ─────────────────────────────────────────────────────────────
export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const url = new URL(path, getApiUrl()).toString();

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message ?? json.error ?? text;
    } catch {}
    throw new Error(message);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Default fetcher (GET) ───────────────────────────────────────────────────
async function defaultFetcher<T>({ queryKey }: { queryKey: readonly unknown[] }): Promise<T> {
  const path = queryKey[0] as string;
  return apiRequest<T>("GET", path);
}

// ─── QueryClient singleton ───────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultFetcher,
      staleTime: 30_000,
      retry: 1,
    },
  },
});
