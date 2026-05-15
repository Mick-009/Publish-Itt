import { thadApi } from "@/lib/api";

const STASH_KEY = "publishitt_pending_style_note";

/**
 * If the user wrote a style note during onboarding (before they had a project),
 * we stashed it in localStorage. Call this with their newly-created project ID
 * to convert the stash into a real style note attached to the project.
 *
 * Safe to call unconditionally — does nothing if no stash exists. Clears the
 * stash on success so it doesn't get re-attached to a second project.
 *
 * Returns true if a note was saved, false otherwise.
 */
export async function consumePendingStyleNote(projectId) {
  if (!projectId) return false;

  let stash;
  try {
    const raw = localStorage.getItem(STASH_KEY);
    if (!raw) return false;
    stash = JSON.parse(raw);
  } catch {
    // Bad stash — clear it and bail
    localStorage.removeItem(STASH_KEY);
    return false;
  }

  const note = (stash?.note || "").trim();
  if (!note) {
    localStorage.removeItem(STASH_KEY);
    return false;
  }

  try {
    await thadApi.createStyleNote(projectId, note, null);
    localStorage.removeItem(STASH_KEY);
    return true;
  } catch (err) {
    // Don't clear the stash on failure — let them retry by creating
    // another project. The note isn't lost.
    console.warn("Couldn't save onboarding style note:", err);
    return false;
  }
}

/**
 * Read the stashed note without consuming it. Useful if a surface wants
 * to preview "you mentioned earlier: ..." before persisting.
 */
export function peekPendingStyleNote() {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear the stash without saving — used if the user creates multiple
 * projects and the first one already consumed the note, or if they
 * change their mind.
 */
export function clearPendingStyleNote() {
  localStorage.removeItem(STASH_KEY);
}
