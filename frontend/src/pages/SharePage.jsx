/**
 * SharePage — public reader landing page.
 *
 * URL: /share/:shareId
 * Auth: none (the route lives outside the auth wrapper in App.js).
 *
 * Responsibilities:
 *   - Fetch the share via publicApi (no auth)
 *   - Render one of four states:
 *       * Loading
 *       * "Link is no longer active" (revoked / expired / 404)
 *       * Ready to read — chapter content + note interactivity
 *   - Manage the reader's name across visits via cookie (scoped per share)
 *   - Mount the ReaderNameDialog on first visit
 *
 * The page intentionally has NO app chrome — no nav bar, no Layout wrapper,
 * no sidebar. The whole point is for the reader to feel like they got a
 * galley proof, not landed inside a SaaS app.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "@/lib/api";
import ReaderNameDialog from "@/components/ReaderNameDialog";
import SharedChapterReader from "@/components/SharedChapterReader";
import { Loader2, BookX, Pencil } from "lucide-react";

// ── Cookie helpers ────────────────────────────────────────────────────────
//
// Scoping the name to a specific share keeps things tidy: if the same
// reader opens a different share, they get prompted again rather than
// inheriting a name from elsewhere. A single shared cookie would be
// faster but it would make name attribution feel surprising.

const cookieName = (shareId) => `publishitt_reader_${shareId}`;

const readReaderName = (shareId) => {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${cookieName(shareId)}=`));
  if (!match) return "";
  try {
    return decodeURIComponent(match.split("=")[1] || "");
  } catch {
    return "";
  }
};

const writeReaderName = (shareId, name) => {
  if (typeof document === "undefined") return;
  // 90-day expiry — long enough that returning to a share next week or
  // next month feels seamless. SameSite=Lax is the right default for a
  // first-party cookie on a content page; Secure not required on http://
  // localhost but harmless when present in production.
  const ninetyDays = 60 * 60 * 24 * 90;
  document.cookie = `${cookieName(shareId)}=${encodeURIComponent(
    name,
  )}; Max-Age=${ninetyDays}; Path=/share; SameSite=Lax`;
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function SharePage() {
  const { shareId } = useParams();

  const [share, setShare] = useState(null); // { title, author_display_name, chapters, is_revoked, is_expired }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial value from cookie. Updated via the dialog confirm handler.
  const [readerName, setReaderName] = useState(() => readReaderName(shareId));

  // The dialog opens on first visit (no cookie name) OR when the reader
  // clicks "Change name". Two distinct triggers, one piece of state.
  const [nameDialogOpen, setNameDialogOpen] = useState(false);

  // Fetch the share. Wrapped in a callback so we can call it on mount
  // and (if we ever add a "retry" button) on demand.
  const loadShare = useCallback(async () => {
    if (!shareId) {
      setError("No share id in the URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await publicApi.getShare(shareId);
      setShare(res.data);
      setError(null);
    } catch (err) {
      if (err.response?.status === 404) {
        setError("not_found");
      } else {
        // eslint-disable-next-line no-console
        console.warn("Share fetch failed:", err);
        setError("network");
      }
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    void loadShare();
  }, [loadShare]);

  // Open the name dialog on first visit if we have a viewable share and no
  // cookie name yet. We wait for the share to load so the dialog can
  // address the reader on the author's behalf ("Mick sent you ...").
  useEffect(() => {
    if (loading || error || !share) return;
    if (share.is_revoked || share.is_expired) return;
    if (!readerName) setNameDialogOpen(true);
  }, [loading, error, share, readerName]);

  const handleNameConfirm = (name) => {
    writeReaderName(shareId, name);
    setReaderName(name);
    setNameDialogOpen(false);
  };

  // Combine the various inactive states into one bool — the page handles
  // them with one message rather than splitting "revoked" vs "expired" UI
  // (both lead to the same "this link doesn't work anymore" feeling).
  const inactive = useMemo(() => {
    if (!share) return false;
    return share.is_revoked || share.is_expired;
  }, [share]);

  // ── Render ────────────────────────────────────────────────────────────

  // The shared page is its own self-contained surface — no Layout, no nav.
  // We add a single thin top bar with the theme toggle (so a night reader
  // can flip to dark) and, if a name is set, a small "Reading as X" hint.
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Thin top bar — quiet, no branding */}
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {readerName && !inactive ? (
              <button
                type="button"
                onClick={() => setNameDialogOpen(true)}
                className="hover:text-accent transition-colors flex items-center gap-1.5"
                data-testid="change-reader-name-btn"
              >
                Reading as <span className="font-semibold normal-case tracking-normal text-foreground">{readerName}</span>
                <Pencil className="h-3 w-3" />
              </button>
            ) : (
              <span>A shared chapter</span>
            )}
          </div>
          {/* Right side intentionally empty — no branding, no app chrome */}
          <div />
        </div>
      </div>

      {/* Main content area */}
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-3" />
            <p className="text-sm">Pulling up the chapter.</p>
          </div>
        ) : error === "not_found" ? (
          <InactiveState
            title="This link doesn't exist."
            body="Check that you have the full URL. If the author sent it to you, ask them to confirm — they may have generated a new one."
          />
        ) : error === "network" ? (
          <InactiveState
            title="Couldn't reach the chapter."
            body="The server didn't respond. Try refreshing in a moment."
          />
        ) : inactive ? (
          <InactiveState
            title="This link is no longer active."
            body={
              share.is_revoked
                ? "The author has revoked it. If you'd still like to read the chapter, reach out to them directly."
                : "The link has expired. Reach out to the author if you'd still like to read."
            }
          />
        ) : share?.chapters?.length > 0 ? (
          <SharedChapterReader
            shareId={shareId}
            readerName={readerName}
            chapter={share.chapters[0]}
            authorDisplayName={share.author_display_name}
          />
        ) : (
          // Shouldn't happen — a non-inactive share with no chapters means
          // something odd backend-side. Show a neutral state rather than a
          // crash.
          <InactiveState
            title="Nothing to read here."
            body="The share is active but has no chapter content. The author may still be preparing it."
          />
        )}
      </main>

      {/* Reader name capture — first visit, or "Change name" click */}
      {share && !inactive && (
        <ReaderNameDialog
          open={nameDialogOpen}
          onOpenChange={setNameDialogOpen}
          authorDisplayName={share.author_display_name}
          chapterTitle={share.chapters?.[0]?.title || share.title}
          onConfirm={handleNameConfirm}
        />
      )}
    </div>
  );
}

// ── Inactive / error placeholder ──────────────────────────────────────────

function InactiveState({ title, body }) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div className="rounded-full bg-muted/50 p-4 mb-4">
        <BookX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="font-serif text-2xl md:text-3xl tracking-tight mb-3">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground max-w-sm">{body}</p>
    </div>
  );
}
