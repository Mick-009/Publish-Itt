/**
 * SharedChapterReader — the reading surface for a shared chapter.
 *
 * Renders:
 *   - The chapter content (sanitized HTML from the backend)
 *   - A floating "Leave a note" affordance that follows the reader's
 *     selection
 *   - A composer popover for typing the note
 *   - A "How did it land?" general impressions section at the end
 *
 * The reading aesthetic is deliberate: serif, generous margins, no app
 * chrome, dark-mode friendly. The reader should feel like they're reading
 * a galley proof, not a Google Doc.
 *
 * Note submission goes through publicApi (no auth). On success we flash a
 * brief acknowledgement and clear the composer.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { publicApi } from "@/lib/api";
import { useSelectionNotes } from "@/hooks/useSelectionNotes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MessageSquare, X, Loader2, Send, Check } from "lucide-react";

export default function SharedChapterReader({
  shareId,
  readerName,
  chapter, // { title, content_html }
  authorDisplayName,
}) {
  // Container ref for the chapter prose. Selection tracking is scoped here
  // so highlights in the impressions textarea or buttons don't fire the
  // affordance.
  const proseRef = useRef(null);
  const { selection, freeze, clear } = useSelectionNotes({
    containerRef: proseRef,
  });

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // General impressions state
  const [impressionDraft, setImpressionDraft] = useState("");
  const [submittingImpression, setSubmittingImpression] = useState(false);
  const [impressionSent, setImpressionSent] = useState(false);

  // When the reader opens the composer, freeze the selection so the
  // textarea focusing doesn't tear the highlight away.
  const openComposer = () => {
    freeze();
    setNoteDraft("");
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setNoteDraft("");
    clear();
  };

  const submitNote = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed || !selection || submittingNote) return;
    setSubmittingNote(true);
    try {
      await publicApi.postNote(shareId, {
        readerName,
        noteText: trimmed,
        locationReference: selection.snippet,
        isGeneralImpression: false,
      });
      toast.success("Note sent.");
      closeComposer();
    } catch (err) {
      // 410 = share revoked/expired. Tell the reader plainly.
      if (err.response?.status === 410) {
        toast.error("This share is no longer active.");
      } else {
        toast.error(err.response?.data?.detail || "Couldn't send the note.");
      }
    } finally {
      setSubmittingNote(false);
    }
  };

  const submitImpression = async () => {
    const trimmed = impressionDraft.trim();
    if (!trimmed || submittingImpression) return;
    setSubmittingImpression(true);
    try {
      await publicApi.postNote(shareId, {
        readerName,
        noteText: trimmed,
        locationReference: "",
        isGeneralImpression: true,
      });
      setImpressionDraft("");
      setImpressionSent(true);
      toast.success("Impression sent. Thank you.");
    } catch (err) {
      if (err.response?.status === 410) {
        toast.error("This share is no longer active.");
      } else {
        toast.error(err.response?.data?.detail || "Couldn't send.");
      }
    } finally {
      setSubmittingImpression(false);
    }
  };

  // Affordance position — anchor the button below the selection's bottom-
  // left corner, offset by the page scroll. Stays in place when the reader
  // scrolls because we add window.scrollY here.
  //
  // Computed inline rather than memoized; it's cheap and the selection
  // already changes infrequently.
  const affordanceStyle = selection
    ? {
        position: "absolute",
        top: selection.rect.bottom + window.scrollY + 8,
        left: selection.rect.left + window.scrollX,
      }
    : null;

  // If the reader hasn't named themselves yet (i.e. they closed the name
  // dialog) we render the chapter but no note interactivity. That's a
  // legitimate state — they want to read but not engage.
  const interactive = !!readerName;

  return (
    <article className="relative">
      {/* ── Chapter title ── */}
      <header className="mb-12 text-center">
        {authorDisplayName && (
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            {authorDisplayName} sent this to you
          </p>
        )}
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight text-foreground">
          {chapter.title || "Untitled chapter"}
        </h1>
      </header>

      {/* ── Chapter prose ── */}
      <div
        ref={proseRef}
        className={cn(
          "font-serif text-[18px] leading-8 text-foreground",
          // Prose styles for the rendered HTML. Tiptap stores p, strong,
          // em, blockquote, h1/h2, ul/ol — these tailwinds cover them.
          "[&_p]:mb-6",
          "[&_h1]:font-serif [&_h1]:text-3xl [&_h1]:tracking-tight [&_h1]:mt-12 [&_h1]:mb-6",
          "[&_h2]:font-serif [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-4",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-accent/60 [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:my-6 [&_blockquote]:text-foreground/85",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-6",
          "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-6",
          "[&_li]:mb-2",
          "[&_strong]:font-semibold",
          "[&_em]:italic",
          // Selection style — soft accent highlight, no harsh blue.
          "selection:bg-accent/25",
        )}
        dangerouslySetInnerHTML={{ __html: chapter.content_html || "" }}
        data-testid="shared-chapter-prose"
      />

      {/* ── Floating "Leave a note" affordance ── */}
      {interactive && selection && !composerOpen && (
        <div style={affordanceStyle} className="z-30">
          <Button
            size="sm"
            onClick={openComposer}
            className="rounded-sm shadow-md"
            data-testid="leave-note-affordance"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Leave a note
          </Button>
        </div>
      )}

      {/* ── Composer popover ── */}
      {interactive && selection && composerOpen && (
        <div
          style={affordanceStyle}
          className="z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-sm border border-border bg-card shadow-lg"
          data-testid="note-composer"
        >
          <div className="p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                On this passage
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 -mt-1 -mr-1"
                onClick={closeComposer}
                aria-label="Close"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Quoted snippet — quiet, italic, truncated */}
            <div className="text-xs text-muted-foreground italic border-l-2 border-accent/40 pl-2 line-clamp-3">
              "{selection.snippet}"
            </div>

            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What stood out to you?"
              autoFocus
              rows={3}
              maxLength={5000}
              className="rounded-sm resize-none text-sm"
              data-testid="note-composer-textarea"
              onKeyDown={(e) => {
                // Cmd/Ctrl + Enter submits — common pattern for inline
                // composers, doesn't fight against multi-line typing.
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submitNote();
                }
              }}
            />

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeComposer}
                disabled={submittingNote}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitNote}
                disabled={!noteDraft.trim() || submittingNote}
                className="rounded-sm h-7 text-xs"
                data-testid="submit-note-btn"
              >
                {submittingNote ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Sending.
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1.5" />
                    Send note
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── General impressions at the end ── */}
      <section className="mt-16 pt-10 border-t border-border" aria-label="General impressions">
        <h2 className="font-serif text-2xl tracking-tight mb-2">
          How did it land?
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          The single thing — a feeling, a question, a thought — that stays with
          you after closing the page. Optional, but appreciated.
        </p>

        {impressionSent ? (
          <div
            className="rounded-sm border border-accent/30 bg-accent/5 p-4 flex items-start gap-3"
            data-testid="impression-sent"
          >
            <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Your impression is in.</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can keep reading, or leave more inline notes. Anything you
                add will reach {authorDisplayName || "the author"}.
              </p>
            </div>
          </div>
        ) : (
          <>
            {interactive ? (
              <>
                <Textarea
                  value={impressionDraft}
                  onChange={(e) => setImpressionDraft(e.target.value)}
                  placeholder="It started slow, then the third scene caught me. The ending sat in my chest for a minute."
                  rows={5}
                  maxLength={5000}
                  className="rounded-sm resize-none font-serif text-base"
                  data-testid="impression-textarea"
                />
                <div className="flex items-center justify-end mt-3">
                  <Button
                    onClick={submitImpression}
                    disabled={!impressionDraft.trim() || submittingImpression}
                    className="rounded-sm"
                    data-testid="submit-impression-btn"
                  >
                    {submittingImpression ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending.
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send impression
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Set your name to leave an impression.
              </p>
            )}
          </>
        )}
      </section>
    </article>
  );
}
