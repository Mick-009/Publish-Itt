/**
 * EmptyStateArt — small typographic illustrations for empty states.
 *
 * Each is ~80px square, drawn in stroke-based line work using `currentColor`
 * so it picks up the parent's theme color. No fills, no clip-art energy —
 * just editorial line drawings that match Lora/DM Sans.
 */

const baseProps = {
  width: 80,
  height: 80,
  viewBox: "0 0 80 80",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true",
};

// ── Blank page with a dog-eared corner and a single dot of ink ─────────────
export function BlankPageArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Page outline with dog-ear */}
      <path d="M 22 14 L 52 14 L 62 24 L 62 66 L 22 66 Z" />
      <path d="M 52 14 L 52 24 L 62 24" opacity="0.7" />
      {/* A few subtle ruling lines */}
      <line x1="30" y1="34" x2="54" y2="34" opacity="0.35" />
      <line x1="30" y1="42" x2="50" y2="42" opacity="0.25" />
      <line x1="30" y1="50" x2="46" y2="50" opacity="0.18" />
      {/* A drop of ink */}
      <circle cx="58" cy="58" r="2.2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

// ── Stack of bound pages, slightly fanned ──────────────────────────────────
export function ChapterStackArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Bottom page */}
      <path d="M 18 56 L 56 56 L 56 22 L 18 22 Z" opacity="0.35" />
      {/* Middle page */}
      <path d="M 22 60 L 60 60 L 60 26 L 22 26 Z" opacity="0.6" />
      {/* Top page */}
      <path d="M 26 64 L 64 64 L 64 30 L 26 30 Z" />
      {/* Ruled lines on top page */}
      <line x1="34" y1="40" x2="56" y2="40" opacity="0.45" />
      <line x1="34" y1="46" x2="58" y2="46" opacity="0.35" />
      <line x1="34" y1="52" x2="50" y2="52" opacity="0.25" />
    </svg>
  );
}

// ── Pinned slip with a thumbtack ───────────────────────────────────────────
export function PinnedNoteArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Slip, slightly tilted */}
      <path d="M 22 22 L 58 18 L 62 58 L 26 62 Z" />
      {/* Lines of writing */}
      <line x1="30" y1="34" x2="50" y2="32" opacity="0.45" />
      <line x1="30" y1="42" x2="54" y2="40" opacity="0.35" />
      <line x1="30" y1="50" x2="48" y2="48" opacity="0.25" />
      {/* Thumbtack */}
      <circle cx="40" cy="20" r="3.5" fill="currentColor" opacity="0.7" />
      <circle cx="40" cy="20" r="1.2" fill="hsl(var(--background))" />
    </svg>
  );
}

// ── Stacked timeline / version markers ─────────────────────────────────────
export function VersionTimelineArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Vertical timeline */}
      <line x1="40" y1="18" x2="40" y2="62" opacity="0.4" />
      {/* Three timeline marks, decreasing in opacity (recent → older) */}
      <circle cx="40" cy="22" r="4" fill="currentColor" />
      <line x1="46" y1="22" x2="62" y2="22" opacity="0.55" />
      <circle cx="40" cy="40" r="3.5" fill="currentColor" opacity="0.7" />
      <line x1="46" y1="40" x2="58" y2="40" opacity="0.4" />
      <circle cx="40" cy="58" r="3" fill="currentColor" opacity="0.45" />
      <line x1="46" y1="58" x2="54" y2="58" opacity="0.25" />
    </svg>
  );
}

// ── Magnifying loop over a page corner ─────────────────────────────────────
export function AnalyzeLoopArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Page corner */}
      <path d="M 18 22 L 52 22 L 52 56 L 18 56 Z" opacity="0.4" />
      <line x1="26" y1="32" x2="44" y2="32" opacity="0.4" />
      <line x1="26" y1="40" x2="42" y2="40" opacity="0.3" />
      {/* Loop circle, overlapping bottom-right corner */}
      <circle cx="50" cy="50" r="12" />
      {/* Loop handle */}
      <line x1="59" y1="59" x2="66" y2="66" strokeWidth="2" />
      {/* Tiny gleam */}
      <line x1="44" y1="46" x2="48" y2="46" opacity="0.5" />
    </svg>
  );
}

// ── A single quill mark / writing flourish ─────────────────────────────────
export function QuillMarkArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Quill arc */}
      <path d="M 20 60 Q 40 18 60 22" />
      <path d="M 60 22 L 56 30" opacity="0.7" />
      <path d="M 60 22 L 64 28" opacity="0.7" />
      {/* A few barbs */}
      <line x1="38" y1="34" x2="42" y2="40" opacity="0.5" />
      <line x1="46" y1="28" x2="50" y2="34" opacity="0.5" />
      <line x1="30" y1="44" x2="34" y2="50" opacity="0.5" />
      {/* Inkdot at the tip */}
      <circle cx="20" cy="60" r="1.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

// ── Empty workflow lane with a dotted rail ─────────────────────────────────
export function WorkflowEmptyArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Three columns */}
      <rect x="14" y="22" width="16" height="36" rx="2" opacity="0.4" />
      <rect x="32" y="22" width="16" height="36" rx="2" opacity="0.55" />
      <rect x="50" y="22" width="16" height="36" rx="2" />
      {/* Dotted indicator on rightmost (active) column */}
      <line
        x1="58"
        y1="32"
        x2="58"
        y2="48"
        strokeDasharray="2 3"
        opacity="0.6"
      />
    </svg>
  );
}

// ── Chat bubble / Thad ─────────────────────────────────────────────────────
export function ChatStartArt({ size = 80 }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      {/* Bubble */}
      <path d="M 20 28 Q 20 22 26 22 L 54 22 Q 60 22 60 28 L 60 46 Q 60 52 54 52 L 36 52 L 28 60 L 28 52 L 26 52 Q 20 52 20 46 Z" />
      {/* Three dots */}
      <circle cx="32" cy="37" r="1.6" fill="currentColor" opacity="0.55" />
      <circle cx="40" cy="37" r="1.6" fill="currentColor" opacity="0.7" />
      <circle cx="48" cy="37" r="1.6" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
