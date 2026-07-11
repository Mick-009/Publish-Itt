import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chapterApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Chapter picker for canvas-side Thad actions.
 * Fetches chapters on open, lets the writer pick one, confirms with "Read it".
 *
 * Props:
 *   open        — boolean controlling visibility
 *   projectId   — the project whose chapters to list
 *   onConfirm   — called with the full chapter object when confirmed
 *   onClose     — called when dismissed without confirming
 */
export default function ChapterPickerModal({ open, projectId, onConfirm, onClose }) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!open || !projectId) return;
    setSelectedId(null);
    setChapters([]);
    setLoading(true);
    chapterApi
      .getByProject(projectId)
      .then((res) => setChapters(res.data ?? []))
      .catch(() => toast.error("Couldn't load chapters. Try again?"))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const handleConfirm = () => {
    const chapter = chapters.find((c) => c.id === selectedId);
    if (chapter) onConfirm(chapter);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Which chapter should Thad read?
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6">Loading chapters.</p>
        ) : chapters.length === 0 ? (
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              No chapters yet. Write something first.
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-72 -mx-1">
              <div className="space-y-0.5 px-1">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedId(ch.id)}
                    className={cn(
                      "w-full text-left rounded-sm px-3 py-2.5 text-sm transition-colors",
                      selectedId === ch.id
                        ? "bg-accent/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {ch.title || "Untitled chapter"}
                  </button>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={!selectedId}>
                Read it
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
