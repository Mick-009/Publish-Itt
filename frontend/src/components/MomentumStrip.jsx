/**
 * MomentumStrip — daily writing momentum at a glance.
 *
 * Sits at the top of the Dashboard, above "Your Projects". Three cells:
 *   1. Goal arc      → today's words vs. user's daily goal
 *   2. Streak        → current streak with a scaled flame
 *   3. Week sparkline → last 7 days at a glance
 *
 * Data via useStats; refreshes automatically when a session is logged or
 * the goal changes. Goal edits go through the shared DailyGoalDialog.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStats } from "@/hooks/useStats";
import { useAuth } from "@/contexts/AuthContext";
import DailyGoalDialog from "@/components/DailyGoalDialog";
import { cn } from "@/lib/utils";
import {
  Flame,
  BarChart2,
  Pencil,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  if (!seconds) return "0m";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
};

// ── Goal arc — circular progress ───────────────────────────────────────────
function GoalArc({ words, goal, size = 132 }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeGoal = goal || 1;
  const pct = Math.min(words / safeGoal, 1);
  const dash = circumference * pct;
  const reached = words >= safeGoal && safeGoal > 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={reached ? "hsl(142 70% 45%)" : "hsl(var(--accent))"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition:
              "stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-serif font-medium leading-none tracking-tight">
          {words.toLocaleString()}
        </span>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
          of {goal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ── Sparkline for the last 7 days ──────────────────────────────────────────
function WeekSparkline({ data, todayKey }) {
  const max = Math.max(1, ...data.map((d) => d.words || 0));
  return (
    <div className="flex items-end gap-1.5 h-12">
      {data.map((d) => {
        const isToday = d.date === todayKey;
        const h = Math.max(4, Math.round(((d.words || 0) / max) * 44));
        return (
          <div
            key={d.date}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div
              className={cn(
                "w-2.5 rounded-t-sm transition-all duration-300",
                isToday
                  ? "bg-accent"
                  : (d.words || 0) > 0
                    ? "bg-foreground/40 group-hover:bg-foreground/60"
                    : "bg-border",
              )}
              style={{ height: `${h}px` }}
              title={`${d.day}: ${(d.words || 0).toLocaleString()} words`}
            />
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

// ── Skeleton ───────────────────────────────────────────────────────────────
function MomentumSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-sm border border-border overflow-hidden mb-10 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-card p-6 flex items-center gap-5">
          <div className="skeleton w-20 h-20 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MomentumStrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { today, weekly, loading } = useStats({ surfaces: ["today", "weekly"] });
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  if (loading) return <MomentumSkeleton />;
  if (!today) return null; // backend not reachable — hide quietly

  const goal = user?.daily_word_goal ?? today.daily_word_goal ?? 500;
  const words = today.words_today || 0;
  const goalEnabled = goal > 0;
  const goalReached = goalEnabled && words >= goal;
  const remaining = Math.max(0, goal - words);
  const streak = today.current_streak || 0;
  const flameScale = Math.min(1 + streak * 0.04, 1.6); // grows up to 7-day streak

  // Headline copy adapts to state
  let headline;
  if (!goalEnabled) {
    headline = words > 0 ? "Words on the page today" : "Ready when you are";
  } else if (goalReached) {
    headline = "Goal reached. Keep going if you’re flowing.";
  } else if (words === 0) {
    headline = "Today’s page is blank";
  } else {
    headline = `${remaining.toLocaleString()} more to hit today’s goal`;
  }

  const weeklyData = weekly || [];

  return (
    <>
      <section
        className="mb-10 animate-fade-in"
        aria-label="Today's writing momentum"
        data-testid="momentum-strip"
      >
        {/* Headline row */}
        <div className="flex items-end justify-between gap-4 mb-3">
          <h2 className="font-serif text-lg md:text-xl tracking-tight text-foreground/85">
            {headline}
          </h2>
          <button
            type="button"
            onClick={() => setGoalDialogOpen(true)}
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors flex items-center gap-1.5 shrink-0"
            data-testid="edit-goal-btn"
          >
            <Pencil className="h-3 w-3" />
            {goalEnabled ? "Edit goal" : "Set goal"}
          </button>
        </div>

        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-3 gap-px rounded-sm border border-border overflow-hidden bg-border",
            "shadow-[0_1px_0_0_rgba(0,0,0,0.02)]",
          )}
        >
          {/* ── Cell 1: Goal arc ── */}
          <div className="bg-card p-6 flex items-center gap-5 relative overflow-hidden">
            {goalReached && (
              <div className="absolute top-3 right-3">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Sparkles className="h-3 w-3" />
                  Done
                </div>
              </div>
            )}
            {goalEnabled ? (
              <GoalArc words={words} goal={goal} />
            ) : (
              <div className="w-[132px] h-[132px] rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center text-center px-2">
                <span className="text-3xl font-serif font-medium leading-none">
                  {words.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                  words today
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-accent font-semibold mb-1">
                Today
              </p>
              <p className="font-serif text-xl tracking-tight">
                {goalEnabled
                  ? goalReached
                    ? "Goal reached"
                    : `${Math.round((words / goal) * 100)}% of goal`
                  : "Free write"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {today.sessions_today > 0
                  ? `${today.sessions_today} session${today.sessions_today > 1 ? "s" : ""} · ${formatTime(today.time_today_seconds)}`
                  : "No sessions yet"}
              </p>
            </div>
          </div>

          {/* ── Cell 2: Streak ── */}
          <div className="bg-card p-6 flex items-center gap-5">
            <div
              className="shrink-0 w-[72px] h-[72px] rounded-full flex items-center justify-center bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20"
              style={{
                transform:
                  streak > 0 ? `scale(${flameScale * 0.9})` : "scale(0.85)",
                transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <Flame
                className={cn(
                  "transition-colors",
                  streak > 0 ? "text-accent" : "text-muted-foreground/40",
                )}
                style={{
                  width: 32,
                  height: 32,
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-accent font-semibold mb-1">
                Streak
              </p>
              <p className="font-serif text-3xl tracking-tight leading-none">
                {streak}
                <span className="text-base text-muted-foreground ml-2 font-sans font-normal">
                  {streak === 1 ? "day" : "days"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {streak === 0
                  ? "Write today to start a streak"
                  : streak < 3
                    ? "Keep it alive — write today"
                    : streak < 7
                      ? "You’re on a roll"
                      : "A real habit now"}
              </p>
            </div>
          </div>

          {/* ── Cell 3: Week sparkline ── */}
          <div className="bg-card p-6 flex items-center gap-5">
            <div className="shrink-0">
              <WeekSparkline data={weeklyData} todayKey={today.date} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Last 7 days
              </p>
              <p className="font-serif text-xl tracking-tight">
                {weeklyData
                  .reduce((s, d) => s + (d.words || 0), 0)
                  .toLocaleString()}
                <span className="text-sm text-muted-foreground ml-2 font-sans">
                  words
                </span>
              </p>
              <button
                type="button"
                onClick={() => navigate("/stats")}
                className="text-xs text-accent hover:underline mt-1.5 flex items-center gap-1 group"
                data-testid="view-full-stats-btn"
              >
                <BarChart2 className="h-3 w-3" />
                Full stats
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <DailyGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        currentGoal={goal}
      />
    </>
  );
}
