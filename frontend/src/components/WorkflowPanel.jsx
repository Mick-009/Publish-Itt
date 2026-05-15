import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { aiApi, thadApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import LoadingState from "@/components/LoadingState";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Lightbulb,
  ListTree,
  PenLine,
  RotateCcw,
  Sparkle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Pencil,
  History,
  ChevronDown,
  ChevronRight,
  Bookmark,
  X,
} from "lucide-react";

// Stage IDs are backend contract — `analyzeWorkflowStage` returns one of these
// in `data.stage`, so don't rename them. Display copy comes from the backend.
const WORKFLOW_STAGES = [
  {
    id: "Idea Drop",
    icon: Lightbulb,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    id: "Outline",
    icon: ListTree,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "Draft",
    icon: PenLine,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    id: "Revise",
    icon: RotateCcw,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    id: "Polish",
    icon: Sparkle,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "Complete",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
];

// Try to parse Thad's regen response as JSON in the workflow shape.
// Falls back to the original analysisData on failure (keeps the UI stable).
function parseWorkflowRegenResponse(text) {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      stage: parsed.stage || "Draft",
      message: parsed.message || "",
      next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
      progress_percent:
        typeof parsed.progress_percent === "number"
          ? parsed.progress_percent
          : 50,
    };
  } catch {
    return null;
  }
}

export default function WorkflowPanel({
  manuscriptContent = "",
  chapterCount = 0,
  projectId = null,
  projectTitle = "",
  ageGroup = null,
  autoAnalyzeOnMount = true,
}) {
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [lastAnalyzed, setLastAnalyzed] = useState(null);
  const [error, setError] = useState(null);

  // Phase 2: push-back & revisions
  const [pushbackOpen, setPushbackOpen] = useState(false);
  const [pushbackText, setPushbackText] = useState("");
  const [pushbackSubmitting, setPushbackSubmitting] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Phase 2: save-as-style-note flow
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [lastRevisionId, setLastRevisionId] = useState(null);
  const [lastFeedback, setLastFeedback] = useState("");

  // Phase 2: project-wide standing notes (same data as AnalyzerPanel —
  // they're per-project, so either panel can show and manage them).
  const [styleNotes, setStyleNotes] = useState([]);
  const [styleNotesOpen, setStyleNotesOpen] = useState(false);

  // Workflow reads aren't tied to a chapter — they span the whole manuscript.
  // We use the project ID as source_id so revisions group per-project, which
  // is the right scope for "the writer pushed back on the workflow read".
  const sourceId = projectId || "";

  const analyzeWorkflow = useCallback(async () => {
    if (!manuscriptContent && chapterCount === 0) {
      // No content to analyze yet
      setAnalysisData({
        stage: "Idea Drop",
        message:
          "Nothing on the page yet. Start a chapter, or bring in something you've already written.",
        next_steps: [
          "Start your first chapter",
          "Bring in a manuscript",
        ],
        progress_percent: 10,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build section info
      const sectionInfo = `${chapterCount} chapters, Project: ${projectTitle || "Untitled"}`;

      // Calculate time since last session (simplified - could be enhanced)
      const timeAway = lastAnalyzed
        ? `${Math.round((Date.now() - lastAnalyzed) / 60000)} minutes ago`
        : "First analysis";

      const response = await aiApi.analyzeWorkflowStage(
        manuscriptContent,
        sectionInfo,
        null, // Let AI determine current stage
        null, // No specific goals set
        timeAway,
        ageGroup,
        projectId,
      );

      setAnalysisData(response.data);
      setLastAnalyzed(Date.now());
    } catch (err) {
      console.error("Workflow analysis failed:", err);
      setError("Couldn't read the workflow. Try again?");
      // Fallback in voice — used when the API is unreachable.
      setAnalysisData({
        stage: "Draft",
        message:
          "Lost the thread on the analysis. Keep writing — I'll catch up.",
        next_steps: ["Keep going", "Look back at what's there"],
        progress_percent: 50,
      });
    } finally {
      setLoading(false);
    }
  }, [
    manuscriptContent,
    chapterCount,
    projectId,
    projectTitle,
    ageGroup,
    lastAnalyzed,
  ]);

  // Auto-analyze on mount if enabled
  useEffect(() => {
    if (autoAnalyzeOnMount) {
      analyzeWorkflow();
    }
  }, [autoAnalyzeOnMount]); // Only run on mount

  // Phase 2: load revisions for this project's workflow reads.
  useEffect(() => {
    if (!projectId || !sourceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await thadApi.getRevisions(
          "workflow_recommendation",
          sourceId,
          projectId,
        );
        if (!cancelled) setRevisions(res.data || []);
      } catch (err) {
        console.warn("Couldn't load workflow revisions:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, sourceId]);

  // Phase 2: load project-wide style notes.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await thadApi.listStyleNotes(projectId);
        if (!cancelled) setStyleNotes(res.data || []);
      } catch (err) {
        console.warn("Couldn't load style notes:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Phase 2: submit a pushback and regenerate.
  const submitPushback = async () => {
    const feedback = pushbackText.trim();
    if (!feedback) return;
    if (!projectId) {
      toast.error("No project loaded.");
      return;
    }
    if (!analysisData) {
      toast.error("Nothing to push back on yet.");
      return;
    }

    setPushbackSubmitting(true);
    try {
      const previousResponse = JSON.stringify({
        stage: analysisData.stage || "Draft",
        message: analysisData.message || "",
        next_steps: analysisData.next_steps || [],
        progress_percent: analysisData.progress_percent || 50,
      });

      const res = await thadApi.regenerate(
        "workflow_recommendation",
        sourceId,
        projectId,
        feedback,
        previousResponse,
      );

      const parsed = parseWorkflowRegenResponse(res.data.thad_response);
      if (parsed) {
        setAnalysisData(parsed);
        setLastAnalyzed(Date.now());
      } else {
        toast.error("Couldn't make sense of Thad's response. Try again?");
      }

      // Track this revision for the save-as-note prompt
      setLastRevisionId(res.data.revision_id);
      setLastFeedback(feedback);
      setSavePromptOpen(true);

      // Refresh history
      try {
        const histRes = await thadApi.getRevisions(
          "workflow_recommendation",
          sourceId,
          projectId,
        );
        setRevisions(histRes.data || []);
      } catch {
        /* non-fatal */
      }

      setPushbackText("");
      setPushbackOpen(false);
    } catch (err) {
      console.error("Workflow pushback failed:", err);
      toast.error("Couldn't reach Thad just now. Try again?");
    } finally {
      setPushbackSubmitting(false);
    }
  };

  const saveLastFeedbackAsNote = async () => {
    if (!lastFeedback || !projectId) {
      setSavePromptOpen(false);
      return;
    }
    try {
      const res = await thadApi.createStyleNote(
        projectId,
        lastFeedback,
        lastRevisionId,
      );
      setStyleNotes((prev) => [...prev, res.data]);
      toast.success("I'll remember.");
    } catch (err) {
      console.error("Save style note failed:", err);
      toast.error("Couldn't save it. Try again?");
    } finally {
      setSavePromptOpen(false);
    }
  };

  const retireStyleNote = async (noteId) => {
    try {
      await thadApi.setStyleNoteActive(noteId, false);
      setStyleNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Set aside.");
    } catch (err) {
      console.error("Retire style note failed:", err);
      toast.error("Couldn't update it. Try again?");
    }
  };

  const deleteStyleNote = async (noteId) => {
    try {
      await thadApi.deleteStyleNote(noteId);
      setStyleNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Removed.");
    } catch (err) {
      console.error("Delete style note failed:", err);
      toast.error("Couldn't remove it. Try again?");
    }
  };

  const getCurrentStageInfo = () => {
    if (!analysisData) return WORKFLOW_STAGES[0];
    return (
      WORKFLOW_STAGES.find((s) => s.id === analysisData.stage) ||
      WORKFLOW_STAGES[2]
    );
  };

  const currentStage = getCurrentStageInfo();
  const StageIcon = currentStage.icon;

  return (
    <div className="space-y-4" data-testid="workflow-panel">
      {/* Standing notes — collapsed by default, only renders if any exist */}
      {styleNotes.length > 0 && (
        <Collapsible
          open={styleNotesOpen}
          onOpenChange={setStyleNotesOpen}
          data-testid="standing-notes-section"
        >
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-2 rounded-sm bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
              <div className="flex items-center gap-2">
                <Bookmark className="h-3.5 w-3.5 text-accent" />
                <span className="font-medium">What you've told me</span>
                <Badge variant="secondary" className="text-[10px] h-4">
                  {styleNotes.length}
                </Badge>
              </div>
              {styleNotesOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 mt-2 pl-2">
              {styleNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start gap-2 p-2 rounded-sm bg-muted/20 text-xs"
                  data-testid={`style-note-${note.id}`}
                >
                  <span className="flex-1 text-muted-foreground leading-relaxed">
                    {note.note}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] rounded-sm shrink-0"
                    onClick={() => retireStyleNote(note.id)}
                    title="Set aside (keeps the history)"
                    data-testid={`retire-note-${note.id}`}
                  >
                    Set aside
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 rounded-sm shrink-0"
                    onClick={() => deleteStyleNote(note.id)}
                    title="Remove"
                    data-testid={`delete-note-${note.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Where you are</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={analyzeWorkflow}
          disabled={loading}
          className="h-7 px-2 text-xs"
          data-testid="refresh-workflow-btn"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {/* Loading State */}
      {loading && !analysisData && (
        <LoadingState
          size="panel"
          title="Reading the lay of the land."
          body="Mapping where the manuscript sits — and what to reach for next."
          testId="loading-workflow-stage"
        />
      )}

      {/* Regen loading state — different copy, signals it's a revision */}
      {pushbackSubmitting && (
        <LoadingState
          size="panel"
          title="Thinking it over."
          body="Looking at where the manuscript sits with your read in mind."
          testId="loading-workflow-regen"
        />
      )}

      {/* Error State */}
      {error && !loading && !pushbackSubmitting && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeWorkflow}
              className="mt-2"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisData && !loading && !pushbackSubmitting && (
        <>
          {/* Current Stage Card */}
          <Card
            className={cn("border", currentStage.bgColor.replace("/10", "/20"))}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", currentStage.bgColor)}>
                  <StageIcon className={cn("h-5 w-5", currentStage.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">
                      {analysisData.stage}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {analysisData.progress_percent}%
                    </Badge>
                  </div>
                  <Progress
                    value={analysisData.progress_percent}
                    className="h-1.5 mb-3"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Thad's read — the sparkles icon carries the attribution, no label needed */}
          <div className="bg-muted/30 border rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <p
                className="text-sm leading-relaxed"
                data-testid="workflow-message"
              >
                {analysisData.message}
              </p>
            </div>
          </div>

          {/* Next Steps */}
          {analysisData.next_steps && analysisData.next_steps.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                What's next
              </h5>
              <div className="space-y-1.5">
                {analysisData.next_steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                    data-testid={`next-step-${index}`}
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Push-back affordance */}
          {!pushbackOpen && projectId && (
            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPushbackOpen(true)}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                data-testid="open-pushback-btn"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Push back
              </Button>
            </div>
          )}

          {/* Push-back composer */}
          {pushbackOpen && (
            <div
              className="space-y-2 p-3 rounded-sm bg-muted/30 border"
              data-testid="pushback-composer"
            >
              <Textarea
                value={pushbackText}
                onChange={(e) => setPushbackText(e.target.value)}
                placeholder="What did I miss?"
                className="min-h-[80px] text-sm rounded-sm resize-none"
                data-testid="pushback-textarea"
                autoFocus
                disabled={pushbackSubmitting}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPushbackOpen(false);
                    setPushbackText("");
                  }}
                  className="h-7 text-xs rounded-sm"
                  disabled={pushbackSubmitting}
                  data-testid="cancel-pushback-btn"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submitPushback}
                  className="h-7 text-xs rounded-sm"
                  disabled={pushbackSubmitting || !pushbackText.trim()}
                  data-testid="send-pushback-btn"
                >
                  {pushbackSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Sending.
                    </>
                  ) : (
                    "Send"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Save-as-style-note prompt */}
          {savePromptOpen && (
            <div
              className="space-y-2 p-3 rounded-sm bg-accent/5 border border-accent/20"
              data-testid="save-note-prompt"
            >
              <p className="text-xs text-muted-foreground">
                Want me to remember this for future reads?
              </p>
              <p className="text-xs italic text-muted-foreground line-clamp-2">
                "{lastFeedback}"
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSavePromptOpen(false)}
                  className="h-7 text-xs rounded-sm"
                  data-testid="dismiss-save-prompt-btn"
                >
                  Just this once
                </Button>
                <Button
                  size="sm"
                  onClick={saveLastFeedbackAsNote}
                  className="h-7 text-xs rounded-sm"
                  data-testid="save-as-note-btn"
                >
                  Save it
                </Button>
              </div>
            </div>
          )}

          {/* Earlier takes — collapsed by default, only renders if any */}
          {revisions.length > 0 && (
            <Collapsible
              open={showHistory}
              onOpenChange={setShowHistory}
              data-testid="revisions-history"
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-2 rounded-sm text-xs text-muted-foreground hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <History className="h-3 w-3" />
                    <span>
                      Earlier {revisions.length === 1 ? "take" : "takes"} (
                      {revisions.length})
                    </span>
                  </div>
                  {showHistory ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-2 pl-2">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="space-y-1 p-2 rounded-sm bg-muted/20 text-xs"
                      data-testid={`revision-${rev.id}`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>You said:</span>
                        <span>
                          {new Date(rev.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="italic text-muted-foreground">
                        "{rev.user_feedback}"
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Stage Timeline */}
          <div className="pt-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              The arc
            </h5>
            <div className="flex items-center justify-between gap-1">
              {WORKFLOW_STAGES.map((stage, index) => {
                const isActive = stage.id === analysisData.stage;
                const isPast =
                  WORKFLOW_STAGES.findIndex(
                    (s) => s.id === analysisData.stage,
                  ) > index;
                const StageIconSmall = stage.icon;

                return (
                  <div
                    key={stage.id}
                    className="flex flex-col items-center flex-1"
                    title={stage.id}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                        isActive &&
                          cn(
                            stage.bgColor,
                            "ring-2 ring-offset-1",
                            stage.color.replace("text-", "ring-"),
                          ),
                        isPast && "bg-accent/20",
                        !isActive && !isPast && "bg-muted",
                      )}
                    >
                      <StageIconSmall
                        className={cn(
                          "h-4 w-4",
                          isActive && stage.color,
                          isPast && "text-accent",
                          !isActive && !isPast && "text-muted-foreground",
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] mt-1 text-center",
                        isActive ? "font-medium" : "text-muted-foreground",
                      )}
                    >
                      {stage.id.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Last Analyzed */}
          {lastAnalyzed && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-2">
              <Clock className="h-3 w-3" />
              Last read: {new Date(lastAnalyzed).toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
