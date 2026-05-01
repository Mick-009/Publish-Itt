import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { aiApi, notesApi, importAnalysisApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { AnalyzeLoopArt } from "@/components/EmptyStateArt";
import {
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Check,
  StickyNote,
  X,
  RefreshCw,
  AlertTriangle,
  FileText,
  Zap,
  BookOpen,
  Palette,
  ListChecks,
  MessageSquare,
  Lightbulb,
  GraduationCap,
} from "lucide-react";

const CATEGORY_CONFIG = {
  structure: {
    label: "Structure",
    icon: BookOpen,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  formatting: {
    label: "Formatting",
    icon: FileText,
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  tone: {
    label: "Tone & Style",
    icon: Palette,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  notes: {
    label: "Notes Detected",
    icon: StickyNote,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  chapters: {
    label: "Chapter Detection",
    icon: ListChecks,
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  },
  issues: {
    label: "Issues",
    icon: AlertTriangle,
    color: "bg-red-500/10 text-red-600 border-red-500/20",
  },
};

export default function AnalyzerPanel({
  content,
  chapterId,
  projectId,
  projectTitle,
  ageGroup,
  onApplyChange,
  onCreateVersion,
  autoAnalyzeOnMount = true,
}) {
  // Tone & Style Analysis State
  const [toneStyleData, setToneStyleData] = useState(null);
  const [toneStyleLoading, setToneStyleLoading] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState(null);

  // Import Analysis State (existing functionality)
  const [findings, setFindings] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(
    new Set(["structure", "formatting", "issues"]),
  );
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  // Group findings by category
  const groupedFindings = findings.reduce((acc, finding) => {
    if (dismissedIds.has(finding.id)) return acc;
    const category = finding.category || "issues";
    if (!acc[category]) acc[category] = [];
    acc[category].push(finding);
    return acc;
  }, {});

  // Tone & Style Analysis Function
  const runToneStyleAnalysis = useCallback(async () => {
    if (!content || content.trim().length < 30) {
      setToneStyleData({
        tone_analysis:
          "Add more content to see tone analysis. I need at least a few sentences to work with.",
        style_analysis:
          "Style analysis will appear once you have enough content to analyze.",
        suggestions: [
          "Start writing or paste your content",
          "Share at least a paragraph for meaningful analysis",
        ],
        reading_level: "Not yet determined",
      });
      return;
    }

    setToneStyleLoading(true);
    try {
      const sectionInfo = projectTitle ? `Project: ${projectTitle}` : null;

      const response = await aiApi.analyzeTone(
        content,
        projectId,
        chapterId,
        sectionInfo,
        null, // intended tone
        null, // goals
        ageGroup,
      );

      setToneStyleData(response.data);
      setLastAnalyzed(Date.now());
      toast.success("Tone & Style analysis complete");
    } catch (error) {
      console.error("Tone analysis failed:", error);
      toast.error("Failed to analyze tone & style");
      // Set fallback data
      setToneStyleData({
        tone_analysis:
          "Unable to complete analysis at this time. Please try again.",
        style_analysis: "Style analysis unavailable.",
        suggestions: [
          "Try refreshing the analysis",
          "Check your content and try again",
        ],
        reading_level: "Not determined",
      });
    } finally {
      setToneStyleLoading(false);
    }
  }, [content, projectId, chapterId, projectTitle, ageGroup]);

  // Auto-analyze when content becomes available or when tab is opened
  useEffect(() => {
    if (
      autoAnalyzeOnMount &&
      content &&
      content.trim().length >= 30 &&
      !toneStyleData &&
      !toneStyleLoading
    ) {
      runToneStyleAnalysis();
    }
  }, [
    autoAnalyzeOnMount,
    content,
    toneStyleData,
    toneStyleLoading,
    runToneStyleAnalysis,
  ]);

  // Detailed Import Analysis (existing functionality)
  const runDetailedAnalysis = async () => {
    if (!content || content.trim().length < 50) {
      toast.error("Not enough content for detailed analysis");
      return;
    }

    setAnalyzing(true);
    try {
      const res = await importAnalysisApi.analyze(
        content,
        "Chapter Analysis",
        projectId,
        chapterId,
      );

      // Transform analysis results into findings
      const analysisFindings = [];
      let findingId = 0;

      if (res.data) {
        const data = res.data;

        // Structure findings
        if (data.structure_issues?.length) {
          data.structure_issues.forEach((issue) => {
            analysisFindings.push({
              id: `finding-${findingId++}`,
              category: "structure",
              title:
                typeof issue === "string"
                  ? "Structure Issue"
                  : issue.title || "Structure Issue",
              description:
                typeof issue === "string" ? issue : issue.description || issue,
              suggestion: issue.suggestion,
              severity: issue.severity || "medium",
              applyAction: issue.fix,
            });
          });
        }

        // Formatting findings
        if (data.formatting_issues?.length) {
          data.formatting_issues.forEach((issue) => {
            analysisFindings.push({
              id: `finding-${findingId++}`,
              category: "formatting",
              title:
                typeof issue === "string"
                  ? "Formatting Issue"
                  : issue.title || "Formatting Issue",
              description:
                typeof issue === "string" ? issue : issue.description || issue,
              suggestion: issue.suggestion,
              severity: issue.severity || "low",
              applyAction: issue.fix,
            });
          });
        }

        // Notes detected
        if (data.notes_detected?.length) {
          data.notes_detected.forEach((note) => {
            analysisFindings.push({
              id: `finding-${findingId++}`,
              category: "notes",
              title: "Author Note Detected",
              description: typeof note === "string" ? note : note.text || note,
              location: note.location,
              severity: "info",
              noteText: typeof note === "string" ? note : note.text || note,
            });
          });
        }

        // Style issues
        if (data.style_issues?.length) {
          data.style_issues.forEach((issue) => {
            analysisFindings.push({
              id: `finding-${findingId++}`,
              category: "tone",
              title:
                typeof issue === "string"
                  ? "Style Issue"
                  : issue.title || "Style Issue",
              description:
                typeof issue === "string" ? issue : issue.description || issue,
              suggestion: issue.suggestion,
              severity: issue.severity || "medium",
            });
          });
        }

        // Lore issues
        if (data.lore_issues?.length) {
          data.lore_issues.forEach((issue) => {
            analysisFindings.push({
              id: `finding-${findingId++}`,
              category: "issues",
              title:
                typeof issue === "string"
                  ? "Lore Issue"
                  : issue.title || "Lore Issue",
              description:
                typeof issue === "string" ? issue : issue.description || issue,
              suggestion: issue.suggestion,
              severity: "medium",
            });
          });
        }

        // Word count info
        if (data.word_count) {
          analysisFindings.push({
            id: `finding-${findingId++}`,
            category: "structure",
            title: "Word Count",
            description: `Total words: ${data.word_count.toLocaleString()}`,
            severity: "info",
          });
        }
      }

      setFindings(analysisFindings);
      setDismissedIds(new Set());
      setShowDetailedAnalysis(true);

      if (analysisFindings.length > 0) {
        toast.success(`Found ${analysisFindings.length} items to review`);
      } else {
        toast.success("Detailed analysis complete - no issues found!");
      }
    } catch (error) {
      console.error("Detailed analysis failed:", error);
      toast.error("Failed to run detailed analysis");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyChange = async (finding) => {
    if (finding.applyAction && onApplyChange) {
      if (onCreateVersion) {
        await onCreateVersion(`Before applying: ${finding.title}`);
      }
      onApplyChange(finding.applyAction);
      setDismissedIds((prev) => new Set([...prev, finding.id]));
      toast.success("Change applied");
    }
  };

  const handleSaveToNotes = async (finding) => {
    if (!chapterId) {
      toast.error("No chapter selected");
      return;
    }

    try {
      await notesApi.create({
        parent_type: "chapter",
        parent_id: chapterId,
        note_text: finding.noteText || finding.description,
        location_reference: finding.location || "",
        note_type: "comment",
      });
      setDismissedIds((prev) => new Set([...prev, finding.id]));
      toast.success("Saved to notes");
    } catch (error) {
      toast.error("Failed to save note");
    }
  };

  const handleDismiss = (findingId) => {
    setDismissedIds((prev) => new Set([...prev, findingId]));
  };

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const totalFindings = Object.values(groupedFindings).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  return (
    <div className="space-y-4" data-testid="analyzer-panel">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Tone & Style</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={runToneStyleAnalysis}
          disabled={toneStyleLoading}
          className="h-7 px-2 text-xs"
          data-testid="refresh-tone-btn"
        >
          {toneStyleLoading ? (
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
      {toneStyleLoading && !toneStyleData && (
        <LoadingState
          size="panel"
          title="Reading closely."
          body="Looking at tone, pacing, and the shape of your sentences."
          testId="loading-analyzer-tone"
        />
      )}

      {/* Tone & Style Analysis Results */}
      {toneStyleData && !toneStyleLoading && (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-2">
            {/* Tone Analysis Card */}
            <Card
              className="border-l-4 border-l-amber-500"
              data-testid="tone-analysis-card"
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  Tone Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p
                  className="text-sm text-muted-foreground leading-relaxed"
                  data-testid="tone-analysis-text"
                >
                  {toneStyleData.tone_analysis}
                </p>
              </CardContent>
            </Card>

            {/* Style Analysis Card */}
            <Card
              className="border-l-4 border-l-purple-500"
              data-testid="style-analysis-card"
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4 text-purple-500" />
                  Style Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p
                  className="text-sm text-muted-foreground leading-relaxed"
                  data-testid="style-analysis-text"
                >
                  {toneStyleData.style_analysis}
                </p>
              </CardContent>
            </Card>

            {/* Reading Level Badge */}
            {toneStyleData.reading_level && (
              <div className="flex items-center gap-2 px-1">
                <GraduationCap className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">
                  Reading Level:
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs"
                  data-testid="reading-level-badge"
                >
                  {toneStyleData.reading_level}
                </Badge>
              </div>
            )}

            {/* Suggestions Card */}
            {toneStyleData.suggestions &&
              toneStyleData.suggestions.length > 0 && (
                <Card
                  className="border-l-4 border-l-green-500"
                  data-testid="suggestions-card"
                >
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-green-500" />
                      Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-2">
                      {toneStyleData.suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 text-sm"
                          data-testid={`suggestion-${index}`}
                        >
                          <span className="text-green-500 font-medium shrink-0">
                            {index + 1}.
                          </span>
                          <span className="text-muted-foreground">
                            {suggestion}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Last Analyzed */}
            {lastAnalyzed && (
              <div className="text-[10px] text-muted-foreground text-center pt-2">
                Last analyzed: {new Date(lastAnalyzed).toLocaleTimeString()}
              </div>
            )}

            <Separator className="my-4" />

            {/* Detailed Analysis Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Detailed Analysis
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runDetailedAnalysis}
                  disabled={analyzing || !content}
                  className="h-7 text-xs rounded-sm"
                  data-testid="run-detailed-analysis-btn"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Run Deep Analysis
                    </>
                  )}
                </Button>
              </div>

              {/* Detailed Findings */}
              {showDetailedAnalysis && totalFindings > 0 && (
                <div className="space-y-2">
                  {Object.entries(CATEGORY_CONFIG).map(
                    ([categoryKey, config]) => {
                      const categoryFindings = groupedFindings[categoryKey];
                      if (!categoryFindings?.length) return null;

                      const CategoryIcon = config.icon;
                      const isExpanded = expandedCategories.has(categoryKey);

                      return (
                        <Collapsible
                          key={categoryKey}
                          open={isExpanded}
                          onOpenChange={() => toggleCategory(categoryKey)}
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              className={cn(
                                "w-full flex items-center justify-between p-2 rounded-sm transition-colors text-xs",
                                config.color,
                              )}
                              data-testid={`category-${categoryKey}`}
                            >
                              <div className="flex items-center gap-2">
                                <CategoryIcon className="h-3.5 w-3.5" />
                                <span className="font-medium">
                                  {config.label}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-4"
                                >
                                  {categoryFindings.length}
                                </Badge>
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-1.5 mt-1.5 pl-2">
                              {categoryFindings.map((finding) => (
                                <Card
                                  key={finding.id}
                                  className="border-l-2 border-l-accent"
                                  data-testid={`finding-${finding.id}`}
                                >
                                  <CardContent className="p-2">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <h4 className="font-medium text-xs">
                                        {finding.title}
                                      </h4>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[9px] shrink-0 h-4",
                                          finding.severity === "high" &&
                                            "border-red-500 text-red-600",
                                          finding.severity === "medium" &&
                                            "border-amber-500 text-amber-600",
                                          finding.severity === "low" &&
                                            "border-blue-500 text-blue-600",
                                          finding.severity === "info" &&
                                            "border-gray-400 text-gray-600",
                                        )}
                                      >
                                        {finding.severity}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">
                                      {finding.description}
                                    </p>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap gap-1">
                                      {finding.applyAction && (
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="h-6 text-[10px] rounded-sm"
                                          onClick={() =>
                                            handleApplyChange(finding)
                                          }
                                          data-testid={`apply-${finding.id}`}
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          Apply
                                        </Button>
                                      )}
                                      {(finding.category === "notes" ||
                                        finding.noteText) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-[10px] rounded-sm"
                                          onClick={() =>
                                            handleSaveToNotes(finding)
                                          }
                                          data-testid={`save-note-${finding.id}`}
                                        >
                                          <StickyNote className="h-3 w-3 mr-1" />
                                          Save
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] rounded-sm"
                                        onClick={() =>
                                          handleDismiss(finding.id)
                                        }
                                        data-testid={`dismiss-${finding.id}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    },
                  )}
                </div>
              )}

              {showDetailedAnalysis && totalFindings === 0 && !analyzing && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No detailed findings. Your content looks good!
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Initial State - No Analysis Yet */}
      {!toneStyleData && !toneStyleLoading && (
        <EmptyState
          size="panel"
          art={<AnalyzeLoopArt size={72} />}
          title="Want a closer read?"
          body="Thad will look at your tone, pacing, and style — and surface what's working and what isn't."
          primaryAction={{
            label: "Analyze this chapter",
            icon: Sparkles,
            onClick: runToneStyleAnalysis,
            testId: "initial-analyze-btn",
          }}
          testId="empty-analyzer-panel"
        />
      )}
    </div>
  );
}
