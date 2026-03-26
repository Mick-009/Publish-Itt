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
import { importAnalysisApi, chapterApi, versionsApi, notesApi } from "@/lib/api";
import { toast } from "sonner";
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
  Shield
} from "lucide-react";

const ACTION_OPTIONS = [
  {
    id: "autoformat",
    label: "Auto-format Manuscript",
    description: "Normalize spacing, fix paragraphs, standardize headings",
    icon: Wand2,
    category: "formatting"
  },
  {
    id: "remove_notes",
    label: "Remove All Notes",
    description: "Remove inline notes, comments, and annotations",
    icon: Trash2,
    category: "notes"
  },
  {
    id: "store_notes",
    label: "Store Notes Separately",
    description: "Extract notes to the Notes Collection",
    icon: Archive,
    category: "notes"
  },
  {
    id: "convert_notes",
    label: "Convert Notes to Metadata",
    description: "Transform notes into chapter_notes, revision_notes, author_intent",
    icon: FileStack,
    category: "notes"
  },
  {
    id: "split_chapters",
    label: "Split into Chapters",
    description: "Detect chapter breaks and create separate Chapter records (works best with full manuscript imports)",
    icon: BookOpen,
    category: "structure"
  },
  {
    id: "lantern_path",
    label: "Apply Lantern Path Structure",
    description: "Map each chapter to Spark, Exploration, Lantern Moment, Application, Resolution",
    icon: Compass,
    category: "structure"
  },
  {
    id: "full_qa",
    label: "Run Full QA",
    description: "Check tone, lore, character, pacing, and get a readiness score",
    icon: ClipboardCheck,
    category: "analysis"
  },
  {
    id: "extract_summaries",
    label: "Extract Chapter Summaries",
    description: "Generate 2-3 sentence summary for each chapter",
    icon: FileText,
    category: "extraction"
  },
  {
    id: "extract_characters",
    label: "Extract Character List",
    description: "Extract all character names, roles, and descriptions",
    icon: Users,
    category: "extraction"
  },
  {
    id: "extract_glossary",
    label: "Extract Glossary Terms",
    description: "Extract unique terms, locations, symbols, and concepts",
    icon: BookMarked,
    category: "extraction"
  }
];

// Actions to run for "Fix Everything" - now includes split_chapters
const FIX_EVERYTHING_ACTIONS = ["autoformat", "store_notes", "split_chapters", "full_qa"];

export default function ImportAnalysisDialog({ 
  open, 
  onOpenChange, 
  content,
  filename,
  projectId,
  chapterId,
  onActionComplete 
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
      const res = await importAnalysisApi.analyze(content, filename, projectId, chapterId);
      setAnalysis(res.data);
      
      // Create a version snapshot labeled "Imported Raw"
      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: "Imported Raw",
            created_by: "thaddaeus"
          });
        } catch (e) {
          console.error("Failed to create import version:", e);
        }
      }
    } catch (error) {
      toast.error("Failed to analyze manuscript");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteAction = async (actionId) => {
    setExecutingAction(actionId);
    setActionResult(null);
    
    try {
      const res = await importAnalysisApi.executeAction(actionId, content, projectId, chapterId);
      setActionResult({ action: actionId, response: res.data.response });
    } catch (error) {
      toast.error("Failed to execute action");
      console.error(error);
    } finally {
      setExecutingAction(null);
    }
  };

  const handleFixEverything = async () => {
    setFixingEverything(true);
    setFixResults([]);
    setFixProgress(0);
    
    const totalActions = FIX_EVERYTHING_ACTIONS.length + 3; // +3 for version snapshots and chapter splitting
    let completedActions = 0;
    const results = [];

    try {
      // Step 1: Create backup version
      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: "Pre-FixEverything Backup",
            created_by: "thaddaeus"
          });
          results.push({ action: "backup", success: true, message: "Backup version created" });
        } catch (e) {
          results.push({ action: "backup", success: false, message: "Backup failed" });
        }
      }
      completedActions++;
      setFixProgress((completedActions / totalActions) * 100);

      // Step 2: Run each fix action
      for (const actionId of FIX_EVERYTHING_ACTIONS) {
        try {
          // Special handling for split_chapters - actually create the chapters
          if (actionId === "split_chapters" && projectId) {
            console.log(`[FixEverything] Calling splitAndCreateChapters with ${content?.length || 0} characters`);
            console.log(`[FixEverything] Content preview: ${content?.substring(0, 200)}...`);
            const splitRes = await importAnalysisApi.splitAndCreateChapters(content, projectId, null);
            console.log(`[FixEverything] Split result:`, splitRes.data);
            if (splitRes.data?.chapters_created > 1) {
              results.push({ 
                action: actionId, 
                success: true, 
                message: `Created ${splitRes.data.chapters_created} chapters`,
                response: `Chapters created: ${splitRes.data.chapters.map(c => c.title).join(", ")}`,
                chaptersCreated: splitRes.data.chapters
              });
            } else if (splitRes.data?.chapters_created === 1) {
              results.push({ 
                action: actionId, 
                success: true, 
                message: "Content is a single chapter",
                response: "No additional chapter breaks detected in this content. If you're analyzing an existing chapter, this is expected."
              });
            } else {
              results.push({ 
                action: actionId, 
                success: true, 
                message: "No chapter breaks detected",
                response: "Content appears to be a single chapter"
              });
            }
          } else {
            const res = await importAnalysisApi.executeAction(actionId, content, projectId, chapterId);
            results.push({ 
              action: actionId, 
              success: true, 
              message: ACTION_OPTIONS.find(a => a.id === actionId)?.label || actionId,
              response: res.data.response
            });
          }
          
          // If store_notes and we have notes detected, save them
          if (actionId === "store_notes" && analysis?.notes_detected?.length > 0 && chapterId) {
            for (const note of analysis.notes_detected.slice(0, 10)) {
              try {
                await notesApi.create({
                  parent_type: "chapter",
                  parent_id: chapterId,
                  note_text: note,
                  note_type: "comment",
                  location_reference: "Extracted from import"
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
            message: ACTION_OPTIONS.find(a => a.id === actionId)?.label || actionId
          });
        }
        completedActions++;
        setFixProgress((completedActions / totalActions) * 100);
      }

      // Step 3: Create final version snapshot
      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: "FixEverything Applied",
            created_by: "thaddaeus"
          });
          results.push({ action: "final_version", success: true, message: "Final version saved" });
        } catch (e) {
          results.push({ action: "final_version", success: false, message: "Final version failed" });
        }
      }
      completedActions++;
      setFixProgress(100);

      setFixResults(results);
      
      const successCount = results.filter(r => r.success).length;
      const chaptersCreated = results.find(r => r.chaptersCreated)?.chaptersCreated?.length || 0;
      
      if (chaptersCreated > 0) {
        toast.success(`Fix Everything completed! Created ${chaptersCreated} chapters`);
      } else {
        toast.success(`Fix Everything completed: ${successCount}/${results.length} actions successful`);
      }
      
      if (onActionComplete) {
        onActionComplete("fix_everything", results, true);
      }
    } catch (error) {
      toast.error("Fix Everything encountered an error");
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
      
      // Create a version snapshot before implementing
      if (chapterId) {
        try {
          await versionsApi.create({
            parent_type: "chapter",
            parent_id: chapterId,
            content_snapshot: content,
            label: `Before: ${ACTION_OPTIONS.find(a => a.id === actionId)?.label || actionId}`,
            created_by: "thaddaeus"
          });
        } catch (e) {
          console.error("Failed to create pre-action version:", e);
        }
      }

      // Actions that modify chapter content directly
      const contentModifyingActions = ["autoformat", "remove_notes"];
      
      // Actions that create notes
      const notesActions = ["store_notes", "convert_notes"];
      
      if (contentModifyingActions.includes(actionId) && chapterId) {
        // Call the implement endpoint to apply changes
        const res = await importAnalysisApi.implementAction(
          actionId,
          content,
          chapterId,
          projectId,
          null
        );
        
        if (res.data.chapter_updated) {
          toast.success(`${ACTION_OPTIONS.find(a => a.id === actionId)?.label} applied successfully!`);
          
          // Notify parent to refresh content
          if (onActionComplete) {
            onActionComplete(actionId, res.data, true);
          }
        } else {
          toast.info("No changes were applied.");
        }
      } else if (notesActions.includes(actionId) && chapterId) {
        // For store_notes, pass the detected notes to be saved
        const notesToSave = actionId === "store_notes" ? analysis?.notes_detected : null;
        
        const res = await importAnalysisApi.implementAction(
          actionId,
          content,
          chapterId,
          projectId,
          notesToSave
        );
        
        if (res.data.notes_created > 0) {
          toast.success(`Saved ${res.data.notes_created} notes to Notes Collection`);
        } else {
          toast.info("No notes were saved.");
        }
        
        if (onActionComplete) {
          onActionComplete(actionId, res.data, true);
        }
      } else if (actionId === "split_chapters" && projectId) {
        // Split chapters is handled separately
        toast.success("Chapter split suggestions saved. Create chapters from the Manuscript workspace.");
        if (onActionComplete) {
          onActionComplete(actionId, actionResult.response, true);
        }
      } else if (actionId === "full_qa") {
        toast.success("QA report saved for reference.");
        if (onActionComplete) {
          onActionComplete(actionId, actionResult.response, true);
        }
      } else {
        // For other actions, just notify completion
        toast.success("Changes processed successfully!");
        if (onActionComplete) {
          onActionComplete(actionId, actionResult.response, true);
        }
      }
      
      setActionResult(null);
      
    } catch (error) {
      toast.error("Failed to implement changes: " + (error.response?.data?.detail || error.message));
      console.error(error);
    } finally {
      setImplementing(false);
    }
  };

  const handleIgnore = () => {
    toast.info("Changes ignored");
    
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh]" data-testid="import-analysis-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-accent" />
            THADDAEUS Import Wizard
          </DialogTitle>
          <DialogDescription>
            Your manuscript has been analyzed. Choose actions to clean up and structure your content.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 h-[600px]">
          {/* Analysis Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!analysis && !analyzing && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Ready to analyze your manuscript</p>
                <Button onClick={handleAnalyze} className="rounded-sm" data-testid="start-analysis-btn">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Manuscript
                </Button>
              </div>
            )}

            {analyzing && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-accent mb-4" />
                <p className="text-muted-foreground">THADDAEUS is analyzing your manuscript...</p>
                <p className="text-sm text-muted-foreground mt-2">Detecting structure, notes, and formatting issues</p>
              </div>
            )}

            {fixingEverything && (
              <div className="flex-1 flex flex-col items-center justify-center px-8">
                <Zap className="h-12 w-12 text-accent mb-4 animate-pulse" />
                <p className="font-medium mb-2">Fix Everything in Progress...</p>
                <Progress value={fixProgress} className="w-full max-w-md h-2 mb-4" />
                <p className="text-sm text-muted-foreground">
                  {fixProgress < 100 ? "Running automated fixes..." : "Completing..."}
                </p>
              </div>
            )}

            {fixResults.length > 0 && !fixingEverything && (
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Fix Everything Complete</span>
                  </div>
                  
                  <div className="space-y-2">
                    {fixResults.map((result, index) => (
                      <div 
                        key={index}
                        className={`flex items-center gap-2 p-2 rounded-sm ${
                          result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
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
                    Done
                  </Button>
                </div>
              </ScrollArea>
            )}

            {analysis && !actionResult && !fixingEverything && fixResults.length === 0 && (
              <ScrollArea className="flex-1">
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
                      <Badge variant="secondary" className="text-sm bg-blue-100 text-blue-800">
                        <BookOpen className="h-3 w-3 mr-1" />
                        {analysis.detected_chapters_count} chapters detected
                      </Badge>
                    )}
                    {analysis.notes_detected?.length > 0 && (
                      <Badge variant="secondary" className="text-sm">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {analysis.notes_detected.length} notes found
                      </Badge>
                    )}
                  </div>

                  {/* Detected Chapters Preview */}
                  {analysis.detected_chapters_count > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        Chapters Detected ({analysis.detected_chapters_count})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {analysis.detected_chapters_preview?.slice(0, 10).map((ch, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {ch}
                          </Badge>
                        ))}
                        {analysis.detected_chapters_count > 10 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            +{analysis.detected_chapters_count - 10} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Analysis Content */}
                  <div className="ai-response prose prose-sm max-w-none whitespace-pre-wrap" data-testid="analysis-content">
                    {analysis.analysis}
                  </div>

                  {/* Notes Detected */}
                  {analysis.notes_detected?.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-sm">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        Notes Detected
                      </h4>
                      <ul className="text-sm space-y-1">
                        {analysis.notes_detected.slice(0, 5).map((note, i) => (
                          <li key={i} className="text-muted-foreground font-mono text-xs">
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
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  {/* Action Header */}
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                      {ACTION_OPTIONS.find(a => a.id === actionResult.action)?.label || actionResult.action}
                    </span>
                  </div>
                  
                  <Separator />
                  
                  {/* Action Result Content */}
                  <div className="ai-response prose prose-sm max-w-none whitespace-pre-wrap" data-testid="action-result">
                    {actionResult.response}
                  </div>
                  
                  <Separator />
                  
                  {/* Implement or Ignore Options */}
                  <div className="sticky bottom-0 bg-background pt-2 pb-1">
                    <p className="text-sm text-muted-foreground mb-3">
                      Would you like to implement these changes or ignore them?
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
                        Implement Changes
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleIgnore}
                        disabled={implementing}
                        className="flex-1 rounded-sm"
                        data-testid="ignore-action-btn"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Ignore
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setActionResult(null)}
                      className="w-full mt-2 rounded-sm text-muted-foreground"
                      disabled={implementing}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Actions
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Actions Panel */}
          {analysis && !actionResult && !fixingEverything && fixResults.length === 0 && (
            <div className="w-80 border-l border-border pl-4 flex flex-col overflow-hidden">
              <div className="shrink-0">
                <h3 className="font-medium text-sm mb-3">Actions</h3>
                
                {/* Fix Everything Button */}
                <Button
                  onClick={handleFixEverything}
                  disabled={executingAction !== null}
                  className="w-full mb-3 rounded-sm bg-gradient-to-r from-accent to-orange-500 hover:from-accent/90 hover:to-orange-500/90"
                  data-testid="fix-everything-btn"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Fix Everything Automatically
                </Button>
                
                <p className="text-xs text-muted-foreground mb-3">
                  Or choose individual actions below:
                </p>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-2">
                  {ACTION_OPTIONS.map((action) => {
                    const isRecommended = analysis.recommended_actions?.includes(action.id);
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
                            <action.icon className={`h-4 w-4 mt-0.5 ${isRecommended ? "text-accent" : "text-muted-foreground"}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isRecommended ? "text-accent" : ""}`}>
                              {action.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {action.description}
                            </p>
                            {isRecommended && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  
                  {/* Do Nothing Option */}
                  <button
                    onClick={handleClose}
                    className="w-full text-left p-3 rounded-sm border border-border hover:bg-muted"
                    data-testid="action-nothing"
                  >
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Do Nothing</p>
                        <p className="text-xs text-muted-foreground">Close and continue editing</p>
                      </div>
                    </div>
                  </button>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
