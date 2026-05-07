import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  importAnalysisApi,
  chapterApi,
  versionsApi,
  notesApi,
} from "@/lib/api";
import { toast } from "sonner";
import LoadingState from "@/components/LoadingState";
import {
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wand2,
  Trash2,
  Archive,
  FileStack,
  Compass,
  ClipboardCheck,
  BookOpen,
  Users,
  BookMarked,
  X,
  Check,
  XCircle,
  ArrowLeft,
  Zap,
  Shield,
} from "lucide-react";

const ACTION_OPTIONS = [
  {
    id: "autoformat",
    label: "Auto-format manuscript",
    description: "Clean up spacing, paragraphs, and headings",
    icon: Wand2,
    category: "formatting",
  },
  {
    id: "remove_notes",
    label: "Remove all notes",
    description: "Strip inline notes, comments, and annotations",
    icon: Trash2,
    category: "notes",
  },
  {
    id: "store_notes",
    label: "Store notes separately",
    description: "Pull notes out and pin them to the chapter",
    icon: Archive,
    category: "notes",
  },
  {
    id: "convert_notes",
    label: "Convert notes to metadata",
    description: "Sort notes into chapter, revision, and intent fields",
    icon: FileStack,
    category: "notes",
  },
  {
    id: "split_chapters",
    label: "Split into chapters",
    description:
      "Find the chapter breaks and split this into separate chapters (works best with full manuscript imports)",
    icon: BookOpen,
    category: "structure",
  },
  {
    id: "lantern_path",
    label: "Apply Lantern Path structure",
    description:
      "Map each chapter to Spark, Exploration, Lantern Moment, Application, Resolution",
    icon: Compass,
    category: "structure",
  },
  {
    id: "full_qa",
    label: "Run a full QA read",
    description: "Read for tone, character, pacing, and continuity",
    icon: ClipboardCheck,
    category: "analysis",
  },
  {
    id: "extract_summaries",
    label: "Extract chapter summaries",
    description: "Write a two-sentence summary for each chapter",
    icon: FileText,
    category: "extraction",
  },
  {
    id: "extract_characters",
    label: "Extract character list",
    description: "Pull out who's in this — names, roles, and what's known",
    icon: Users,
    category: "extraction",
  },
  {
    id: "extract_glossary",
    label: "Extract glossary terms",
    description: "Catalog the terms, places, and ideas worth tracking",
    icon: BookMarked,
    category: "extraction",
  },
];

// Actions to run for "Fix everything I can"
const FIX_EVERYTHING_ACTIONS = [
  "autoformat",
  "store_notes",
  "split_chapters",
  "full_qa",
];

export default function ImportAnalysisDialog({
  open,
  onOpenChange,
  content,
  filename,
  projectId,
  chapterId,
  onActionComplete,
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [executingAction, setExecutingAction] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [implementing, setImplementing] = useState(false);
  const [fixingEverything, setFixingEverything] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [fixResults, setFixResults] = useState([]);

  // Auto-analyze when dialog opens with content
  useEffect(() => {
    if (open && content && !analysis && !analyzing) {
      handleAnalyze();
    }
  }, [open, content]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAnalysis(null);
      setActionResult(null);
      setFixResults([]);
      setFixProgress(0);
    }
  }, [open]);

  const handleAnalyze = async () => {
    if (!content) return;

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const res = await importAnalysisApi.analyze(
        content,
        filename,
        projectId,
        chapterId,
      );
      setAnalysis(res.data);

      // Snapshot the imported content as it arrived
      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: "As imported",
            created_by: "thad",
          });
        } catch (e) {
          console.error("Failed to create import version:", e);
        }
      }
    } catch (error) {
      toast.error("Couldn't read it just now. Try again?");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteAction = async (actionId) => {
    setExecutingAction(actionId);
    setActionResult(null);

    try {
      const res = await importAnalysisApi.executeAction(
        actionId,
        content,
        projectId,
        chapterId,
      );
      setActionResult({ action: actionId, response: res.data.response });
    } catch (error) {
      toast.error("That didn't go through. Try again?");
      console.error(error);
    } finally {
      setExecutingAction(null);
    }
  };

  const handleFixEverything = async () => {
    setFixingEverything(true);
    setFixResults([]);
    setFixProgress(0);

    const totalActions = FIX_EVERYTHING_ACTIONS.length + 3;
    let completedActions = 0;
    const results = [];

    try {
      // Step 1: Snapshot the starting state
      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: "Before Thad's read",
            created_by: "thad",
          });
          results.push({
            action: "backup",
            success: true,
            message: "Saved a copy of where it started",
          });
        } catch (e) {
          results.push({
            action: "backup",
            success: false,
            message: "Couldn't save a starting copy",
          });
        }
      }
      completedActions++;
      setFixProgress((completedActions / totalActions) * 100);

      // Step 2: Run each fix action
      for (const actionId of FIX_EVERYTHING_ACTIONS) {
        try {
          // Special handling for split_chapters
          if (actionId === "split_chapters" && projectId) {
            console.log(
              `[FixEverything] Calling splitAndCreateChapters with ${content?.length || 0} characters`,
            );
            console.log(
              `[FixEverything] Content preview: ${content?.substring(0, 200)}...`,
            );
            const splitRes = await importAnalysisApi.splitAndCreateChapters(
              content,
              projectId,
              null,
            );
            console.log(`[FixEverything] Split result:`, splitRes.data);
            if (splitRes.data?.chapters_created > 1) {
              results.push({
                action: actionId,
                success: true,
                message: `Split into ${splitRes.data.chapters_created} chapters`,
                response: `Chapters created: ${splitRes.data.chapters.map((c) => c.title).join(", ")}`,
                chaptersCreated: splitRes.data.chapters,
              });
            } else if (splitRes.data?.chapters_created === 1) {
              results.push({
                action: actionId,
                success: true,
                message: "Reads as one chapter",
                response:
                  "No clear chapter breaks in this content. If this is one chapter already, that's expected.",
              });
            } else {
              results.push({
                action: actionId,
                success: true,
                message: "No chapter breaks found",
                response: "Reads as one chapter.",
              });
            }
          } else {
            const res = await importAnalysisApi.executeAction(
              actionId,
              content,
              projectId,
              chapterId,
            );
            results.push({
              action: actionId,
              success: true,
              message:
                ACTION_OPTIONS.find((a) => a.id === actionId)?.label ||
                actionId,
              response: res.data.response,
            });
          }

          // If store_notes and we have notes detected, save them
          if (
            actionId === "store_notes" &&
            analysis?.notes_detected?.length > 0 &&
            chapterId
          ) {
            for (const note of analysis.notes_detected.slice(0, 10)) {
              try {
                await notesApi.create({
                  parent_type: "chapter",
                  parent_id: chapterId,
                  note_text: note,
                  note_type: "comment",
                  location_reference: "Pulled from import",
                });
              } catch (e) {
                // Continue even if note creation fails
              }
            }
          }
        } catch (e) {
          console.error(`Action ${actionId} failed:`, e);
          results.push({
            action: actionId,
            success: false,
            message:
              ACTION_OPTIONS.find((a) => a.id === actionId)?.label || actionId,
          });
        }
        completedActions++;
        setFixProgress((completedActions / totalActions) * 100);
      }

      // Step 3: Snapshot the ending state
      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: "After Thad's read",
            created_by: "thad",
          });
          results.push({
            action: "final_version",
            success: true,
            message: "Saved a copy of where it ended up",
          });
        } catch (e) {
          results.push({
            action: "final_version",
            success: false,
            message: "Couldn't save the ending copy",
          });
        }
      }
      completedActions++;
      setFixProgress(100);

      setFixResults(results);

      const successCount = results.filter((r) => r.success).length;
      const chaptersCreated =
        results.find((r) => r.chaptersCreated)?.chaptersCreated?.length || 0;

      if (chaptersCreated > 0) {
        toast.success(`Done. Split into ${chaptersCreated} chapters.`);
      } else {
        toast.success(
          `Done. ${successCount} of ${results.length} went through.`,
        );
      }

      if (onActionComplete) {
        onActionComplete("fix_everything", results, true);
      }
    } catch (error) {
      toast.error("Hit a snag part-way through.");
      console.error(error);
    } finally {
      setFixingEverything(false);
    }
  };

  const handleImplement = async () => {
    if (!actionResult) return;

    setImplementing(true);

    try {
      const actionId = actionResult.action;

      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: `Before "${ACTION_OPTIONS.find((a) => a.id === actionId)?.label || actionId}"`,
            created_by: "thad",
          });
        } catch (e) {
          console.error("Failed to create pre-action version:", e);
        }
      }

      const contentModifyingActions = ["autoformat", "remove_notes"];
      const notesActions = ["store_notes", "convert_notes"];

      if (contentModifyingActions.includes(actionId) && chapterId) {
        const res = await importAnalysisApi.implementAction(
          actionId,
          content,
          chapterId,
          projectId,
          null,
        );

        if (res.data.chapter_updated) {
          toast.success("Applied.");
          if (onActionComplete) {
            onActionComplete(actionId, res.data, true);
          }
        } else {
          toast.info("Nothing changed.");
        }
      } else if (notesActions.includes(actionId) && chapterId) {
        const notesToSave =
          actionId === "store_notes" ? analysis?.notes_detected : null;

        const res = await importAnalysisApi.implementAction(
          actionId,
          content,
          chapterId,
          projectId,
          notesToSave,
        );

        if (res.data.notes_created > 0) {
          toast.success(`Pinned ${res.data.notes_created} notes to this chapter.`);
        } else {
          toast.info("Nothing to pin.");
        }

        if (onActionComplete) {
          onActionComplete(actionId, res.data, true);
        }
      } else if (actionId === "split_chapters" && projectId) {
        toast.success(
          "Split suggestions saved. Create the chapters from the manuscript view when you're ready.",
        );
        if (onActionComplete) {
          onActionComplete(actionId, actionResult.response, true);
        }
      } else if (actionId === "full_qa") {
        toast.success("Saved the read for later.");
        if (onActionComplete) {
          onActionComplete(actionId, actionResult.response, true);
        }
      } else {
        toast.success("Done.");
        if (onActionComplete) {
          onActionComplete(actionId, actionResult.response, true);
        }
      }

      setActionResult(null);
    } catch (error) {
      toast.error(
        "Couldn't apply that: " +
          (error.response?.data?.detail || error.message),
      );
      console.error(error);
    } finally {
      setImplementing(false);
    }
  };

  const handleIgnore = () => {
    toast.info("Set aside.");

    if (onActionComplete) {
      onActionComplete(actionResult?.action, actionResult?.response, false);
    }

    setActionResult(null);
  };

  const handleClose = () => {
    setAnalysis(null);
    setActionResult(null);
    setFixResults([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="import-analysis-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-accent" />
            Reading what you brought in
          </DialogTitle>
          <DialogDescription>
            Here's what I see. Decide what to do with each.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Analysis Panel */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {!analysis && !analyzing && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Ready when you are.
                </p>
                <Button
                  onClick={handleAnalyze}
                  className="rounded-sm"
                  data-testid="start-analysis-btn"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Read it
                </Button>
              </div>
            )}

            {analyzing && (
              <LoadingState
                size="panel"
                title="Reading what you brought in."
                body="Looking for structure, notes, and anything worth flagging before we get to work."
                testId="loading-import-analysis"
              />
            )}

            {fixingEverything && (
              <div className="flex-1 flex flex-col items-center justify-center px-8">
                <Zap className="h-12 w-12 text-accent mb-4 animate-pulse" />
                <p className="font-medium mb-2">
                  Working through it.
                </p>
                <Progress
                  value={fixProgress}
                  className="w-full max-w-md h-2 mb-4"
                />
                <p className="text-sm text-muted-foreground">
                  {fixProgress < 100
                    ? "Working."
                    : "Almost done."}
                </p>
              </div>
            )}

            {fixResults.length > 0 && !fixingEverything && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 pr-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Done</span>
                  </div>

                  <div className="space-y-2">
                    {fixResults.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 p-2 rounded-sm ${
                          result.success
                            ? "bg-green-50 border border-green-200"
                            : "bg-red-50 border border-red-200"
                        }`}
                      >
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="text-sm">{result.message}</span>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  <Button onClick={handleClose} className="w-full rounded-sm">
                    Close
                  </Button>
                </div>
              </ScrollArea>
            )}

            {analysis &&
              !actionResult &&
              !fixingEverything &&
              fixResults.length === 0 && (
                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-4 pr-4">
                    {/* Quick Stats */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline" className="text-sm">
                        {analysis.word_count?.toLocaleString() || 0} words
                      </Badge>
                      <Badge variant="outline" className="text-sm">
                        {analysis.estimated_reading_level || "Unknown"}
                      </Badge>
                      {analysis.detected_chapters_count > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-sm bg-blue-100 text-blue-800"
                        >
                          <BookOpen className="h-3 w-3 mr-1" />
                          {analysis.detected_chapters_count} chapters
                        </Badge>
                      )}
                      {analysis.notes_detected?.length > 0 && (
                        <Badge variant="secondary" className="text-sm">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {analysis.notes_detected.length} notes spotted
                        </Badge>
                      )}
                    </div>

                    {/* Detected Chapters Preview */}
                    {analysis.detected_chapters_count > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          Found {analysis.detected_chapters_count} chapters
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {analysis.detected_chapters_preview
                            ?.slice(0, 10)
                            .map((ch, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                {ch}
                              </Badge>
                            ))}
                          {analysis.detected_chapters_count > 10 && (
                            <Badge
                              variant="outline"
                              className="text-xs text-muted-foreground"
                            >
                              +{analysis.detected_chapters_count - 10} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Analysis Content */}
                    <div
                      className="ai-response prose prose-sm max-w-full whitespace-pre-wrap break-words overflow-x-hidden"
                      data-testid="analysis-content"
                    >
                      {analysis.analysis}
                    </div>

                    {/* Notes Detected */}
                    {analysis.notes_detected?.length > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-sm">
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          Notes I spotted
                        </h4>
                        <ul className="text-sm space-y-1">
                          {analysis.notes_detected
                            .slice(0, 5)
                            .map((note, i) => (
                              <li
                                key={i}
                                className="text-muted-foreground font-mono text-xs"
                              >
                                {note}
                              </li>
                            ))}
                          {analysis.notes_detected.length > 5 && (
                            <li className="text-muted-foreground text-xs">
                              ...and {analysis.notes_detected.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}

            {actionResult && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 pr-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                      {ACTION_OPTIONS.find((a) => a.id === actionResult.action)
                        ?.label || actionResult.action}
                    </span>
                  </div>

                  <Separator />

                  <div
                    className="ai-response prose prose-sm max-w-none whitespace-pre-wrap break-words overflow-x-hidden"
                    data-testid="action-result"
                  >
                    {actionResult.response}
                  </div>

                  <Separator />

                  <div className="sticky bottom-0 bg-background pt-2 pb-1">
                    <p className="text-sm text-muted-foreground mb-3">
                      Apply these, or set them aside?
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleImplement}
                        disabled={implementing}
                        className="flex-1 rounded-sm bg-green-600 hover:bg-green-700"
                        data-testid="implement-action-btn"
                      >
                        {implementing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Apply
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleIgnore}
                        disabled={implementing}
                        className="flex-1 rounded-sm"
                        data-testid="ignore-action-btn"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Set aside
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setActionResult(null)}
                      className="w-full mt-2 rounded-sm text-muted-foreground"
                      disabled={implementing}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Actions Panel */}
          {analysis &&
            !actionResult &&
            !fixingEverything &&
            fixResults.length === 0 && (
              <div className="w-80 min-w-0 shrink-0 self-stretch border-l border-border pl-4 flex flex-col min-h-0 overflow-hidden">
                <div className="shrink-0">
                  <h3 className="font-medium text-sm mb-3">What to do</h3>

                  <Button
                    onClick={handleFixEverything}
                    disabled={executingAction !== null}
                    className="w-full mb-3 rounded-sm bg-gradient-to-r from-accent to-orange-500 hover:from-accent/90 hover:to-orange-500/90"
                    data-testid="fix-everything-btn"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Fix everything I can
                  </Button>

                  <p className="text-xs text-muted-foreground mb-3">
                    Or pick what to do, one at a time:
                  </p>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {ACTION_OPTIONS.map((action) => {
                      const isRecommended =
                        analysis.recommended_actions?.includes(action.id);
                      const isExecuting = executingAction === action.id;

                      return (
                        <button
                          key={action.id}
                          onClick={() => handleExecuteAction(action.id)}
                          disabled={executingAction !== null}
                          className={`w-full text-left p-3 rounded-sm border transition-colors ${
                            isRecommended
                              ? "border-accent bg-accent/5 hover:bg-accent/10"
                              : "border-border hover:bg-muted"
                          } ${executingAction ? "opacity-50" : ""}`}
                          data-testid={`action-${action.id}`}
                        >
                          <div className="flex items-start gap-2">
                            {isExecuting ? (
                              <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-accent" />
                            ) : (
                              <action.icon
                                className={`h-4 w-4 mt-0.5 ${isRecommended ? "text-accent" : "text-muted-foreground"}`}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium ${isRecommended ? "text-accent" : ""}`}
                              >
                                {action.label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {action.description}
                              </p>
                              {isRecommended && (
                                <Badge
                                  variant="secondary"
                                  className="mt-1 text-xs"
                                >
                                  My pick
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    <button
                      onClick={handleClose}
                      className="w-full text-left p-3 rounded-sm border border-border hover:bg-muted"
                      data-testid="action-nothing"
                    >
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Leave it</p>
                          <p className="text-xs text-muted-foreground">
                            Close this and keep writing
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
