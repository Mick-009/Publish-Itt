/**
 * WritingStats — full-page writing statistics dashboard.
 * Route: /stats. Linked from the dashboard's MomentumStrip ("Full stats").
 *
 * Pulls three endpoints once on mount:
 *   GET /api/stats/overview  — totals + averages
 *   GET /api/stats/weekly    — last 7 days, oldest-first
 *   GET /api/stats/streak    — current + longest + last writing date
 *
 * Auth attaches via the shared api.js axios instance (Bearer interceptor).
 */

import { useState, useEffect, useRef } from "react";
import { statsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { QuillMarkArt } from "@/components/EmptyStateArt";
import { cn } from "@/lib/utils";
import {
  Flame,
  Clock,
  FileText,
  TrendingUp,
  Calendar,
  Sparkles,
} from "lucide-react";

// ── Formatters ────────────────────────────────────────────────────────────
const fmtTime = (seconds) => {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtNum = (n) => {
  if (n === undefined || n === null) return "0";
  return Number(n).toLocaleString();
};

// ── KPI tile ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, delay = 0 }) {
  return (
    <Card
      className="card-hover relative overflow-hidden animate-slide-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-5 pb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-accent" />}
          {label}
        </div>
        <div className="font-serif text-3xl tracking-tight leading-none text-foreground">
          {value}
        </div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-2">{sub}</div>
        )}
      </CardContent>
      {/* Accent bar across the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent/60" />
    </Card>
  );
}

// ── Weekly bar chart ──────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.words || 0), 1);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-end justify-between gap-2 h-44">
          {data.map((d, i) => {
            const pct = ((d.words || 0) / max) * 100;
            const isToday = i === data.length - 1;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center h-full"
              >
                {/* Word count label */}
                <div className="h-4 mb-1 text-[10px] text-muted-foreground/80 tabular-nums">
                  {d.words > 0 ? fmtNum(d.words) : ""}
                </div>
                {/* Bar */}
                <div className="flex-1 w-full flex items-end justify-center">
                  <div
                    className={cn(
                      "w-[70%] max-w-[36px] rounded-t-sm animate-grow-up",
                      isToday
                        ? "bg-accent"
                        : (d.words || 0) > 0
                          ? "bg-foreground/40 hover:bg-foreground/60"
                          : "bg-border",
                    )}
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      animationDelay: `${i * 60}ms`,
                      transition: "background-color 0.2s ease",
                    }}
                    title={`${d.day}: ${fmtNum(d.words || 0)} words`}
                  />
                </div>
                {/* Day label */}
                <div
                  className={cn(
                    "text-[11px] mt-2 font-medium uppercase tracking-wider",
                    isToday
                      ? "text-accent"
                      : "text-muted-foreground",
                  )}
                >
                  {d.day}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Streak flame stack — N flame icons, growing in size/opacity ──────────
function StreakFlames({ streak }) {
  const flames = Math.min(streak, 14);
  return (
    <div className="flex items-end gap-1 flex-wrap">
      {Array.from({ length: flames }).map((_, i) => {
        const opacity = 0.45 + (i / Math.max(flames - 1, 1)) * 0.55;
        const size = 16 + Math.min(i, 6); // grow up to 22px for 7+ streak
        return (
          <Flame
            key={i}
            className="text-accent"
            style={{
              opacity,
              width: size,
              height: size,
              animationDelay: `${i * 70}ms`,
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

// ── Streak summary card ───────────────────────────────────────────────────
function StreakCard({ streak }) {
  const has = streak.current_streak > 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mb-5">
          <div className="flex flex-col">
            <span className="font-serif text-4xl font-medium tracking-tight leading-none text-foreground">
              {streak.current_streak}
            </span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1.5">
              Current
            </span>
          </div>

          <div className="h-12 w-px bg-border shrink-0" />

          <div className="flex flex-col">
            <span className="font-serif text-4xl font-medium tracking-tight leading-none text-foreground">
              {streak.longest_streak}
            </span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1.5">
              Longest
            </span>
          </div>

          {streak.last_writing_date && (
            <>
              <div className="h-12 w-px bg-border shrink-0" />
              <div className="flex flex-col">
                <span className="font-serif text-base text-foreground">
                  {streak.last_writing_date}
                </span>
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1.5">
                  Last session
                </span>
              </div>
            </>
          )}
        </div>

        {has ? (
          <StreakFlames streak={streak.current_streak} />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Write today to start a streak.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section heading (used for chart + streak sections) ───────────────────
function SectionHeading({ children }) {
  return (
    <h2 className="font-serif text-lg md:text-xl tracking-tight text-foreground/85 mb-4">
      {children}
    </h2>
  );
}

// ── KPI grid skeleton ─────────────────────────────────────────────────────
function KpiSkeletons() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-5 pb-6 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function WritingStats() {
  const [overview, setOverview] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function load() {
      try {
        const [ovRes, wkRes, stRes] = await Promise.all([
          statsApi.getOverview(),
          statsApi.getWeekly(),
          statsApi.getStreak(),
        ]);
        if (cancelled || !mountedRef.current) return;
        setOverview(ovRes.data);
        setWeekly(Array.isArray(wkRes.data) ? wkRes.data : []);
        setStreak(stRes.data);
      } catch (e) {
        if (!cancelled && mountedRef.current) {
          setError(e?.message || "Couldn't load stats");
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  // While loading, the page chrome renders immediately and per-section
  // skeletons fill in. Empty state only counts once data has actually landed.
  const isEmpty =
    !loading && !error && overview && (overview.total_sessions || 0) === 0;

  return (
    <div
      className="p-8 lg:p-12 max-w-5xl mx-auto animate-fade-in"
      data-testid="writing-stats-page"
    >
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-accent mb-1">
            Writing stats
          </p>
          <h1 className="text-4xl md:text-5xl font-serif font-semibold tracking-tight">
            Your work, by the numbers.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Totals, streaks, and the rhythm of your week.
          </p>
        </div>
        {streak?.current_streak > 0 && (
          <div
            className="flex items-center gap-2.5 rounded-sm border border-accent/30 bg-accent/5 px-4 py-2.5 shrink-0"
            data-testid="header-streak-badge"
          >
            <Flame className="h-5 w-5 text-accent" />
            <div className="flex flex-col leading-tight">
              <span className="font-serif text-2xl font-medium text-foreground">
                {streak.current_streak}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                day streak
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 mb-8" data-testid="stats-error">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Couldn't pull stats just now.
              </p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <EmptyState
          size="page"
          art={<QuillMarkArt size={96} />}
          eyebrow="The ledger is blank"
          title="Nothing logged yet."
          body="Start a writing session and your numbers will show up here — words on the page, time at the desk, days in a row."
          testId="empty-writing-stats"
        />
      )}

      {/* ── KPI grid ── */}
      {!isEmpty && !error && (
        <section className="mb-10" aria-label="Headline stats">
          {loading ? (
            <KpiSkeletons />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total words"
                value={fmtNum(overview?.total_words_written)}
                sub="across all projects"
                icon={FileText}
                delay={0}
              />
              <StatCard
                label="Sessions"
                value={fmtNum(overview?.total_sessions)}
                sub={`${overview?.days_active ?? 0} active days`}
                icon={Calendar}
                delay={80}
              />
              <StatCard
                label="Time at the desk"
                value={fmtTime(overview?.total_time_seconds)}
                sub="total logged time"
                icon={Clock}
                delay={160}
              />
              <StatCard
                label="Avg / day"
                value={fmtNum(overview?.average_words_per_day)}
                sub={`${overview?.average_session_minutes ?? 0}m avg session`}
                icon={TrendingUp}
                delay={240}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Weekly bar chart ── */}
      {!isEmpty && !error && (
        <section className="mb-10" aria-label="Last seven days">
          <SectionHeading>Last seven days</SectionHeading>
          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : weekly.length > 0 ? (
            <BarChart data={weekly} />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No data for this week yet.
            </p>
          )}
        </section>
      )}

      {/* ── Streak ── */}
      {!isEmpty && !error && streak && !loading && (
        <section aria-label="Writing streak">
          <SectionHeading>Streak</SectionHeading>
          <StreakCard streak={streak} />
        </section>
      )}
    </div>
  );
}
