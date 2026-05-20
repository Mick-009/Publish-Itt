import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { notesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { PinnedNoteArt } from "@/components/EmptyStateArt";
import {
  Plus,
  StickyNote,
  Trash2,
  Loader2,
  Pencil,
  Clock,
  MessageSquare,
  CheckSquare,
  AlertCircle,
  Lightbulb,
  Send,
  Sparkles,
} from "lucide-react";

// ── Note types ────────────────────────────────────────────────────────────
//
// Two groups: author-created notes (comment / todo / revision / intent) and
// reader_feedback. Only the first four show up in the create-note dialog's
// type selector — readers can't be created by the author from inside the app,
// they arrive via the public share endpoint.
const NOTE_TYPES = [
  {
    value: "comment",
    label: "Comment",
    icon: MessageSquare,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    authorCreatable: true,
  },
  {
    value: "todo",
    label: "To-do",
    icon: CheckSquare,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    authorCreatable: true,
  },
  {
    value: "revision",
    label: "Revision",
    icon: AlertCircle,
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    authorCreatable: true,
  },
  {
    value: "author_intent",
    label: "Intent",
    icon: Lightbulb,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    authorCreatable: true,
  },
  {
    value: "reader_feedback",
    label: "Reader",
    // Send icon matches the "Send to a reader" verb in SharesPanel — visually
    // anchoring the loop: send out → notes come back.
    icon: Send,
    // Accent-tone treatment, distinct from the four author colors. Keeps
    // reader voice visually apart without competing for attention.
    color: "bg-accent/10 text-accent border-accent/30",
    authorCreatable: false,
  },
];

// ── Filter options for the chip row ──────────────────────────────────────
// Just three: everything, author's own notes, reader notes. Anything more
// granular (filter by type, by share, by reader) is v2.
const FILTERS = [
  { value: "all", label: "All" },
  { value: "yours", label: "Your notes" },
  { value: "readers", label: "From readers" },
];

export default function NotesPanel({ parentType, parentId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("all");
  const [newNote, setNewNote] = useState({
    note_text: "",
    note_type: "comment",
    location_reference: "",
  });

  useEffect(() => {
    if (parentId) {
      loadNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentType, parentId]);

  const loadNotes = async () => {
    if (!parentId) return;
    setLoading(true);
    try {
      const res = await notesApi.getByParent(parentType, parentId);
      // Newest first.
      const sortedNotes = [...res.data].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      setNotes(sortedNotes);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNote.note_text.trim()) {
      toast.error("Add some text first.");
      return;
    }

    setCreating(true);
    try {
      await notesApi.create({
        parent_type: parentType,
        parent_id: parentId,
        ...newNote,
      });
      toast.success("Pinned.");
      setCreateDialogOpen(false);
      setNewNote({
        note_text: "",
        note_type: "comment",
        location_reference: "",
      });
      loadNotes();
    } catch (error) {
      toast.error("Couldn't pin it. Try again?");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!selectedNote || !selectedNote.note_text.trim()) {
      toast.error("Add some text first.");
      return;
    }

    setCreating(true);
    try {
      await notesApi.update(selectedNote.id, {
        note_text: selectedNote.note_text,
        note_type: selectedNote.note_type,
        location_reference: selectedNote.location_reference,
      });
      toast.success("Updated.");
      setEditDialogOpen(false);
      setSelectedNote(null);
      loadNotes();
    } catch (error) {
      toast.error("Couldn't update. Try again?");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;

    try {
      await notesApi.delete(selectedNote.id);
      toast.success("Removed.");
      setDeleteDialogOpen(false);
      setSelectedNote(null);
      loadNotes();
    } catch (error) {
      toast.error("Couldn't remove it. Try again?");
    }
  };

  const getNoteTypeConfig = (type) => {
    return NOTE_TYPES.find((t) => t.value === type) || NOTE_TYPES[0];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Derived state ─────────────────────────────────────────────────────
  //
  // Filter the visible notes based on the chip selection. Reader-feedback
  // notes are the only ones with a `reader_name` field set, so that's the
  // cheapest correct distinguisher between the two cohorts.
  const visibleNotes = useMemo(() => {
    if (filter === "yours") {
      return notes.filter((n) => n.note_type !== "reader_feedback");
    }
    if (filter === "readers") {
      return notes.filter((n) => n.note_type === "reader_feedback");
    }
    return notes;
  }, [notes, filter]);

  // Count reader notes so we can render the chip count and the empty-state
  // copy intelligently.
  const readerNoteCount = useMemo(
    () => notes.filter((n) => n.note_type === "reader_feedback").length,
    [notes],
  );

  if (!parentId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <StickyNote className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Open a chapter to see its notes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="notes-panel">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Notes</span>
          <Badge variant="secondary" className="text-xs">
            {notes.length}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
          className="rounded-sm h-8"
          data-testid="create-note-btn"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Pin a note
        </Button>
      </div>

      {/* ── Filter chips ── */}
      {/* Only show the chips when there's at least one reader note — until
          then they're just visual noise. The "yours" / "readers" split only
          becomes useful once the reader cohort exists. */}
      {readerNoteCount > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="notes-filter">
          {FILTERS.map((f) => {
            const isActive = filter === f.value;
            // Per-chip counts so the writer can see at a glance how many of
            // each cohort exist.
            const count =
              f.value === "all"
                ? notes.length
                : f.value === "yours"
                  ? notes.length - readerNoteCount
                  : readerNoteCount;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] border transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border hover:border-accent/50 hover:bg-accent/5 text-muted-foreground",
                )}
                data-testid={`notes-filter-${f.value}`}
              >
                {f.label}
                <span
                  className={cn(
                    "ml-1.5 text-[10px]",
                    isActive ? "opacity-80" : "opacity-60",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Notes list ── */}
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          size="panel"
          art={<PinnedNoteArt size={72} />}
          title="A clean corkboard."
          body="Pin reminders, questions, and revision flags to this chapter as you go."
          primaryAction={{
            label: "Pin a note",
            icon: Plus,
            onClick: () => setCreateDialogOpen(true),
            testId: "empty-notes-add-btn",
          }}
          testId="empty-notes-panel"
        />
      ) : visibleNotes.length === 0 ? (
        // Filter is active and matched nothing. Brief, doesn't reach for the
        // full empty-state art treatment — that would be overwrought.
        <div className="text-sm text-muted-foreground italic px-1 py-4">
          {filter === "yours"
            ? "No notes from you yet — every note here is from a reader."
            : "No reader notes yet — when someone leaves one through a share, it'll land here."}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleNotes.map((note) => {
            const typeConfig = getNoteTypeConfig(note.note_type);
            const TypeIcon = typeConfig.icon;
            const isReader = note.note_type === "reader_feedback";

            return (
              <Card
                key={note.id}
                className={cn("card-hover", typeConfig.color)}
                data-testid={`note-item-${note.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <TypeIcon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {/* For reader notes, the badge holds the reader's
                            name. For author notes, the type label. Either
                            way the badge anchors who wrote it. */}
                        <Badge variant="outline" className="text-xs">
                          {isReader && note.reader_name
                            ? note.reader_name
                            : typeConfig.label}
                        </Badge>

                        {/* Reader notes can also be a "general impression" —
                            the writer's "how did it land?" textarea at the
                            end of the share. Mark those distinctly so the
                            author knows it's the closing reaction, not an
                            inline highlight. */}
                        {isReader && note.is_general_impression && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 font-normal border-accent/30 text-accent"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            Impression
                          </Badge>
                        )}

                        {note.location_reference && (
                          <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                            {isReader ? "“" : "@ "}
                            {note.location_reference}
                            {isReader ? "”" : ""}
                          </span>
                        )}
                      </div>

                      <p className="text-sm line-clamp-3 break-words">
                        {note.note_text}
                      </p>

                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                    </div>

                    {/* Action buttons. Reader notes get only the delete —
                        the edit pencil is suppressed because it's the
                        reader's voice and editing it would distort what
                        they actually said. Author still owns their
                        workspace, so they can remove. */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isReader && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setSelectedNote({ ...note });
                            setEditDialogOpen(true);
                          }}
                          data-testid={`edit-note-${note.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setSelectedNote(note);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`delete-note-${note.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create Note Dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="create-note-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">Pin a note</DialogTitle>
            <DialogDescription>
              Pin a reminder or question to this chapter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="noteType">Type</Label>
              <Select
                value={newNote.note_type}
                onValueChange={(value) =>
                  setNewNote({ ...newNote, note_type: value })
                }
              >
                <SelectTrigger
                  className="rounded-sm"
                  data-testid="note-type-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Only show author-creatable types here. reader_feedback
                      is intentionally excluded — those only arrive via the
                      public share endpoint, never through this dialog. */}
                  {NOTE_TYPES.filter((t) => t.authorCreatable).map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noteLocation">Where it points (optional)</Label>
              <Input
                id="noteLocation"
                value={newNote.location_reference}
                onChange={(e) =>
                  setNewNote({
                    ...newNote,
                    location_reference: e.target.value,
                  })
                }
                placeholder="e.g. paragraph 3, line 42"
                className="rounded-sm"
                data-testid="note-location-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noteText">Note</Label>
              <Textarea
                id="noteText"
                value={newNote.note_text}
                onChange={(e) =>
                  setNewNote({ ...newNote, note_text: e.target.value })
                }
                placeholder="Write the note..."
                className="rounded-sm resize-none"
                rows={4}
                data-testid="note-text-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={creating}
              className="rounded-sm"
              data-testid="save-note-submit"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving.
                </>
              ) : (
                "Pin it"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Note Dialog ── */}
      {/* Edit only fires for author-creatable notes — the pencil is hidden
          on reader_feedback rows. So we don't need a type filter here. */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="edit-note-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit note</DialogTitle>
            <DialogDescription>Change the note.</DialogDescription>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editNoteType">Type</Label>
                <Select
                  value={selectedNote.note_type}
                  onValueChange={(value) =>
                    setSelectedNote({ ...selectedNote, note_type: value })
                  }
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.filter((t) => t.authorCreatable).map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNoteLocation">Where it points</Label>
                <Input
                  id="editNoteLocation"
                  value={selectedNote.location_reference || ""}
                  onChange={(e) =>
                    setSelectedNote({
                      ...selectedNote,
                      location_reference: e.target.value,
                    })
                  }
                  placeholder="e.g. paragraph 3, line 42"
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNoteText">Note</Label>
                <Textarea
                  id="editNoteText"
                  value={selectedNote.note_text}
                  onChange={(e) =>
                    setSelectedNote({
                      ...selectedNote,
                      note_text: e.target.value,
                    })
                  }
                  className="rounded-sm resize-none"
                  rows={4}
                  data-testid="edit-note-text-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateNote}
              disabled={creating}
              className="rounded-sm"
              data-testid="update-note-submit"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating.
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-note-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this note?</AlertDialogTitle>
            <AlertDialogDescription>
              Gone for good — can't undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-note-btn"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
