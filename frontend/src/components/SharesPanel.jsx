/**
 * SharesPanel — author's hub for sharing chapters with readers.
 *
 * Sits as a new tab in the workspace sidebar alongside Chapters / Notes /
 * Read / Stage / History / Thad. Lists active shares for the current
 * project, lets the author create a new one for the current chapter,
 * copy the link, and revoke when done.
 *
 * Reader-facing UX (the page they land on, the notes they leave) is in
 * SharePage / SharedChapterReader, built in pass 2. This file only deals
 * with the author's side.
 *
 * Notes from readers don't surface here — they flow into the existing
 * NotesPanel as `reader_feedback` notes. This panel is just the inventory
 * and lifecycle of share links.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sharesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { QuillMarkArt } from "@/components/EmptyStateArt";
import {
  Send,
  Link as LinkIcon,
  Copy,
  Loader2,
  Clock,
  Users,
  MessageSquare,
  Check,
  X,
} from "lucide-react";

// Format an ISO timestamp as "May 18, 2:14 PM"
const fmtDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// Build the reader-facing URL for a share. Uses window.location.origin so
// dev (localhost:3000) and prod work without env config.
const shareUrl = (shareId) => `${window.location.origin}/share/${shareId}`;

export default function SharesPanel({ projectId, chapterId, chapterTitle }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdShare, setCreatedShare] = useState(null); // set after a successful create — switches dialog to "your link" state

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState(null);

  // Per-row "copied" affordance — keyed by share id so multiple links can
  // briefly show "Copied" in succession without stomping each other.
  const [copiedId, setCopiedId] = useState(null);

  // ── Load + reload ─────────────────────────────────────────────────────
  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await sharesApi.list(projectId);
      setShares(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Couldn't load shares:", err);
      setShares([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Split into active vs revoked/expired so the author sees what's live first.
  const { active, inactive } = useMemo(() => {
    const a = [];
    const i = [];
    for (const s of shares) {
      const expired = s.expires_at && new Date(s.expires_at) <= new Date();
      if (s.revoked || expired) i.push(s);
      else a.push(s);
    }
    return { active: a, inactive: i };
  }, [shares]);

  // ── Create ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!projectId || !chapterId) {
      toast.error("Open a chapter first.");
      return;
    }
    setCreating(true);
    try {
      const res = await sharesApi.create({
        projectId,
        chapterIds: [chapterId],
        title: chapterTitle || undefined,
      });
      setCreatedShare(res.data);
      // Optimistically prepend to the list — saves a refetch round trip.
      setShares((prev) => [res.data, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't create the link.");
    } finally {
      setCreating(false);
    }
  };

  // Copy helper. Falls back to a manual select if clipboard isn't available
  // (Safari with strict permissions, very old browsers).
  const copyLink = async (share) => {
    const url = shareUrl(share.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(share.id);
      window.setTimeout(() => setCopiedId(null), 1600);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. The link is shown — copy it by hand.");
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await sharesApi.revoke(revokeTarget.id);
      setShares((prev) =>
        prev.map((s) =>
          s.id === revokeTarget.id ? { ...s, revoked: true } : s,
        ),
      );
      toast.success("Link revoked.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't revoke.");
    } finally {
      setRevokeTarget(null);
    }
  };

  // Reset create dialog state when it closes so reopening is clean.
  const closeCreateDialog = (open) => {
    setCreateOpen(open);
    if (!open) setCreatedShare(null);
  };

  // ── Empty placeholder if no chapter open ───────────────────────────
  if (!chapterId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-4 text-center">
        <Send className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Open a chapter to send it to a reader.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="shares-panel">
      {/* ── Header + create button ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Shares</span>
          <Badge variant="secondary" className="text-xs">
            {active.length}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="rounded-sm h-8"
          data-testid="create-share-btn"
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          Send to a reader
        </Button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shares.length === 0 ? (
        <EmptyState
          size="panel"
          art={<QuillMarkArt size={72} />}
          title="Nothing sent out yet."
          body="When a chapter is ready for a reader, send them a link. Their notes come back into your notes panel."
          primaryAction={{
            label: "Send to a reader",
            icon: Send,
            onClick: () => setCreateOpen(true),
            testId: "empty-shares-send-btn",
          }}
          testId="empty-shares-panel"
        />
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-2">
            {active.length > 0 && (
              <ShareList
                shares={active}
                copiedId={copiedId}
                onCopy={copyLink}
                onRevoke={setRevokeTarget}
              />
            )}

            {inactive.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold pt-3 pb-1">
                  No longer active
                </div>
                <ShareList
                  shares={inactive}
                  copiedId={copiedId}
                  onCopy={copyLink}
                  onRevoke={setRevokeTarget}
                  isInactive
                />
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={closeCreateDialog}>
        <DialogContent
          className="sm:max-w-md"
          data-testid="create-share-dialog"
        >
          {!createdShare ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif flex items-center gap-2">
                  <Send className="h-5 w-5 text-accent" />
                  Send to a reader
                </DialogTitle>
                <DialogDescription>
                  A link they can open with no account. Their notes come back
                  to you here.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-3">
                <Card className="bg-muted/40 border-dashed">
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                      You're sending
                    </p>
                    <p className="font-serif text-base tracking-tight">
                      {chapterTitle || "Untitled chapter"}
                    </p>
                  </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground">
                  You can revoke the link any time. Until then, anyone with it
                  can read this chapter and leave notes.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="rounded-sm"
                  data-testid="confirm-create-share-btn"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating.
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create the link
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-accent" />
                  Ready to send
                </DialogTitle>
                <DialogDescription>
                  Copy the link and hand it to your reader.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shareUrl(createdShare.id)}
                    className="rounded-sm font-mono text-xs"
                    onFocus={(e) => e.target.select()}
                    data-testid="created-share-url"
                  />
                  <Button
                    size="sm"
                    onClick={() => copyLink(createdShare)}
                    className="rounded-sm shrink-0"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  The reader sees the chapter only — not your workspace, not
                  your other chapters, not your notes.
                </p>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => closeCreateDialog(false)}
                  className="rounded-sm"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Revoke confirmation ── */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent data-testid="revoke-share-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
            <AlertDialogDescription>
              The reader won't be able to open it anymore. Notes they've
              already left will stay in your notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-revoke-btn"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Per-share row, rendered in a list ──────────────────────────────────
function ShareList({ shares, copiedId, onCopy, onRevoke, isInactive = false }) {
  return (
    <div className="space-y-2">
      {shares.map((s) => {
        const expired = s.expires_at && new Date(s.expires_at) <= new Date();
        const status = s.revoked
          ? "Revoked"
          : expired
            ? "Expired"
            : "Active";
        const justCopied = copiedId === s.id;

        return (
          <Card
            key={s.id}
            className={cn(
              "card-hover",
              isInactive && "opacity-60",
            )}
            data-testid={`share-row-${s.id}`}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-sm tracking-tight truncate">
                    {s.title || "Untitled chapter"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-normal",
                        !isInactive && "border-accent/40 text-accent",
                      )}
                    >
                      {status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtDate(s.created_at)}
                    </span>
                  </div>
                </div>

                {!isInactive && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => onRevoke(s)}
                    title="Revoke this link"
                    data-testid={`revoke-share-${s.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Read receipts — quiet, count-only */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {s.reader_count || 0} {s.reader_count === 1 ? "reader" : "readers"}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {s.note_count || 0} {s.note_count === 1 ? "note" : "notes"}
                </span>
              </div>

              {/* Copy link — only when active */}
              {!isInactive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-sm h-7 text-xs"
                  onClick={() => onCopy(s)}
                  data-testid={`copy-share-${s.id}`}
                >
                  {justCopied ? (
                    <>
                      <Check className="h-3 w-3 mr-1.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1.5" />
                      Copy link
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
