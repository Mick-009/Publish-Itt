/**
 * useStats — data layer for writing statistics.
 *
 * Single source of truth for the three UI surfaces that show stats:
 *   - MomentumStrip (Dashboard top)              wants today + weekly
 *   - WritingStatsPanel (workspace right tab)    wants today + weekly + overview
 *   - WritingStats (full /stats page)            wants overview + weekly + streak
 *
 * Each surface declares what it needs via the `surfaces` prop. We only fetch
 * what's asked for — no wasted requests, no over-fetching on the dashboard.
 *
 * Auto-refresh: listens for `publishitt:stats-changed` on window. Anything
 * that mutates writing-stats state fires that event:
 *   - useWritingSession flushes a session
 *   - MomentumStrip / WritingStatsPanel save a new daily goal
 *
 * Hooks consuming this don't need to wire up refresh logic themselves — the
 * event bus handles cross-component invalidation.
 *
 * The endpoints are cheap (computed from raw writing_sessions on demand, no
 * aggregation table), so refetching everything on each event is fine.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { statsApi } from "@/lib/api";
import { STATS_CHANGED_EVENT } from "@/hooks/useWritingSession";

// Map of surface name → API method on statsApi. Single place to add a new
// surface if we ever expand (e.g. "monthly", "by_project").
const SURFACE_LOADERS = {
  today: () => statsApi.getToday(),
  weekly: () => statsApi.getWeekly(),
  overview: () => statsApi.getOverview(),
  streak: () => statsApi.getStreak(),
};

// Default to all surfaces — but in practice callers always specify, which
// makes the no-op fetches obvious if surfaces is misspelled.
const DEFAULT_SURFACES = ["today", "weekly", "overview", "streak"];

export function useStats({ surfaces = DEFAULT_SURFACES } = {}) {
  const [today, setToday] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [overview, setOverview] = useState(null);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Keep surfaces in a ref so the refresh callback's identity stays stable
  // across renders — otherwise every consumer would re-bind its window
  // listener on each render and we'd churn event handlers.
  const surfacesRef = useRef(surfaces);
  useEffect(() => { surfacesRef.current = surfaces; });

  // Mount guard — prevents setState after unmount on slow networks.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const requested = surfacesRef.current;

    // Pull only the surfaces this consumer asked for. Promise.all means we
    // get all of them in roughly one round trip's worth of wall time.
    const tasks = requested
      .filter((name) => SURFACE_LOADERS[name])
      .map(async (name) => {
        const res = await SURFACE_LOADERS[name]();
        return [name, res.data];
      });

    try {
      const results = await Promise.all(tasks);
      if (!mountedRef.current) return;

      // Apply each result to its respective slot. Unknown surfaces silently
      // ignored (handled by the filter above).
      for (const [name, data] of results) {
        if (name === "today") setToday(data);
        else if (name === "weekly") setWeekly(Array.isArray(data) ? data : []);
        else if (name === "overview") setOverview(data);
        else if (name === "streak") setStreak(data);
      }
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      // Single error state across all surfaces — these endpoints share a
      // backend, so they tend to fail together (auth expired, backend down).
      setError(err?.message || "Couldn't load stats");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Initial load on mount.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh on the cross-component event bus.
  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener(STATS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(STATS_CHANGED_EVENT, handler);
  }, [refresh]);

  return {
    today,
    weekly,
    overview,
    streak,
    loading,
    error,
    refresh,
  };
}

// Re-export the event name so consumers that fire it themselves (e.g. goal
// dialogs) don't have to import from useWritingSession directly.
export { STATS_CHANGED_EVENT };
