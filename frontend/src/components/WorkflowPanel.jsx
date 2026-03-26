import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { aiApi } from "@/lib/api";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

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

  const analyzeWorkflow = useCallback(async () => {
    if (!manuscriptContent && chapterCount === 0) {
      // No content to analyze yet
      setAnalysisData({
        stage: "Idea Drop",
        message:
          "Welcome! You're at the beginning of your creative journey. Start by capturing your initial ideas or importing an existing manuscript.",
        next_steps: [
          "Create your first chapter",
          "Import an existing manuscript",
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
      setError("Unable to analyze workflow. Please try again.");
      // Set fallback data
      setAnalysisData({
        stage: "Draft",
        message:
          "I'm here to help guide your writing journey. Let me know when you're ready for suggestions!",
        next_steps: ["Continue writing", "Review your chapters"],
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
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Writing Stage</span>
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
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-accent animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">
            Analyzing your manuscript...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeWorkflow}
              className="mt-2"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisData && !loading && (
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

          {/* Thad's Message */}
          <div className="bg-muted/30 border rounded-lg p-3">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">Thad says:</p>
            </div>
            <p
              className="text-sm leading-relaxed"
              data-testid="workflow-message"
            >
              {analysisData.message}
            </p>
          </div>

          {/* Next Steps */}
          {analysisData.next_steps && analysisData.next_steps.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Suggested Next Steps
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

          {/* Stage Timeline */}
          <div className="pt-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Writing Journey
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
              Last analyzed: {new Date(lastAnalyzed).toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
