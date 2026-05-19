/**
 * ReaderNameDialog — first-visit name capture for a shared chapter.
 *
 * Shown when a reader opens a share link for the first time (no name in
 * cookies for this share). The name persists in a cookie scoped to the
 * share so subsequent visits skip the dialog.
 *
 * Voice: editorial, not transactional. We don't say "Enter your name to
 * continue" — we say "Before you start reading." The reader is a guest
 * the author invited, not a user signing up.
 *
 * The author's display name is passed in so the dialog can address the
 * reader on the author's behalf rather than feeling like a generic form.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";

export default function ReaderNameDialog({
  open,
  onOpenChange,
  authorDisplayName,
  chapterTitle,
  onConfirm,
}) {
  const [name, setName] = useState("");

  // Reset the input each time the dialog opens, so reopening after a stale
  // close doesn't show an unrelated typed value.
  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const trimmed = name.trim();
  const tooShort = trimmed.length < 2;
  const tooLong = trimmed.length > 80;
  const invalid = tooShort || tooLong;

  const submit = () => {
    if (invalid) return;
    onConfirm(trimmed);
  };

  return (
    // The reader CAN close the dialog without setting a name — they'll just
    // land on the share page in "set your name to leave notes" mode. We
    // intentionally don't try to force the dialog open: forcing it depends
    // on shadcn dialog internals (close button visibility, escape-key
    // handlers) that vary between versions of the component.
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            Before you start reading
          </DialogTitle>
          <DialogDescription>
            {authorDisplayName ? (
              <>
                <span className="font-medium text-foreground">
                  {authorDisplayName}
                </span>{" "}
                sent you{" "}
                <span className="italic">{chapterTitle || "a chapter"}</span>.
                What should they call you when your notes come back?
              </>
            ) : (
              <>
                You're reading{" "}
                <span className="italic">{chapterTitle || "a chapter"}</span>.
                What name should sit on the notes you leave?
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2">
          <Label
            htmlFor="reader-name-input"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Your name
          </Label>
          <Input
            id="reader-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !invalid) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="First name is fine"
            autoFocus
            maxLength={80}
            className="rounded-sm"
            data-testid="reader-name-input"
          />
          <p className="text-xs text-muted-foreground italic">
            Just so the author knows who left which note. No account, no
            email — your name stays with the share.
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={submit}
            disabled={invalid}
            className="rounded-sm w-full sm:w-auto"
            data-testid="confirm-reader-name-btn"
          >
            Start reading
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
