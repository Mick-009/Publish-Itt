import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { aiApi, notesApi, importAnalysisApi, thadApi } from "@/lib/api";
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
  Pencil,
  History,
  Bookmark,
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
    label: "Tone & style",
    icon: Palette,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  notes: {
    label: "Notes found",
    icon: StickyNote,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  chapters: {
    label: "Chapter breaks",
    icon: ListChecks,
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  },
  issues: {
    label: "Issues",
    icon: AlertTriangle,
    color: "bg-red-500/10 text-red-600 border-red-500/20",
  },
};

// Try to parse Thad's regen response as JSON in the analysis shape.
// Falls back to a single tone_analysis blob if parsing fails — at least
// the writer sees what Thad said.
function parseAnalysisRegenResponse(text) {
  if (!text) return null;
  // Strip code fences if Thad wrapped the JSON in them
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
  }
  // Pull the first {...} block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      tone_analysis: cleaned,
      style_analysis: "",
      suggestions: [],
      reading_level: "",
    };
  }
  try {
    const parsed = JSON.parse(match[0]);
    return {
      tone_analysis: parsed.tone_analysis || "",
      style_analysis: parsed.style_analysis || "",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      reading_level: parsed.reading_level || "",
    };
  } catch {
    return {
      tone_analysis: cleaned,
      style_analysis: "",
      suggestions: [],
      reading_level: "",
    };
  }
}

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

  // Phase 2: project-wide standing notes
  const [styleNotes, setStyleNotes] = useState([]);
  const [styleNotesOpen, setStyleNotesOpen] = useState(false);

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
          "Give me more to work with — a few sentences at least.",
        style_analysis:
          "Style read needs more on the page.",
        suggestions: [
          "Start writing, or paste something in",
          "At least a paragraph so I have something to chew on",
        ],
        reading_level: "Not yet",
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
    } catch (error) {
      console.error("Tone analysis failed:", error);
      toast.error("Couldn't read it just now. Try again?");
      // Fallback in voice — used when the API is unreachable.
      setToneStyleData({
        tone_analysis:
          "Couldn't get through. Try again?",
        style_analysis: "Style read unavailable.",
        suggestions: [
          "Try again",
          "Look at what's on the page",
        ],
        reading_level: "Not yet",
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

  // Phase 2: load revisions for this chapter, and project-wide style notes
  useEffect(() => {
    if (!chapterId || !projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await thadApi.getRevisions(
          "analysis",
          chapterId,
          projectId,
        );
        if (!cancelled) setRevisions(res.data || []);
      } catch (err) {
        // Silent: empty history is the same as a missing one for the UI.
        console.warn("Couldn't load revisions:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterId, projectId]);

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
    if (!chapterId || !projectId) {
      toast.error("Open a chapter first.");
      return;
    }
    if (!toneStyleData) {
      toast.error("Nothing to push back on yet.");
      return;
    }

    setPushbackSubmitting(true);
    try {
      // The backend wants the previous response as a string. We send the
      // current displayed analysis as JSON so Thad can match the shape.
      const previousResponse = JSON.stringify({
        tone_analysis: toneStyleData.tone_analysis || "",
        style_analysis: toneStyleData.style_analysis || "",
        suggestions: toneStyleData.suggestions || [],
        reading_level: toneStyleData.reading_level || "",
      });

      const res = await thadApi.regenerate(
        "analysis",
        chapterId,
        projectId,
        feedback,
        previousResponse,
      );

      const parsed = parseAnalysisRegenResponse(res.data.thad_response);
      if (parsed) {
        setToneStyleData(parsed);
        setLastAnalyzed(Date.now());
      }

      // Track this revision for the save-as-note prompt
      setLastRevisionId(res.data.revision_id);
      setLastFeedback(feedback);
      setSavePromptOpen(true);

      // Refresh the history list
      try {
        const histRes = await thadApi.getRevisions(
          "analysis",
          chapterId,
          projectId,
        );
        setRevisions(histRes.data || []);
      } catch {
        /* non-fatal */
      }

      // Close the composer
      setPushbackText("");
      setPushbackOpen(false);
    } catch (err) {
      console.error("Pushback failed:", err);
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

  // Detailed Import Analysis (existing functionality)
  const runDetailedAnalysis = async () => {
    if (!content || content.trim().length < 50) {
      toast.error("Not enough on the page for a deep read.");
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
                  ? "Structure issue"
                  : issue.title || "Structure issue",
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
                  ? "Formatting issue"
                  : issue.title || "Formatting issue",
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
              title: "Note found",
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
                  ? "Style issue"
                  : issue.title || "Style issue",
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
                  ? "Lore issue"
                  : issue.title || "Lore issue",
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
            title: "Word count",
            description: `Total words: ${data.word_count.toLocaleString()}`,
            severity: "info",
          });
        }
      }

      setFindings(analysisFindings);
      setDismissedIds(new Set());
      setShowDetailedAnalysis(true);

      if (analysisFindings.length > 0) {
        toast.success(`Found ${analysisFindings.length} to look at.`);
      } else {
        toast.success("Nothing to flag.");
      }
    } catch (error) {
      console.error("Detailed analysis failed:", error);
      toast.error("Couldn't run the deep read. Try again?");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyChange = async (finding) => {
    if (finding.applyAction && onApplyChange) {
      if (onCreateVersion) {
        await onCreateVersion(`Before ${finding.title.toLowerCase()}`);
      }
      onApplyChange(finding.applyAction);
      setDismissedIds((prev) => new Set([...prev, finding.id]));
      toast.success("Applied.");
    }
  };

  const handleSaveToNotes = async (finding) => {
    if (!chapterId) {
      toast.error("No chapter open.");
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
      toast.success("Pinned.");
    } catch (error) {
      toast.error("Couldn't pin it. Try again?");
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
          <span className="text-sm font-medium">Tone & style</span>
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

      {/* Regen loading state — different copy, signals it's a revision */}
      {pushbackSubmitting && (
        <LoadingState
          size="panel"
          title="Thinking it over."
          body="Looking at it again with your read in mind."
          testId="loading-analyzer-regen"
        />
      )}

      {/* Tone & Style Analysis Results */}
      {toneStyleData && !toneStyleLoading && !pushbackSubmitting && (
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
                  Tone
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
                  Style
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
                  Reading level:
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
                      A few suggestions
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

            {/* Push-back affordance */}
            {!pushbackOpen && (
              <div className="flex items-center justify-between pt-1">
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
                {lastAnalyzed && (
                  <div className="text-[10px] text-muted-foreground">
                    Last read: {new Date(lastAnalyzed).toLocaleTimeString()}
                  </div>
                )}
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

            {/* Save-as-style-note prompt — appears once after a regen */}
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
                        Earlier{" "}
                        {revisions.length === 1 ? "take" : "takes"} (
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

            <Separator className="my-4" />

            {/* Detailed Analysis Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Deeper read
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
                      Reading.
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Go deeper
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
                                          Pin
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
                  Nothing flagged. Reads clean.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Initial State - No Analysis Yet */}
      {!toneStyleData && !toneStyleLoading && !pushbackSubmitting && (
        <EmptyState
          size="panel"
          art={<AnalyzeLoopArt size={72} />}
          title="Want a closer read?"
          body="I'll look at tone, pacing, and style — and tell you what's working and what isn't."
          primaryAction={{
            label: "Read this chapter",
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
