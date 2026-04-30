import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Lightbulb
} from "lucide-react";

const NOTE_TYPES = [
  { value: "comment", label: "Comment", icon: MessageSquare, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "todo", label: "To-Do", icon: CheckSquare, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "revision", label: "Revision", icon: AlertCircle, color: "bg-red-500/10 text-red-600 border-red-500/20" },
  { value: "author_intent", label: "Author Intent", icon: Lightbulb, color: "bg-green-500/10 text-green-600 border-green-500/20" },
];

export default function NotesPanel({ parentType, parentId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newNote, setNewNote] = useState({
    note_text: "",
    note_type: "comment",
    location_reference: ""
  });

  useEffect(() => {
    if (parentId) {
      loadNotes();
    }
  }, [parentType, parentId]);

  const loadNotes = async () => {
    if (!parentId) return;
    setLoading(true);
    try {
      const res = await notesApi.getByParent(parentType, parentId);
      // Sort DESCENDING by created_at (newest first) - THADDAEUS rule
      const sortedNotes = [...res.data].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
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
      toast.error("Please enter note text");
      return;
    }

    setCreating(true);
    try {
      await notesApi.create({
        parent_type: parentType,
        parent_id: parentId,
        ...newNote
      });
      toast.success("Note created");
      setCreateDialogOpen(false);
      setNewNote({ note_text: "", note_type: "comment", location_reference: "" });
      loadNotes();
    } catch (error) {
      toast.error("Failed to create note");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!selectedNote || !selectedNote.note_text.trim()) {
      toast.error("Please enter note text");
      return;
    }

    setCreating(true);
    try {
      await notesApi.update(selectedNote.id, {
        note_text: selectedNote.note_text,
        note_type: selectedNote.note_type,
        location_reference: selectedNote.location_reference
      });
      toast.success("Note updated");
      setEditDialogOpen(false);
      setSelectedNote(null);
      loadNotes();
    } catch (error) {
      toast.error("Failed to update note");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    
    try {
      await notesApi.delete(selectedNote.id);
      toast.success("Note deleted");
      setDeleteDialogOpen(false);
      setSelectedNote(null);
      loadNotes();
    } catch (error) {
      toast.error("Failed to delete note");
    }
  };

  const getNoteTypeConfig = (type) => {
    return NOTE_TYPES.find(t => t.value === type) || NOTE_TYPES[0];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!parentId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <StickyNote className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Select a chapter to view notes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="notes-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Notes & Comments</span>
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
          Add Note
        </Button>
      </div>

      {/* Notes List */}
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
            label: "Add first note",
            icon: Plus,
            onClick: () => setCreateDialogOpen(true),
            testId: "empty-notes-add-btn",
          }}
          testId="empty-notes-panel"
        />
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-2 pr-2">
            {notes.map((note) => {
              const typeConfig = getNoteTypeConfig(note.note_type);
              const TypeIcon = typeConfig.icon;
              
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
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {typeConfig.label}
                          </Badge>
                          {note.location_reference && (
                            <span className="text-xs text-muted-foreground truncate">
                              @ {note.location_reference}
                            </span>
                          )}
                        </div>
                        <p className="text-sm line-clamp-3">{note.note_text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(note.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
        </ScrollArea>
      )}

      {/* Create Note Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="create-note-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Note</DialogTitle>
            <DialogDescription>
              Add a note, comment, or reminder for this chapter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="noteType">Note Type</Label>
              <Select
                value={newNote.note_type}
                onValueChange={(value) => setNewNote({ ...newNote, note_type: value })}
              >
                <SelectTrigger className="rounded-sm" data-testid="note-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((type) => (
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
              <Label htmlFor="noteLocation">Location Reference (optional)</Label>
              <Input
                id="noteLocation"
                value={newNote.location_reference}
                onChange={(e) => setNewNote({ ...newNote, location_reference: e.target.value })}
                placeholder="e.g., Paragraph 3, Line 42..."
                className="rounded-sm"
                data-testid="note-location-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noteText">Note</Label>
              <Textarea
                id="noteText"
                value={newNote.note_text}
                onChange={(e) => setNewNote({ ...newNote, note_text: e.target.value })}
                placeholder="Enter your note..."
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
                  Saving...
                </>
              ) : (
                "Add Note"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="edit-note-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Note</DialogTitle>
            <DialogDescription>
              Update your note details.
            </DialogDescription>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editNoteType">Note Type</Label>
                <Select
                  value={selectedNote.note_type}
                  onValueChange={(value) => setSelectedNote({ ...selectedNote, note_type: value })}
                >
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((type) => (
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
                <Label htmlFor="editNoteLocation">Location Reference</Label>
                <Input
                  id="editNoteLocation"
                  value={selectedNote.location_reference || ""}
                  onChange={(e) => setSelectedNote({ ...selectedNote, location_reference: e.target.value })}
                  placeholder="e.g., Paragraph 3, Line 42..."
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNoteText">Note</Label>
                <Textarea
                  id="editNoteText"
                  value={selectedNote.note_text}
                  onChange={(e) => setSelectedNote({ ...selectedNote, note_text: e.target.value })}
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
                  Updating...
                </>
              ) : (
                "Update Note"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-note-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this note. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteNote}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-note-btn"
            >
              Delete Note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
