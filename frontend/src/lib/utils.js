import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ── Workflow stages — the ONE canonical taxonomy ───────────────────────────
//
// Nine stages, concept → published. This is the single source of truth for
// "what stage is a project in." Both the WorkflowWorkspace pipeline ("Where
// you are") and the WorkflowPanel arc (in the manuscript sidebar) read from
// here. Don't define stage lists anywhere else.
//
// The stored `status` field on a project is always one of these ids. The AI
// workflow analysis returns a coarser 6-stage vocabulary which we translate
// into these via remapAiStageToStatus() below — so the AI becomes a *nudge*
// ("this reads like a draft — want to move it?") rather than a competing
// source of truth.
//
// Note: `final` was removed — it was nearly identical to `published` and the
// overlap created "which stage am I in?" ambiguity. proofing → published is
// the last transition now.

export const WORKFLOW_STAGES = [
  {
    id: "concept",
    label: "Concept",
    description: "An idea, taking shape.",
  },
  {
    id: "outline",
    label: "Outline",
    description: "Chapters mapped, plot sketched.",
  },
  {
    id: "draft",
    label: "Draft",
    description: "Words on the page, end to end.",
  },
  {
    id: "revisions",
    label: "Revisions",
    description: "The big moves — structure, arc.",
  },
  {
    id: "editing",
    label: "Editing",
    description: "Line by line, sentence by sentence.",
  },
  {
    id: "layout",
    label: "Layout",
    description: "Format, design, the way it sits.",
  },
  {
    id: "art",
    label: "Art",
    description: "Cover, illustrations, what readers see first.",
  },
  {
    id: "proofing",
    label: "Proofing",
    description: "The last read, hunting for what slipped past.",
  },
  {
    id: "published",
    label: "Published",
    description: "Out in the world.",
  },
];

// Plain array of ids, for the many places that just need the ordered list.
// Derived from WORKFLOW_STAGES so it can never drift out of sync.
export const workflowStages = WORKFLOW_STAGES.map((s) => s.id);

// id → description, for the "Right now: ..." copy. Derived, never hand-kept.
export const stageDescriptions = WORKFLOW_STAGES.reduce((acc, s) => {
  acc[s.id] = s.description;
  return acc;
}, {});

// id → label, for display. ("concept" → "Concept")
export const stageLabels = WORKFLOW_STAGES.reduce((acc, s) => {
  acc[s.id] = s.label;
  return acc;
}, {});

// Badge colors per stage. Kept as a separate map (not in WORKFLOW_STAGES)
// because these are Tailwind utility strings, and keeping them apart makes
// the canonical list readable. `final` dropped to match the 9-stage list.
export const statusColors = {
  concept: "bg-slate-100 text-slate-700 border-slate-200",
  outline: "bg-blue-100 text-blue-700 border-blue-200",
  draft: "bg-yellow-100 text-yellow-700 border-yellow-200",
  revisions: "bg-orange-100 text-orange-700 border-orange-200",
  editing: "bg-purple-100 text-purple-700 border-purple-200",
  layout: "bg-indigo-100 text-indigo-700 border-indigo-200",
  art: "bg-pink-100 text-pink-700 border-pink-200",
  proofing: "bg-cyan-100 text-cyan-700 border-cyan-200",
  published: "bg-green-100 text-green-700 border-green-200",
};

// ── AI stage remap ─────────────────────────────────────────────────────────
//
// The backend workflow analysis (analyze_workflow_stage) returns one of six
// coarse stages. We translate to the canonical nine so the AI's read can be
// compared against the project's stored status. "Polish" maps to "editing"
// (sentence-level work). "Complete" maps to "published".
//
// Anything unrecognized falls back to "draft" — the safe middle of the arc.

const AI_STAGE_TO_STATUS = {
  "Idea Drop": "concept",
  Outline: "outline",
  Draft: "draft",
  Revise: "revisions",
  Polish: "editing",
  Complete: "published",
};

export function remapAiStageToStatus(aiStage) {
  if (!aiStage) return "draft";
  return AI_STAGE_TO_STATUS[aiStage] || "draft";
}

// Compare two stages by their position in the arc. Returns:
//   negative if a is earlier than b, 0 if same, positive if a is later.
// Used to decide whether the AI's read is "ahead of" the stored status,
// which is what triggers the nudge.
export function compareStages(a, b) {
  return workflowStages.indexOf(a) - workflowStages.indexOf(b);
}

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatWordCount = (count) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

// Progress as a percentage through the arc. concept = 1/9 ≈ 11%,
// published = 9/9 = 100%. Unknown status returns 0.
export const calculateProgress = (status) => {
  const index = workflowStages.indexOf(status);
  if (index === -1) return 0;
  return Math.round(((index + 1) / workflowStages.length) * 100);
};
