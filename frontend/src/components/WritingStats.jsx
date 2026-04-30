/**
 * WritingStats.jsx — Publish Itt Writing Statistics Dashboard
 * Place at: frontend/src/components/WritingStats.jsx
 *
 * Fetches:  GET /api/stats/overview  |  /api/stats/weekly  |  /api/stats/streak
 * Auth:     Uses the app's existing axios instance — Authorization header is
 *           already set globally by AuthContext's interceptor.
 */

import { useState, useEffect, useRef } from "react";
import axios from "axios";

// Uses the same base URL env var as the rest of the app.
// The axios interceptor in AuthContext already attaches Bearer <token>.
const API_BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

async function apiFetch(path) {
  const res = await axios.get(`${API_BASE}${path}`);
  return res.data;
}

// ── Utility ───────────────────────────────────────────────────────────────────
function fmtTime(seconds) {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function fmtNum(n) {
  if (n === undefined || n === null) return "0";
  return Number(n).toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, delay = 0 }) {
  return (
    <div
      className="stat-card"
      style={{ "--accent": accent, animationDelay: `${delay}ms` }}
    >
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className="stat-card-bar" />
    </div>
  );
}

function BarChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.words), 1);

  return (
    <div className="bar-chart">
      {data.map((d, i) => {
        const pct = (d.words / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={d.date} className="bar-col">
            <div className="bar-label-top">
              {d.words > 0 ? fmtNum(d.words) : ""}
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${isToday ? "bar-today" : ""}`}
                style={{ height: `${pct}%`, animationDelay: `${i * 60}ms` }}
              />
            </div>
            <div className={`bar-day ${isToday ? "bar-day-today" : ""}`}>
              {d.day}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StreakFlame({ streak }) {
  // Render n flame segments for the streak
  const flames = Math.min(streak, 14);
  return (
    <div className="streak-flames">
      {Array.from({ length: flames }).map((_, i) => (
        <span
          key={i}
          className="flame"
          style={{ animationDelay: `${i * 80}ms`, opacity: 0.4 + (i / flames) * 0.6 }}
        >
          🔥
        </span>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return <div className="stat-card skeleton-card" />;
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">✍️</div>
      <h3>No sessions logged yet</h3>
      <p>
        Start writing — sessions are logged automatically as you edit chapters.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function WritingStats() {
  const [overview, setOverview] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const [ov, wk, st] = await Promise.all([
          apiFetch("/api/stats/overview"),
          apiFetch("/api/stats/weekly"),
          apiFetch("/api/stats/streak"),
        ]);
        if (!mountedRef.current) return;
        setOverview(ov);
        setWeekly(wk);
        setStreak(st);
      } catch (e) {
        if (mountedRef.current) setError(e.message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, []);

  const isEmpty =
    !loading && !error && overview && overview.total_sessions === 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="stats-root">
        {/* ── Header ── */}
        <header className="stats-header">
          <div className="stats-header-inner">
            <div>
              <h1 className="stats-title">Writing Stats</h1>
              <p className="stats-subtitle">Your creative output at a glance</p>
            </div>
            {streak && streak.current_streak > 0 && (
              <div className="streak-badge">
                <span className="streak-number">{streak.current_streak}</span>
                <span className="streak-unit">day streak</span>
              </div>
            )}
          </div>
        </header>

        {/* ── Error ── */}
        {error && (
          <div className="error-banner">
            ⚠ Could not load stats: {error}
          </div>
        )}

        {/* ── Empty ── */}
        {isEmpty && <EmptyState />}

        {/* ── KPI Grid ── */}
        {!isEmpty && (
          <section className="kpi-grid">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <StatCard
                  label="Total Words Written"
                  value={fmtNum(overview?.total_words_written)}
                  sub="across all projects"
                  accent="#c8b06e"
                  delay={0}
                />
                <StatCard
                  label="Writing Sessions"
                  value={fmtNum(overview?.total_sessions)}
                  sub={`${overview?.days_active ?? 0} active days`}
                  accent="#8eb8a0"
                  delay={80}
                />
                <StatCard
                  label="Time at the Desk"
                  value={fmtTime(overview?.total_time_seconds)}
                  sub="total logged time"
                  accent="#a89bc0"
                  delay={160}
                />
                <StatCard
                  label="Avg Words / Day"
                  value={fmtNum(overview?.average_words_per_day)}
                  sub={`${overview?.average_session_minutes ?? 0}m avg session`}
                  accent="#c07878"
                  delay={240}
                />
              </>
            )}
          </section>
        )}

        {/* ── Weekly Bar Chart ── */}
        {!isEmpty && (
          <section className="chart-section">
            <h2 className="section-title">Last 7 Days</h2>
            {loading ? (
              <div className="chart-skeleton" />
            ) : weekly.length > 0 ? (
              <BarChart data={weekly} />
            ) : (
              <p className="no-data">No data for this week yet.</p>
            )}
          </section>
        )}

        {/* ── Streak Section ── */}
        {!isEmpty && streak && !loading && (
          <section className="streak-section">
            <h2 className="section-title">Writing Streak</h2>
            <div className="streak-card">
              <div className="streak-stats">
                <div className="streak-stat">
                  <span className="streak-stat-val">
                    {streak.current_streak}
                  </span>
                  <span className="streak-stat-label">Current</span>
                </div>
                <div className="streak-divider" />
                <div className="streak-stat">
                  <span className="streak-stat-val">
                    {streak.longest_streak}
                  </span>
                  <span className="streak-stat-label">Longest</span>
                </div>
                {streak.last_writing_date && (
                  <>
                    <div className="streak-divider" />
                    <div className="streak-stat">
                      <span className="streak-stat-val streak-stat-date">
                        {streak.last_writing_date}
                      </span>
                      <span className="streak-stat-label">Last Session</span>
                    </div>
                  </>
                )}
              </div>
              {streak.current_streak > 0 && (
                <StreakFlame streak={streak.current_streak} />
              )}
              {streak.current_streak === 0 && (
                <p className="streak-zero">
                  Write today to start your streak!
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — scoped, self-contained
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  .stats-root {
    min-height: 100vh;
    background: #0f0e0c;
    color: #e8e2d6;
    font-family: 'DM Sans', sans-serif;
    padding: 0 0 80px;
  }

  /* ── Header ── */
  .stats-header {
    border-bottom: 1px solid #2a2720;
    padding: 40px 48px 32px;
    background: linear-gradient(180deg, #171510 0%, #0f0e0c 100%);
  }
  .stats-header-inner {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
  }
  .stats-title {
    font-family: 'Lora', serif;
    font-size: 2.2rem;
    font-weight: 600;
    color: #f0ead8;
    margin: 0 0 4px;
    letter-spacing: -0.02em;
  }
  .stats-subtitle {
    font-size: 0.9rem;
    color: #6b6355;
    margin: 0;
    font-weight: 300;
    letter-spacing: 0.04em;
  }

  /* ── Streak badge in header ── */
  .streak-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(135deg, #1e1b14, #252119);
    border: 1px solid #3a3420;
    border-radius: 12px;
    padding: 12px 20px;
    flex-shrink: 0;
  }
  .streak-number {
    font-family: 'Lora', serif;
    font-size: 2rem;
    font-weight: 600;
    color: #c8b06e;
    line-height: 1;
  }
  .streak-unit {
    font-size: 0.72rem;
    color: #7a6e58;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 2px;
  }

  /* ── Error ── */
  .error-banner {
    max-width: 900px;
    margin: 24px auto 0;
    padding: 14px 20px;
    background: #2a1515;
    border: 1px solid #5c2626;
    border-radius: 8px;
    color: #d4776a;
    font-size: 0.9rem;
  }

  /* ── KPI Grid ── */
  .kpi-grid {
    max-width: 900px;
    margin: 40px auto 0;
    padding: 0 48px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  @media (max-width: 800px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); padding: 0 24px; }
    .stats-header { padding: 28px 24px 24px; }
    .stats-header-inner { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 480px) {
    .kpi-grid { grid-template-columns: 1fr; }
  }

  .stat-card {
    position: relative;
    background: #161410;
    border: 1px solid #2a2720;
    border-radius: 12px;
    padding: 22px 20px 18px;
    overflow: hidden;
    animation: fadeSlideUp 0.5s both ease-out;
    transition: border-color 0.2s, transform 0.2s;
  }
  .stat-card:hover {
    border-color: var(--accent, #c8b06e);
    transform: translateY(-2px);
  }
  .stat-card-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent, #c8b06e);
    opacity: 0.5;
    border-radius: 0 0 12px 12px;
  }
  .stat-value {
    font-family: 'Lora', serif;
    font-size: 2rem;
    font-weight: 600;
    color: #f0ead8;
    line-height: 1;
    margin-bottom: 6px;
  }
  .stat-label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b6355;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .stat-sub {
    font-size: 0.8rem;
    color: #4a4438;
  }

  .skeleton-card {
    height: 110px;
    background: linear-gradient(90deg, #1a1814 25%, #201e18 50%, #1a1814 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border: 1px solid #2a2720;
    border-radius: 12px;
  }

  /* ── Chart ── */
  .chart-section, .streak-section {
    max-width: 900px;
    margin: 40px auto 0;
    padding: 0 48px;
  }
  @media (max-width: 800px) {
    .chart-section, .streak-section { padding: 0 24px; }
  }
  .section-title {
    font-family: 'Lora', serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: #b0a88e;
    margin: 0 0 20px;
    letter-spacing: -0.01em;
  }

  .chart-skeleton {
    height: 180px;
    background: linear-gradient(90deg, #1a1814 25%, #201e18 50%, #1a1814 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 12px;
  }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    height: 200px;
    background: #111008;
    border: 1px solid #2a2720;
    border-radius: 12px;
    padding: 20px 20px 0;
  }
  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }
  .bar-label-top {
    font-size: 0.65rem;
    color: #5a5244;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }
  .bar-track {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .bar-fill {
    width: 70%;
    max-width: 36px;
    background: linear-gradient(180deg, #4a4230 0%, #2e2818 100%);
    border-radius: 4px 4px 0 0;
    min-height: 3px;
    animation: growUp 0.6s both cubic-bezier(0.34, 1.56, 0.64, 1);
    transition: background 0.2s;
  }
  .bar-fill:hover {
    background: linear-gradient(180deg, #7a6e48 0%, #4a4230 100%);
  }
  .bar-today {
    background: linear-gradient(180deg, #c8b06e 0%, #8a7840 100%) !important;
  }
  .bar-today:hover {
    background: linear-gradient(180deg, #dcc280 0%, #a08c50 100%) !important;
  }
  .bar-day {
    font-size: 0.7rem;
    color: #4a4438;
    padding: 6px 0 10px;
    font-weight: 500;
  }
  .bar-day-today { color: #c8b06e; }

  /* ── Streak ── */
  .streak-card {
    background: #111008;
    border: 1px solid #2a2720;
    border-radius: 12px;
    padding: 28px;
  }
  .streak-stats {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .streak-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 80px;
  }
  .streak-stat-val {
    font-family: 'Lora', serif;
    font-size: 2.4rem;
    font-weight: 600;
    color: #f0ead8;
    line-height: 1;
  }
  .streak-stat-date {
    font-size: 1rem;
  }
  .streak-stat-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #5a5244;
    margin-top: 4px;
  }
  .streak-divider {
    width: 1px;
    height: 48px;
    background: #2a2720;
    flex-shrink: 0;
  }
  .streak-flames {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
  }
  .flame {
    font-size: 1.4rem;
    animation: flicker 2s infinite alternate ease-in-out;
    display: inline-block;
  }
  .streak-zero {
    color: #4a4438;
    font-style: italic;
    font-size: 0.9rem;
    margin: 0;
  }

  /* ── Empty state ── */
  .empty-state {
    max-width: 400px;
    margin: 80px auto;
    text-align: center;
    padding: 0 24px;
  }
  .empty-icon {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.6;
  }
  .empty-state h3 {
    font-family: 'Lora', serif;
    font-size: 1.3rem;
    color: #b0a88e;
    margin: 0 0 8px;
  }
  .empty-state p {
    color: #5a5244;
    font-size: 0.9rem;
    line-height: 1.6;
    margin: 0;
  }

  .no-data {
    color: #4a4438;
    font-style: italic;
    font-size: 0.9rem;
    margin: 0;
  }

  /* ── Animations ── */
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes growUp {
    from { height: 0 !important; }
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes flicker {
    0%   { transform: scaleY(1) rotate(-3deg); }
    50%  { transform: scaleY(1.08) rotate(2deg); }
    100% { transform: scaleY(0.95) rotate(-1deg); }
  }
`;
