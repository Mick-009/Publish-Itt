/**
 * useWritingSession — tracks real writing activity and logs sessions.
 *
 * Why this exists:
 *   Tiptap's "update" event fires on focus, click, selection changes, AND on
 *   programmatic editor.commands.setContent() calls (which the autosave hook
 *   does on every chapter switch). Listening to that event to count "writing"
 *   produced phantom sessions — switching from a 200-word chapter to a 3000-
 *   word chapter looked identical to typing 2800 words. Five fix iterations
 *   never got out from under it.
 *
 * Different approach: don't listen to events. Sample the word count on a
 * timer, compare to baseline, treat any positive delta as typing. On chapter
 * change, the cleanup function fires before useChapterAutosave loads new
 * content — so the baseline gets reset before any "phantom" delta can be
 * observed. No event listeners on the editor at all.
 *
 * Session lifecycle:
 *   - Mounts (or chapter changes) → capture baseline word count, mark idle
 *   - Sampling tick (every 5s): if word count went up, mark session active
 *     and refresh "last typing seen" timestamp
 *   - Flush triggers, in order of importance:
 *       1. chapterId changes — cleanup runs, flushes the previous session
 *       2. 60 seconds with no typing detected — idle flush
 *       3. Component unmounts — cleanup flushes
 *       4. Tab close / page hide — sendBeacon flush (survives close)
 *       5. flushNow() called externally (e.g. from a manual save handler)
 *   - Throttle: minimum 10 seconds between successful POSTs
 *   - Minimum to log: 3 words OR 30 seconds (whichever produces a less noisy
 *     dataset). Anything less is treated as exploration/cleanup, not writing.
 *
 * On a successful POST, dispatches `publishitt:stats-changed` on window so
 * useStats consumers (MomentumStrip, WritingStats, WritingStatsPanel) can
 * refetch. Goal-update flows fire the same event for the same reason.
 *
 * No state, only refs. The hook never causes a re-render of its host.
 */
import { useEffect, useRef, useCallback } from "react";
import { statsApi } from "@/lib/api";

// ── Tuning constants ─────────────────────────────────────────────────────────
const SAMPLE_INTERVAL_MS = 5_000;         // word-count sampling frequency
const IDLE_FLUSH_AFTER_MS = 60_000;       // flush a session after this much quiet
const MIN_WORDS_TO_LOG = 3;               // sub-threshold = treated as noise
const MIN_SECONDS_TO_LOG = 30;            // either threshold alone is enough
const MIN_TIME_BETWEEN_FLUSHES_MS = 10_000; // throttle for rapid chapter switches

// Event name consumed by useStats. Keep the namespace prefix so a future
// listener on window doesn't collide with anything from a library.
export const STATS_CHANGED_EVENT = "publishitt:stats-changed";

// Helper: today's date as YYYY-MM-DD in the user's local timezone. Matches
// the backend, which stores `date` as a plain string in the same format.
function todayString() {
  return new Date().toLocaleDateString("en-CA");
}

// Read the current word count off the Tiptap CharacterCount extension. The
// extension exposes `.words()` synchronously; safe to call as often as we like.
function readWordCount(editor) {
  return editor?.storage?.characterCount?.words?.() ?? 0;
}

export function useWritingSession({ editor, projectId, chapterId }) {
  // Session state — all refs. No re-renders triggered from here.
  const baselineRef = useRef(0);              // word count when session opened
  const lastSampleRef = useRef(0);            // word count at last tick
  const sessionStartRef = useRef(null);       // epoch ms when first delta seen
  const lastTypingAtRef = useRef(null);       // epoch ms of last positive delta
  const lastFlushAtRef = useRef(0);           // epoch ms of last successful flush
  const flushInFlightRef = useRef(false);     // POST in progress
  const lastChapterIdRef = useRef(null);      // for reasoning about transitions

  // Keep latest project/chapter ids in refs so the unload listener and
  // flush function don't close over stale values.
  const projectIdRef = useRef(projectId);
  const chapterIdRef = useRef(chapterId);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { chapterIdRef.current = chapterId; }, [chapterId]);

  // ── Core flush ──────────────────────────────────────────────────────────
  // Build the payload from current refs and POST it. Returns true if a flush
  // was actually performed. Safe to call when no session is open (no-ops).
  //
  // `reason` is for debugging only — handy when reading the console.
  const flush = useCallback(async (reason = "manual") => {
    if (flushInFlightRef.current) return false;
    if (sessionStartRef.current == null) return false; // no session open

    const startedAt = sessionStartRef.current;
    const wordsDelta = Math.max(0, lastSampleRef.current - baselineRef.current);
    const timeSpent = Math.floor((Date.now() - startedAt) / 1000);

    // Quality gate: either enough words, or enough time. This is what kept
    // 1-word stray keystrokes out of the dataset in the old design.
    const meetsThreshold =
      wordsDelta >= MIN_WORDS_TO_LOG || timeSpent >= MIN_SECONDS_TO_LOG;

    // Clear the session-open marker BEFORE the await. If we cleared after,
    // a chapter switch mid-POST could open a new session that immediately
    // gets clobbered by the stale ref reset below.
    sessionStartRef.current = null;
    lastTypingAtRef.current = null;
    baselineRef.current = lastSampleRef.current;

    if (!meetsThreshold) {
      // Quietly drop sub-threshold sessions. Don't toast, don't log — this
      // is the normal idle-with-a-typo case.
      return false;
    }

    // Throttle: don't POST more than once per MIN_TIME_BETWEEN_FLUSHES_MS.
    // Prevents spam when someone rage-clicks between chapters.
    const since = Date.now() - lastFlushAtRef.current;
    if (since < MIN_TIME_BETWEEN_FLUSHES_MS) {
      return false;
    }

    flushInFlightRef.current = true;
    try {
      await statsApi.logSession({
        project_id: projectIdRef.current ?? null,
        chapter_id: chapterIdRef.current ?? null,
        date: todayString(),
        words_added: wordsDelta,
        words_deleted: 0, // tracked separately if we ever want it — out of scope here
        time_spent_seconds: timeSpent,
      });
      lastFlushAtRef.current = Date.now();
      // Broadcast so MomentumStrip / WritingStats / WritingStatsPanel refetch.
      window.dispatchEvent(new CustomEvent(STATS_CHANGED_EVENT));
      return true;
    } catch (err) {
      // Network blip — don't toast (writing shouldn't be interrupted by
      // stats failures). Log for the dev console and move on.
      // eslint-disable-next-line no-console
      console.warn("[useWritingSession] flush failed:", err);
      return false;
    } finally {
      flushInFlightRef.current = false;
    }
  }, []);

  // Stable reference to flush for external callers.
  const flushNow = useCallback((reason = "external") => flush(reason), [flush]);

  // ── Sampling loop ──────────────────────────────────────────────────────
  // Per-chapter effect. Sets baseline, starts the sampler, cleans up on
  // chapter change/unmount. Cleanup runs BEFORE the next effect, which is
  // exactly when we want to flush (autosave hasn't loaded new content yet).
  useEffect(() => {
    if (!editor || !chapterId) return undefined;

    // Establish baseline from current editor state. If this is a chapter
    // change, autosave just called setContent() in its own effect — we read
    // AFTER that has happened because effects in the same render commit run
    // top-down, but our cleanup-then-new-effect pattern means baseline is
    // set from post-setContent state.
    const initial = readWordCount(editor);
    baselineRef.current = initial;
    lastSampleRef.current = initial;
    sessionStartRef.current = null;
    lastTypingAtRef.current = null;
    lastChapterIdRef.current = chapterId;

    const tick = () => {
      const current = readWordCount(editor);
      const deltaFromLast = current - lastSampleRef.current;
      lastSampleRef.current = current;

      // Did the user type since last tick? Positive delta = yes.
      if (deltaFromLast > 0) {
        const now = Date.now();
        if (sessionStartRef.current == null) {
          // First sign of typing — open a session.
          sessionStartRef.current = now;
        }
        lastTypingAtRef.current = now;
        return;
      }

      // No new words this tick. If we have an open session and the user has
      // been idle long enough, flush it. The post-flush state is "no open
      // session, baseline at current count" — ready for the next burst.
      if (sessionStartRef.current != null && lastTypingAtRef.current != null) {
        const idleFor = Date.now() - lastTypingAtRef.current;
        if (idleFor >= IDLE_FLUSH_AFTER_MS) {
          void flush("idle");
        }
      }
    };

    const intervalId = setInterval(tick, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      // Flush on the way out. React runs cleanups in source order BEFORE
      // running any new effects, so at this point chapterIdRef.current
      // still holds the OLD chapter id (the ref-sync useEffect hasn't run
      // its new pass yet). That means the flush payload will correctly
      // attribute these words to the chapter we're leaving, not the one
      // we're about to load.
      void flush("chapter-change-or-unmount");
    };
  }, [editor, chapterId, projectId, flush]);

  // ── Tab close / page hide ──────────────────────────────────────────────
  // sendBeacon survives tab close, which `await fetch()` does not. We only
  // use it when a session is actually open; otherwise we skip cleanly.
  useEffect(() => {
    const onPageHide = () => {
      if (sessionStartRef.current == null) return;
      const wordsDelta = Math.max(0, lastSampleRef.current - baselineRef.current);
      const timeSpent = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const meets = wordsDelta >= MIN_WORDS_TO_LOG || timeSpent >= MIN_SECONDS_TO_LOG;
      if (!meets) return;

      // Build the same payload shape as the normal flush. Auth token has
      // to ride along since sendBeacon doesn't go through axios interceptors.
      const token = localStorage.getItem("publishitt_token");
      if (!token) return;

      const url = `${process.env.REACT_APP_BACKEND_URL}/api/stats/session`;
      const body = JSON.stringify({
        project_id: projectIdRef.current ?? null,
        chapter_id: chapterIdRef.current ?? null,
        date: todayString(),
        words_added: wordsDelta,
        words_deleted: 0,
        time_spent_seconds: timeSpent,
      });

      // sendBeacon requires a Blob for non-form bodies; the browser sends
      // it as Content-Type: application/json when we tag the blob that way.
      // Authorization header isn't supported on sendBeacon — and there's no
      // clean workaround. If the session never gets logged because the
      // user closed the tab mid-session, that's an acceptable loss.
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } catch {
        // Browser doesn't support sendBeacon — accept the loss.
      }
    };

    // `pagehide` is more reliable than `beforeunload` on mobile Safari and
    // in modern browsers in general. Fires on tab close, navigation, and
    // bfcache-friendly transitions.
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  return { flushNow };
}
