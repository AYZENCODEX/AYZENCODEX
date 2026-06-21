import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

/**
 * Connects to the SSE /api/events endpoint and invalidates React Query cache
 * whenever the server broadcasts a change event.
 *
 * The server emits:
 *   event: tasks_updated  → invalidate ["tasks"]
 *   event: projects_updated → invalidate ["projects"]
 *   event: users_updated  → invalidate ["users"]
 *   event: leaderboard_updated → invalidate ["leaderboard"]
 *   event: inbox_updated  → invalidate ["broadcasts"]
 *   event: data_updated   → invalidate everything
 */
export function useRealtime() {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("ayzen_token");
    if (!token) return;

    const url = `${BASE}/api/events`;
    const es = new EventSource(url);
    esRef.current = es;

    const invalidate = (keys: string[][]) => {
      keys.forEach(key => qc.invalidateQueries({ queryKey: key }));
    };

    es.addEventListener("tasks_updated",      () => invalidate([["tasks"], ["userStats"]]));
    es.addEventListener("projects_updated",   () => invalidate([["projects"]]));
    es.addEventListener("users_updated",      () => invalidate([["users"], ["me"], ["userStats"]]));
    es.addEventListener("leaderboard_updated",() => invalidate([["leaderboard"]]));
    es.addEventListener("inbox_updated",      () => invalidate([["broadcasts"]]));
    es.addEventListener("vault_updated",      () => invalidate([["vaultEntries"]]));
    es.addEventListener("data_updated", () => {
      qc.invalidateQueries();
    });

    es.onerror = () => {
      es.close();
      // Reconnect after 5s
      setTimeout(() => {
        esRef.current = null;
      }, 5000);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [qc]);
}
