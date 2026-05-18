/**
 * WritingStatsPanel — compact stats inside the workspace's right-side tab.
 *
 * Previously this component was a tangle: it kept its own localStorage goal
 * system that was unaware of `user.daily_word_goal`, computed "today's words"
 * from the last item in the weekly array (wrong), had a duplicated momentum
 * card that called a separate AI endpoint, and shipped a daily-reset
 * notification that nobody asked for.
 *
 * Now it's a thin presentation layer over useStats. Source of truth is the
 * auth context's `user.daily_word_goal`. Goal edits use the shared
 * DailyGoalDialog. Aesthetic matches the rest of the app — quiet cards, no
 * orange/blue gradients.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useStats } from "@/hooks/useStats";
import { useAuth } from "@/contexts/AuthContext";
import DailyGoalDialog from "@/components/DailyGoalDialog";
import { cn } from "@/lib/utils";
import {
  Flame,
  Clock,
  FileText,
  TrendingUp,
  Calendar,
  Target,
  Loader2,
  BarChart3,
  Pencil,
  Sparkles,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────
const fmtTime = (seconds) => {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ── Sparkline (compact 7-day) ────────────────────────────────────────────
function WeekBars({ data, todayKey }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.words || 0));

  return (
    <div className="flex items-end justify-between gap-1 h-16">
      {data.map((d) => {
        const isToday = d.date === todayKey;
        const h = max > 0 ? (d.words / max) * 100 : 0;
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-1"
            data-testid={`weekly-bar-${d.day}`}
          >
            <div className="w-full flex flex-col items-end justify-end h-12">
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all",
                  isToday
                    ? "bg-accent"
                    : d.words > 0
                      ? "bg-foreground/30"
                      : "bg-border",
                )}
                style={{ height: `${Math.max(h, 4)}%` }}
                title={`${d.day}: ${(d.words || 0).toLocaleString()} words`}
              />
            </div>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider",
                isToday ? "text-accent font-semibold" : "text-muted-foreground",
              )}
            >
              {d.day[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────
export default function WritingStatsPanel({ className }) {
  const { user } = useAuth();
  const { today, weekly, overview, loading } = useStats({
    surfaces: ["today", "weekly", "overview"],
  });
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-32", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Graceful degradation — backend unreachable. The stats panel hiding
  // shouldn't break the workspace.
  if (!today) {
    return (
      <div
        className={cn("p-3 text-sm text-muted-foreground italic", className)}
        data-testid="writing-stats-panel-empty"
      >
        Couldn't load stats just now.
      </div>
    );
  }

  const goal = user?.daily_word_goal ?? today.daily_word_goal ?? 500;
  const goalEnabled = goal > 0;
  const wordsToday = today.words_today || 0;
  const goalReached = goalEnabled && wordsToday >= goal;
  const progressPct = goalEnabled ? Math.min((wordsToday / goal) * 100, 100) : 0;
  const streak = today.current_streak || 0;
  const weeklyData = weekly || [];

  return (
    <div
      className={cn("space-y-3", className)}
      data-testid="writing-stats-panel"
    >
      {/* ── Today: words + streak side-by-side ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Today
              </span>
            </div>
            <p
              className="font-serif text-2xl tracking-tight leading-none"
              data-testid="today-words"
            >
              {wordsToday.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {today.sessions_today > 0
                ? `${today.sessions_today} session${today.sessions_today > 1 ? "s" : ""}`
                : "No sessions yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Flame
                className={cn(
                  "h-3.5 w-3.5",
                  streak > 0 ? "text-accent" : "text-muted-foreground",
                )}
              />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Streak
              </span>
            </div>
            <p
              className="font-serif text-2xl tracking-tight leading-none"
              data-testid="streak-count"
            >
              {streak}
              <span className="text-xs text-muted-foreground ml-1.5 font-sans font-normal">
                {streak === 1 ? "day" : "days"}
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {streak === 0
                ? "Write today to start"
                : streak < 3
                  ? "Keep it alive"
                  : "Good rhythm"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Daily goal progress ── */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                {goalEnabled ? "Daily goal" : "Goal off"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {goalEnabled && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {wordsToday.toLocaleString()} / {goal.toLocaleString()}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setGoalDialogOpen(true)}
                data-testid="edit-goal-btn"
                aria-label="Edit daily goal"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
          {goalEnabled ? (
            <>
              <Progress
                value={progressPct}
                className="h-1.5"
                data-testid="daily-progress"
              />
              {goalReached && (
                <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-3 w-3" />
                  Goal reached.
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Set a daily target to track progress here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── This week ── */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            This week
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <WeekBars data={weeklyData} todayKey={today.date} />
        </CardContent>
      </Card>

      {/* ── Lifetime totals (only when there's something to show) ── */}
      {overview && overview.total_sessions > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/40">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p
                className="font-medium tabular-nums truncate"
                data-testid="total-words"
              >
                {(overview.total_words_written || 0).toLocaleString()}
              </p>
              <p className="text-muted-foreground text-[10px]">Total words</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/40">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p
                className="font-medium tabular-nums truncate"
                data-testid="total-time"
              >
                {fmtTime(overview.total_time_seconds || 0)}
              </p>
              <p className="text-muted-foreground text-[10px]">At the desk</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/40">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p
                className="font-medium tabular-nums truncate"
                data-testid="avg-words"
              >
                {Math.round(overview.average_words_per_day || 0).toLocaleString()}
              </p>
              <p className="text-muted-foreground text-[10px]">Avg / day</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-sm bg-muted/40">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p
                className="font-medium tabular-nums truncate"
                data-testid="days-active"
              >
                {overview.days_active || 0}
              </p>
              <p className="text-muted-foreground text-[10px]">Active days</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Best streak badge ── */}
      {overview?.longest_streak > 0 && (
        <div className="flex items-center justify-center pt-1">
          <Badge
            variant="outline"
            className="text-[10px] gap-1 font-normal"
            data-testid="longest-streak-badge"
          >
            <Flame className="h-3 w-3 text-accent" />
            Best streak: {overview.longest_streak}{" "}
            {overview.longest_streak === 1 ? "day" : "days"}
          </Badge>
        </div>
      )}

      <DailyGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        currentGoal={goal}
      />
    </div>
  );
}
