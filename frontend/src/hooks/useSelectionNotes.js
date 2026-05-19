/**
 * useSelectionNotes — tracks the reader's text selection on the shared
 * chapter page and surfaces a "Leave a note" affordance.
 *
 * The hook owns:
 *   - listening for selection changes
 *   - filtering selections that are inside the chapter content (not in
 *     dialogs, sidebars, or the general impressions textarea)
 *   - computing the affordance position from the selection's bounding rect
 *   - exposing the selected text and a clear() function for the consumer
 *
 * The consumer (SharedChapterReader) owns rendering the affordance and the
 * note-composer popover. This hook is purely about "is there a selection
 * worth acting on, and where on the screen is it?"
 *
 * Scope is restricted via a containerRef. Only selections that begin and
 * end inside that ref count — that way, clicking outside or selecting in
 * an input field doesn't accidentally fire the affordance.
 */
import { useCallback, useEffect, useRef, useState } from "react";

// Selections shorter than this are ignored — likely a click or a fat-finger
// drag. Two characters is enough to catch most intentional highlights without
// triggering on stray clicks.
const MIN_SELECTION_LENGTH = 2;

// The location_reference snippet sent to the backend is truncated to this.
// Just enough to anchor a passage in the author's mind without storing the
// whole paragraph.
const MAX_SNIPPET_LENGTH = 200;

export function useSelectionNotes({ containerRef }) {
  // The current actionable selection, or null. Shape:
  //   { text: string, snippet: string, rect: { top, left, width, height } }
  const [selection, setSelection] = useState(null);

  // Stash the most recent text in a ref so the consumer can "freeze" the
  // selection while composing a note — opening a textarea will blow away
  // window.getSelection() but we don't want to lose what they highlighted.
  const frozenRef = useRef(null);

  const clear = useCallback(() => {
    setSelection(null);
    frozenRef.current = null;
    // Defensive: also clear the browser selection so the highlight visually
    // releases. Some browsers leave the blue highlight floating otherwise.
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      // No-op — old browsers without the API. Won't happen in our target
      // set but cheap insurance.
    }
  }, []);

  const freeze = useCallback(() => {
    // Snapshot whatever's currently selected so the composer can keep
    // showing it even after the textarea takes focus.
    frozenRef.current = selection;
  }, [selection]);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return undefined;

    // Selection changes fire a lot — on every mousemove during a drag.
    // We don't debounce because the work per call is cheap, but we do
    // bail out early on uninteresting states.
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        // Empty selection — clear, but only if the consumer hasn't frozen
        // one. Closing the composer should be what clears the frozen state.
        if (!frozenRef.current) setSelection(null);
        return;
      }

      const text = sel.toString().trim();
      if (text.length < MIN_SELECTION_LENGTH) {
        setSelection(null);
        return;
      }

      // Confirm the anchor and focus nodes are both inside our container.
      // If the reader selected from inside the chapter into a button or
      // toolbar, we don't act on it.
      const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      if (!range) return;

      const startInside = container.contains(range.startContainer);
      const endInside = container.contains(range.endContainer);
      if (!startInside || !endInside) {
        setSelection(null);
        return;
      }

      // Position. getBoundingClientRect on the range gives us screen-relative
      // coords; the consumer can position an absolutely-placed affordance
      // by adding window.scrollX/Y.
      const rect = range.getBoundingClientRect();

      // Empty rects can happen for collapsed-but-not-collapsed selections
      // (e.g. when the focus is at the end of a text node). Skip them.
      if (rect.width === 0 && rect.height === 0) {
        setSelection(null);
        return;
      }

      const snippet =
        text.length > MAX_SNIPPET_LENGTH
          ? text.slice(0, MAX_SNIPPET_LENGTH).trimEnd() + "…"
          : text;

      setSelection({
        text,
        snippet,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
        },
      });
    };

    // selectionchange fires on the document, not the container. That's the
    // contract — we filter via container.contains() inside the handler.
    document.addEventListener("selectionchange", handleSelectionChange);

    // On scroll/resize the rect changes — recompute or hide. Simplest is to
    // re-run the handler; if the selection is still valid, we get fresh
    // coords. If it's been cleared by the scroll, we naturally clear.
    const onLayoutChange = () => handleSelectionChange();
    window.addEventListener("scroll", onLayoutChange, { passive: true });
    window.addEventListener("resize", onLayoutChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", onLayoutChange);
      window.removeEventListener("resize", onLayoutChange);
    };
  }, [containerRef]);

  return {
    // What the consumer renders the affordance against. Null = no actionable
    // selection.
    selection: frozenRef.current ?? selection,
    // Snapshot the current selection so the composer can keep showing it.
    freeze,
    // Release the snapshot and clear the live selection.
    clear,
  };
}
