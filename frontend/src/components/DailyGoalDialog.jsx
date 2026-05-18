/**
 * DailyGoalDialog — shared modal for editing the user's daily word goal.
 *
 * The dashboard's MomentumStrip and the workspace's WritingStatsPanel both
 * surface a goal edit. Previously they had two completely separate dialog
 * implementations and two different goal-persistence systems (the panel's
 * was localStorage-only, the strip's hit the backend). That divergence was
 * a contributing reason the stats UI behaved inconsistently.
 *
 * Source of truth is `user.daily_word_goal` on the auth context. Persisting
 * goes through `userApi.updatePreferences`, then `updateUser` for an
 * optimistic merge into the auth state so callers see the new value on the
 * next render without a refetch.
 *
 * On a successful save, fires `STATS_CHANGED_EVENT` so any mounted useStats
 * hook refetches and the goal arc / progress bar updates immediately.
 */
import { useState, useEffect } from "react";
import { userApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { STATS_CHANGED_EVENT } from "@/hooks/useStats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";

// Familiar preset chips. Hemingway aimed for ~500/day, King writes ~2000/day —
// these defaults give a writer something to anchor against without being
// prescriptive about it.
const PRESET_GOALS = [250, 500, 1000, 2000];

export default function DailyGoalDialog({
  open,
  onOpenChange,
  currentGoal,
  onSaved,
}) {
  const { updateUser } = useAuth();
  const [value, setValue] = useState(currentGoal || 500);
  const [saving, setSaving] = useState(false);

  // Reset the form value each time the dialog re-opens. Otherwise editing,
  // closing, and reopening would persist the abandoned value.
  useEffect(() => {
    if (open) setValue(currentGoal || 500);
  }, [open, currentGoal]);

  const save = async (newGoal) => {
    if (newGoal == null || isNaN(newGoal) || newGoal < 0 || newGoal > 100_000) {
      toast.error("Pick a number between 0 and 100,000.");
      return;
    }

    setSaving(true);
    try {
      const res = await userApi.updatePreferences({ daily_word_goal: newGoal });
      // Merge into auth state so the UI reads the new goal immediately.
      updateUser({ daily_word_goal: res.data.daily_word_goal });
      // Tell every mounted useStats to refetch — the goal arc on the
      // momentum strip needs to recompute against the new target.
      window.dispatchEvent(new CustomEvent(STATS_CHANGED_EVENT));

      toast.success(
        newGoal === 0
          ? "Daily goal turned off."
          : `Daily goal set to ${newGoal.toLocaleString()} words.`,
      );
      onSaved?.(res.data.daily_word_goal);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't update the goal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Daily writing goal
          </DialogTitle>
          <DialogDescription>
            A target you can quietly aim for. Set it to 0 to turn it off.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {PRESET_GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setValue(g)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-sm border transition-colors",
                  value === g
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border hover:border-accent/50 hover:bg-accent/5",
                )}
              >
                {g.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="space-y-2">
            <Label
              htmlFor="daily-goal-input"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Or set a custom amount
            </Label>
            <div className="relative">
              <Input
                id="daily-goal-input"
                type="number"
                min={0}
                max={100_000}
                step={50}
                value={value}
                onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
                className="pr-16"
                data-testid="daily-goal-input"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                words
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Stephen King writes ~2,000 words a day. Hemingway aimed for 500.
            Whatever feels sustainable is the right number.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => save(value)}
            disabled={saving}
            className="rounded-sm"
            data-testid="save-daily-goal-btn"
          >
            {saving ? "Saving." : "Save goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
