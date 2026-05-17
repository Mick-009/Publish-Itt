import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  projectApi,
  chapterApi,
  aiApi,
  uploadApi,
  versionsApi,
  statsApi,
} from "@/lib/api";
import { cn, formatWordCount } from "@/lib/utils";
import { toast } from "sonner";
import ImportAnalysisDialog from "@/components/ImportAnalysisDialog";
import VersionsPanel from "@/components/VersionsPanel";
import NotesPanel from "@/components/NotesPanel";
import WritingStatsPanel from "@/components/WritingStatsPanel";
import AnalyzerPanel from "@/components/AnalyzerPanel";
import WorkflowPanel from "@/components/WorkflowPanel";
import ThadChatPanel from "@/components/ThadChatPanel";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import {
  BlankPageArt,
  ChapterStackArt,
  QuillMarkArt,
} from "@/components/EmptyStateArt";
import { useChapterAutosave } from "@/hooks/useChapterAutosave";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Save,
  Wand2,
  FileText,
  ListOrdered,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Bold,
  Italic,
  List,
  ListOrderedIcon,
  Quote,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Trash2,
  Copy,
  Pencil,
  Upload,
  FileUp,
  X,
  BookX,
  Sparkles,
  History,
  StickyNote,
  BookOpen,
  Clock,
  GitBranch,
  BarChart3,
  Zap,
  Check,
  Workflow,
  Download,
  FileDown,
  MessageSquare,
} from "lucide-react";

export default function ManuscriptWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ── Project / chapter state ──────────────────────────────────────────────
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Layout state ─────────────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("manuscriptSidebarCollapsed");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(() => {
    const saved = localStorage.getItem("manuscriptAiPanelCollapsed");
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem(
      "manuscriptSidebarCollapsed",
      JSON.stringify(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      "manuscriptAiPanelCollapsed",
      JSON.stringify(aiPanelCollapsed),
    );
  }, [aiPanelCollapsed]);

  const [focusMode, setFocusMode] = useState(false);
  const [showFocusToolbar, setShowFocusToolbar] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setFocusMode(false);
        setShowFocusToolbar(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── AI state ─────────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiOriginalText, setAiOriginalText] = useState("");
  const [aiResponseType, setAiResponseType] = useState(null); // 'rewrite', 'summarize', 'outline', etc.
  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState(null);
  const [applyingAi, setApplyingAi] = useState(false);

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineCount, setOutlineCount] = useState(10);
  const [renameChapterOpen, setRenameChapterOpen] = useState(false);
  const [renameChapterTitle, setRenameChapterTitle] = useState("");
  const [deleteManuscriptOpen, setDeleteManuscriptOpen] = useState(false);
  const [deleteChapterOpen, setDeleteChapterOpen] = useState(false);

  // ── Upload state ─────────────────────────────────────────────────────────
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadChapterTitle, setUploadChapterTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── Import Analysis state ────────────────────────────────────────────────
  const [importAnalysisOpen, setImportAnalysisOpen] = useState(false);
  const [importedContent, setImportedContent] = useState("");
  const [importedFilename, setImportedFilename] = useState("");

  // ── Writing stats tracking ───────────────────────────────────────────────
  // Logs sessions every 5 min via statsApi. Separate concern from autosave —
  // the autosave hook does NOT cover this.
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  const lastWordCountRef = useRef(0);
  const statsIntervalRef = useRef(null);

  // ── Export state ─────────────────────────────────────────────────────────
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("docx");
  const [exportIncludeTitlePage, setExportIncludeTitlePage] = useState(true);
  const [exportIncludeChapterNumbers, setExportIncludeChapterNumbers] =
    useState(true);
  const [exportAuthorOverride, setExportAuthorOverride] = useState("");

  // ── Autosave hook ────────────────────────────────────────────────────────
  // The hook is the sole owner of: saving / saveState / lastSavedAt /
  // autoVersionEnabled / autoVersionSaving / refreshVersionsTrigger, plus all
  // chapter-load detection, debounced persistence, in-flight queueing, and
  // the 10-minute auto-version snapshot loop.
  //
  // We need an editor instance to pass in, but useEditor's onUpdate also
  // needs to call back into the hook — so we stash the hook value in a ref
  // and the onUpdate closure reads through it.
  const autosaveRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start here.",
      }),
      CharacterCount,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      autosaveRef.current?.handleEditorUpdate(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection;

      if (empty || from === to) {
        setSelectedText("");
        setSelectedRange(null);
        return;
      }

      const text = editor.state.doc.textBetween(from, to, "\n").trim();

      if (!text) {
        setSelectedText("");
        setSelectedRange(null);
        return;
      }

      setSelectedText(editor.state.doc.textBetween(from, to, "\n").trim());
      setSelectedRange({ from, to });
    },
  });

  const autosave = useChapterAutosave({
    editor,
    selectedChapter,
    selectedProject,
  });

  // Keep the ref in sync each render so onUpdate sees the latest hook value.
  useEffect(() => {
    autosaveRef.current = autosave;
  });

  // One-time bridge: hand the hook our setState fns so it can reflect saved
  // chapters back into our local state after each persist.
  useEffect(() => {
    autosave.setExternalState(setChapters, setSelectedChapter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Selection / AI scratch reset on chapter change ───────────────────────
  useEffect(() => {
    if (!selectedChapter?.id) return;

    setSelectedText("");
    setSelectedRange(null);

    if (aiResponse) {
      setAiResponse("");
      setAiResponseType(null);
      // Silent on chapter change — no toast.
    }

    if (editor) {
      const pos = editor.state.selection.to;
      editor.commands.setTextSelection(pos);
    }

    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter?.id]);

  // ── AI target helpers ────────────────────────────────────────────────────
  const getAiTarget = () => {
    const hasSelection =
      !!selectedText?.trim() &&
      selectedRange &&
      typeof selectedRange.from === "number" &&
      typeof selectedRange.to === "number" &&
      selectedRange.from !== selectedRange.to;

    if (hasSelection) {
      return {
        mode: "selection",
        text: selectedText,
        range: selectedRange,
      };
    }

    return {
      mode: "chapter",
      text: editor?.getText?.().trim() || "",
      range: null,
    };
  };

  const chunkTextByParagraphs = (text, maxChars = 4000) => {
    const paragraphs = (text || "")
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const chunks = [];
    let currentChunk = "";

    paragraphs.forEach((paragraph) => {
      const nextChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;

      if (nextChunk.length <= maxChars) {
        currentChunk = nextChunk;
        return;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      currentChunk = paragraph;
    });

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  };

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setSelectedProject(project);
        loadChapters(projectId);
      }
    }
  }, [projectId, projects]);

  // ── Writing stats: log sessions only when real typing happens ────────────
  //
  // The autosave hook calls editor.commands.setContent(...) when you switch
  // chapters, which fires Tiptap's "update" event. That event looks identical
  // to typing from the listener's point of view — so we have to be careful
  // not to count programmatic content loads as writing.
  //
  // Approach:
  // - Reset the word-count baseline ourselves when the chapter changes,
  //   before any update events have a chance to fire.
  // - Threshold the per-event delta: anything bigger than TYPING_DELTA_LIMIT
  //   isn't typing, it's a content swap. Update the baseline silently and
  //   don't open a session.
  // - Only call logSession if a session was actually opened AND there are
  //   net-positive words. No typing, no log.
  //
  // The dep array is [editor, selectedChapter?.id] — passing the whole
  // chapter object would tear down and rebuild the effect on every chapter
  // metadata refresh from autosave, which was a contributing source of the
  // original bug.
  useEffect(() => {
    if (!editor || !selectedChapter) return;

    // Real typing events change the word count by at most a few words at a
    // time. Programmatic content loads (chapter switches, large pastes, AI
    // rewrites) change it by tens, hundreds, or thousands. 50 is a generous
    // ceiling for "this might still be typing" — a fast typist with auto-
    // correct can occasionally produce ~10-word jumps; nothing legitimate
    // produces 50+ word jumps in a single update event.
    const TYPING_DELTA_LIMIT = 50;

    // The minimum we'll bother logging: at least 5 words of net progress
    // or 60 seconds of held session time. Below that, it's not worth a
    // round-trip and not statistically meaningful.
    const MIN_WORDS_TO_LOG = 5;
    const MIN_SECONDS_TO_LOG = 60;

    // Reset our baseline explicitly when the chapter changes. The autosave
    // hook will swap the editor's content in a moment, which will fire an
    // update event — we want our baseline to already reflect that target
    // word count, not the previous chapter's.
    lastWordCountRef.current = editor.storage.characterCount?.words() || 0;
    setSessionStartTime(null);
    setSessionWordCount(0);

    const logWritingSession = async () => {
      // No session was opened = no typing happened. Don't log.
      if (!sessionStartTime) return;

      const currentWordCount = editor.storage.characterCount?.words() || 0;
      const wordDiff = currentWordCount - lastWordCountRef.current;
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);

      // Threshold: only log if it crosses one of the minimums. This means a
      // ten-second flurry of typing that doesn't add many words won't spam
      // logs; a longer quiet session of editing will eventually log.
      if (
        Math.abs(wordDiff) < MIN_WORDS_TO_LOG &&
        timeSpent < MIN_SECONDS_TO_LOG
      ) {
        return;
      }

      try {
        const today = new Date().toISOString().split("T")[0];
        await statsApi.logSession({
          project_id: selectedProject?.id,
          chapter_id: selectedChapter?.id,
          date: today,
          words_added: Math.max(0, wordDiff),
          words_deleted: Math.max(0, -wordDiff),
          time_spent_seconds: timeSpent,
        });
        // Reset session tracking so the next typing burst starts fresh.
        lastWordCountRef.current = currentWordCount;
        setSessionStartTime(null);
        setSessionWordCount(0);
      } catch (error) {
        console.error("Couldn't log writing session:", error);
      }
    };

    const handleEditorUpdate = () => {
      const currentWordCount = editor.storage.characterCount?.words() || 0;
      const delta = currentWordCount - lastWordCountRef.current;

      // Big jump means programmatic content load (chapter switch, paste,
      // AI rewrite, version restore). Silently rebase and don't open a
      // session.
      if (Math.abs(delta) > TYPING_DELTA_LIMIT) {
        lastWordCountRef.current = currentWordCount;
        return;
      }

      // Real typing. Open a session if we don't have one, and track the
      // running word count for the stats panel display.
      if (!sessionStartTime) {
        setSessionStartTime(Date.now());
      }
      setSessionWordCount(currentWordCount);
    };

    editor.on("update", handleEditorUpdate);

    // Periodic flush — every 5 minutes the held session gets logged so the
    // dashboard sees fresh data without waiting for a chapter switch.
    statsIntervalRef.current = setInterval(logWritingSession, 5 * 60 * 1000);

    return () => {
      editor.off("update", handleEditorUpdate);
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      // One last flush on chapter change / unmount. This is the only place
      // a half-completed session of real typing gets logged, so we want it.
      logWritingSession();
    };
    // We intentionally do NOT depend on selectedProject or sessionStartTime
    // here. selectedProject changing means the chapter is changing too, so
    // the chapter dep covers it. Depending on sessionStartTime would tear
    // down and rebuild this effect on every typed word, which would lose
    // the in-flight session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, selectedChapter?.id]);

  // ── Data loaders ─────────────────────────────────────────────────────────
  const loadProjects = async () => {
    try {
      const res = await projectApi.getAll();
      setProjects(res.data);
      if (!projectId && res.data.length > 0) {
        setSelectedProject(res.data[0]);
        loadChapters(res.data[0].id);
      }
    } catch (error) {
      toast.error("Couldn't pull up your projects. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async (projId) => {
    try {
      const res = await chapterApi.getByProject(projId);
      setChapters(res.data);
      if (res.data.length > 0) {
        setSelectedChapter(res.data[0]);
      } else {
        setSelectedChapter(null);
      }
    } catch (error) {
      toast.error("Couldn't pull up the chapters. Try again?");
    }
  };

  const handleProjectChange = (projId) => {
    const project = projects.find((p) => p.id === projId);
    setSelectedProject(project);
    navigate(`/manuscript/${projId}`);
    loadChapters(projId);
  };

  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim() || !selectedProject) return;

    try {
      const res = await chapterApi.create({
        project_id: selectedProject.id,
        chapter_number: chapters.length + 1,
        title: newChapterTitle,
        content: "",
        status: "draft",
      });
      setChapters([...chapters, res.data]);
      setSelectedChapter(res.data);
      setNewChapterOpen(false);
      setNewChapterTitle("");
      toast.success("Chapter added.");
    } catch (error) {
      toast.error("Couldn't add that chapter. Try again?");
    }
  };

  // ── Save status display ──────────────────────────────────────────────────
  const getSaveStatusLabel = () => {
    if (!selectedChapter) {
      return "No chapter open";
    }

    if (autosave.saveState === "saving") {
      return "Saving.";
    }

    if (autosave.saveState === "dirty") {
      return "Unsaved";
    }

    if (autosave.saveState === "error") {
      return "Save didn't go through";
    }

    if (autosave.lastSavedAt) {
      return `Saved ${new Date(autosave.lastSavedAt).toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
        },
      )}`;
    }

    return "Saved";
  };

  const handleDeleteChapter = async () => {
    if (!selectedChapter) return;

    try {
      await chapterApi.delete(selectedChapter.id);
      const newChapters = chapters.filter((c) => c.id !== selectedChapter.id);
      setChapters(newChapters);
      setSelectedChapter(newChapters.length > 0 ? newChapters[0] : null);
      setDeleteChapterOpen(false);
      toast.success("Deleted.");
    } catch (error) {
      toast.error("Couldn't delete that chapter. Try again?");
    }
  };

  const handleDuplicateChapter = async () => {
    if (!selectedChapter || !selectedProject) return;

    try {
      const res = await chapterApi.create({
        project_id: selectedProject.id,
        chapter_number: chapters.length + 1,
        title: `${selectedChapter.title} (Copy)`,
        content: selectedChapter.content,
        status: "draft",
      });
      setChapters([...chapters, res.data]);
      setSelectedChapter(res.data);
      toast.success("Duplicated.");
    } catch (error) {
      toast.error("Couldn't duplicate that chapter. Try again?");
    }
  };

  const handleRenameChapter = async () => {
    if (!selectedChapter || !renameChapterTitle.trim()) return;

    try {
      await chapterApi.update(selectedChapter.id, {
        title: renameChapterTitle,
      });
      setChapters(
        chapters.map((c) =>
          c.id === selectedChapter.id ? { ...c, title: renameChapterTitle } : c,
        ),
      );
      setSelectedChapter({ ...selectedChapter, title: renameChapterTitle });
      setRenameChapterOpen(false);
      setRenameChapterTitle("");
      toast.success("Renamed.");
    } catch (error) {
      toast.error("Couldn't rename that. Try again?");
    }
  };

  // Delete Manuscript (Project) Action
  const handleDeleteManuscript = async () => {
    if (!selectedProject) return;

    try {
      await projectApi.delete(selectedProject.id);
      const newProjects = projects.filter((p) => p.id !== selectedProject.id);
      setProjects(newProjects);
      setDeleteManuscriptOpen(false);

      if (newProjects.length > 0) {
        setSelectedProject(newProjects[0]);
        loadChapters(newProjects[0].id);
        navigate(`/manuscript/${newProjects[0].id}`);
      } else {
        setSelectedProject(null);
        setChapters([]);
        setSelectedChapter(null);
        navigate("/");
      }

      toast.success("Manuscript deleted.");
    } catch (error) {
      toast.error("Couldn't delete that. Try again?");
    }
  };

  const openRenameDialog = () => {
    if (selectedChapter) {
      setRenameChapterTitle(selectedChapter.title);
      setRenameChapterOpen(true);
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────
  // Format → API method, file extension, MIME type. Adding a future format
  // (HTML, EPUB variant, etc.) is one line here.
  const EXPORT_FORMATS = {
    docx: {
      method: projectApi.exportDocx,
      extension: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    pdf: {
      method: projectApi.exportPdf,
      extension: "pdf",
      mime: "application/pdf",
    },
    epub: {
      method: projectApi.exportEpub,
      extension: "epub",
      mime: "application/epub+zip",
    },
    markdown: {
      method: projectApi.exportMarkdown,
      extension: "md",
      mime: "text/markdown",
    },
  };

  const handleExport = async () => {
    if (!selectedProject) {
      toast.error("Open a project first.");
      return;
    }

    if (chapters.length === 0) {
      toast.error("Nothing to export yet — there are no chapters.");
      return;
    }

    const formatConfig = EXPORT_FORMATS[exportFormat];
    if (!formatConfig) {
      toast.error("Pick a format first.");
      return;
    }

    setExporting(true);
    try {
      const author = exportAuthorOverride.trim() || null;
      const response = await formatConfig.method(
        selectedProject.id,
        exportIncludeTitlePage,
        exportIncludeChapterNumbers,
        author,
      );

      // Create download link
      const blob = new Blob([response.data], { type: formatConfig.mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const safeTitle = selectedProject.title
        .replace(/[^\w\s-]/g, "")
        .trim()
        .substring(0, 50);
      link.download = `${safeTitle || "manuscript"}.${formatConfig.extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportDialogOpen(false);
      toast.success("Exported.");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        "Couldn't export it: " +
          (error.response?.data?.detail || error.message),
      );
    } finally {
      setExporting(false);
    }
  };

  // ── AI Functions ─────────────────────────────────────────────────────────
  const handleRewriteForTone = async () => {
    const target = getAiTarget();

    if (!target.text?.trim()) {
      toast.error("Nothing to rewrite yet.");
      return;
    }

    setAiLoading(true);
    setAiOriginalText(target.text);
    setAiResponseType(null);

    try {
      console.log("handleRewriteForTone target:", {
        mode: target.mode,
        textLength: target.text.length,
      });

      if (target.mode === "chapter" && target.text.length > 12000) {
        const chunks = chunkTextByParagraphs(target.text, 1500);
        console.log("handleRewriteForTone chunk count:", chunks.length);

        const rewrittenChunks = [];

        for (let i = 0; i < chunks.length; i += 1) {
          const chunk = chunks[i];
          console.log("handleRewriteForTone chunk:", {
            index: i,
            length: chunk.length,
          });

          try {
            const response = await aiApi.rewrite(chunk, "warm and engaging");
            const rewritten =
              response.data?.result || response.data?.response || "";

            if (!rewritten.trim()) {
              throw new Error("Rewrite response was empty");
            }

            rewrittenChunks.push(rewritten);
          } catch (error) {
            throw new Error(
              error?.response?.data?.detail ||
                error?.response?.data?.message ||
                error?.message ||
                `Section ${i + 1} didn't go through`,
            );
          }
        }

        setAiResponse(rewrittenChunks.join("\n\n"));
        setAiResponseType("rewrite");
        return;
      }

      const response = await aiApi.rewrite(target.text, "warm and engaging");
      const rewritten = response.data?.result || response.data?.response || "";

      if (!rewritten.trim()) {
        throw new Error("Rewrite response was empty");
      }

      setAiResponse(rewritten);
      setAiResponseType("rewrite");
    } catch (error) {
      console.error("handleRewriteForTone failed:", error);
      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Couldn't put that together. Try again?",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!editor || !editor.getText().trim()) {
      toast.error("Nothing to summarize yet.");
      return;
    }
    setAiLoading(true);
    setAiOriginalText("");
    setAiResponseType(null);
    try {
      const res = await aiApi.summarize(editor.getText());
      setAiResponse(res.data.response);
      setAiResponseType("summary");
    } catch (error) {
      toast.error("Couldn't put that together. Try again?");
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!selectedProject?.summary) {
      toast.error(
        "The book needs a summary first — add one and I'll outline from there.",
      );
      return;
    }
    setAiLoading(true);
    setOutlineOpen(false);
    setAiOriginalText("");
    setAiResponseType(null);
    try {
      const res = await aiApi.generateOutline(
        selectedProject.title,
        selectedProject.summary,
        outlineCount,
      );
      setAiResponse(res.data.response);
      setAiResponseType("outline");
    } catch (error) {
      toast.error("Couldn't outline that. Try again?");
    } finally {
      setAiLoading(false);
    }
  };

  // Apply rewritten content to editor
  const hasStoredSelection =
    !!selectedText?.trim() &&
    selectedRange &&
    typeof selectedRange.from === "number" &&
    typeof selectedRange.to === "number" &&
    selectedRange.from !== selectedRange.to;

  const escapeHtml = (text = "") =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const aiTextToHtml = (text = "") => {
    const trimmed = text.trim();
    if (!trimmed) return "";

    return trimmed
      .split(/\n{2,}/)
      .map(
        (paragraph) =>
          `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
      )
      .join("");
  };

  const clearAiResponse = () => {
    setAiResponse("");
    setAiResponseType(null);
  };

  const createAiSafetySnapshot = async (actionLabel) => {
    if (!selectedChapter?.id || !editor) {
      toast.error("Couldn't save a snapshot first — won't risk applying.");
      return false;
    }

    try {
      const currentContent = editor.getHTML();

      const timestamp = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const label = `Before ${actionLabel} — ${timestamp}`;

      await versionsApi.create({
        parent_type: "chapter",
        parent_id: selectedChapter.id,
        content_snapshot: currentContent,
        label,
        created_by: "thad",
      });

      autosave.setRefreshVersionsTrigger((prev) => prev + 1);
      return true;
    } catch (error) {
      console.error("AI snapshot failed:", error);
      toast.error("Snapshot didn't save. Held off on applying.");
      return false;
    }
  };

  const handleInsertIntoEditor = async () => {
    if (!editor || !aiResponse?.trim()) return;
    if (applyingAi) return;

    setApplyingAi(true);

    try {
      const snapshotCreated = await createAiSafetySnapshot("Insert");
      if (!snapshotCreated) return;

      const html = aiTextToHtml(aiResponse);
      if (!html) return;

      editor.chain().focus().insertContent(html).run();

      const updatedContent = editor.getHTML();
      await autosave.persistChapterContent(updatedContent, {
        showSuccessToast: false,
        showErrorToast: true,
      });

      toast.success("Inserted.");
    } catch (error) {
      console.error("Insert into editor failed:", error);
      toast.error("Couldn't insert that.");
    } finally {
      setApplyingAi(false);
    }
  };

  const handleReplaceSelection = async () => {
    if (!editor || !aiResponse?.trim()) return;
    if (applyingAi) return;

    if (!hasStoredSelection) {
      toast.error("Highlight something in the chapter first.");
      return;
    }

    setApplyingAi(true);

    try {
      const snapshotCreated = await createAiSafetySnapshot("Replace");
      if (!snapshotCreated) return;

      const html = aiTextToHtml(aiResponse);
      if (!html) return;

      editor
        .chain()
        .focus()
        .setTextSelection({ from: selectedRange.from, to: selectedRange.to })
        .deleteSelection()
        .insertContent(html)
        .run();

      setSelectedText("");
      setSelectedRange(null);

      const updatedContent = editor.getHTML();
      await autosave.persistChapterContent(updatedContent, {
        showSuccessToast: false,
        showErrorToast: true,
      });

      toast.success("Replaced.");
    } catch (error) {
      console.error("Replace selection failed:", error);
      toast.error("Couldn't replace that.");
    } finally {
      setApplyingAi(false);
    }
  };

  const handleCopyAiResponse = async () => {
    if (!aiResponse?.trim()) return;

    try {
      await navigator.clipboard.writeText(aiResponse);
      toast.success("Copied.");
    } catch (error) {
      console.error("Failed to copy AI response:", error);
      toast.error("Couldn't copy that.");
    }
  };

  // Deny/dismiss the rewrite suggestion
  const handleDenyRewrite = () => {
    clearAiResponse();
    toast.info("Set aside.");
  };

  // ── Upload Functions ─────────────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file) => {
    const allowedTypes = [".txt", ".docx", ".pdf", ".md"];
    const ext = "." + file.name.split(".").pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
      toast.error(
        "That file type doesn't work here. Try .txt, .docx, .pdf, or .md.",
      );
      return;
    }

    setUploadedFile(file);
    setUploadChapterTitle(file.name.replace(/\.[^/.]+$/, ""));
    setUploading(true);

    try {
      const res = await uploadApi.previewManuscript(file);
      setUploadPreview(res.data);
      setUploadDialogOpen(true);
    } catch (error) {
      toast.error(
        "Couldn't read that file: " +
          (error.response?.data?.detail || error.message),
      );
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadConfirm = async () => {
    if (!uploadedFile || !selectedProject) return;

    setUploading(true);
    try {
      const res = await uploadApi.uploadManuscript(
        uploadedFile,
        selectedProject.id,
        uploadChapterTitle || uploadedFile.name.replace(/\.[^/.]+$/, ""),
      );

      if (res.data.chapter_id) {
        await loadChapters(selectedProject.id);
        // Select the new chapter
        const newChapter = await chapterApi.getById(res.data.chapter_id);
        setSelectedChapter(newChapter.data);
        toast.success(
          `Imported "${uploadChapterTitle}" (${res.data.word_count.toLocaleString()} words)`,
        );

        // Trigger Import Analysis
        setImportedContent(uploadPreview?.full_content || res.data.content);
        setImportedFilename(uploadedFile.name);
        handleUploadClose();
        setImportAnalysisOpen(true);
      } else {
        handleUploadClose();
      }
    } catch (error) {
      toast.error(
        "Couldn't bring that in: " +
          (error.response?.data?.detail || error.message),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleImportActionComplete = (actionId, result) => {
    // Hook for post-action behavior. Stays silent — the dialog itself speaks.
  };

  const handleUploadClose = () => {
    setUploadDialogOpen(false);
    setUploadedFile(null);
    setUploadPreview(null);
    setUploadChapterTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <LoadingState
        size="page"
        eyebrow="The workshop"
        title="Pulling your work off the shelves."
        body="One moment — gathering projects, chapters, and where you left off."
        testId="loading-manuscript-workspace"
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        size="page"
        art={<BlankPageArt size={96} />}
        eyebrow="The workshop is quiet"
        title="A blank page is a beginning."
        body="Start a new project, or bring in a manuscript you’ve been carrying around. Either way, this is where it begins."
        primaryAction={{
          label: "Start a new project",
          icon: Plus,
          onClick: () => navigate("/?action=new_project"),
          testId: "empty-workspace-new-project",
          showArrow: true,
        }}
        secondaryAction={{
          label: "Import a manuscript",
          icon: Upload,
          onClick: () => navigate("/?action=import"),
          testId: "empty-workspace-import",
        }}
        testId="empty-workspace-no-projects"
      />
    );
  }

  const handleRewriteSelected = async (text) => {
    if (!text) return;

    setAiLoading(true);
    setAiOriginalText(text);

    try {
      const response = await aiApi.rewrite(text, "warm and engaging");

      setAiResponse(response.data?.result || response.data?.response || "");
      setAiResponseType("rewrite");
    } catch (err) {
      console.error("Failed to rewrite selected text:", err);
      setAiResponse("Couldn't rewrite that selection right now. Try again?");
      setAiResponseType("rewrite");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className="flex h-full overflow-hidden"
      data-testid="manuscript-workspace"
    >
      {/* ManuscriptPanel - Chapter Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-card border-r border-border sidebar-transition overflow-hidden",
          sidebarCollapsed ? "w-12" : "w-80",
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0 gap-2">
          {!focusMode && !sidebarCollapsed && (
            <Select
              value={selectedProject?.id}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger
                className="flex-1 min-w-0 rounded-sm text-sm"
                data-testid="project-select"
              >
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="shrink-0 h-8 w-8"
            data-testid="toggle-sidebar-btn"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!focusMode && !sidebarCollapsed && (
          /* ManuscriptPanel Container - All manuscript UI contained here */
          <div
            className="flex flex-col w-full overflow-hidden flex-1"
            data-testid="manuscript-panel"
          >
            <Tabs
              defaultValue="chapters"
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="overflow-x-auto">
                <TabsList
                  className="flex w-max min-w-full flex-nowrap"
                  data-testid="sidebar-tabs"
                >
                  <TabsTrigger
                    value="chapters"
                    className="whitespace-nowrap"
                    data-testid="chapters-tab"
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1" />
                    Chapters
                  </TabsTrigger>
                  <TabsTrigger
                    value="workflow"
                    className="whitespace-nowrap"
                    data-testid="workflow-tab"
                  >
                    <Workflow className="h-3.5 w-3.5 mr-1" />
                    Stage
                  </TabsTrigger>
                  <TabsTrigger
                    value="versions"
                    className="whitespace-nowrap"
                    data-testid="versions-tab"
                  >
                    <History className="h-3.5 w-3.5 mr-1" />
                    History
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="whitespace-nowrap"
                    data-testid="notes-tab"
                  >
                    <StickyNote className="h-3.5 w-3.5 mr-1" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger
                    value="analyzer"
                    className="whitespace-nowrap"
                    data-testid="analyzer-tab"
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Read
                  </TabsTrigger>
                  <TabsTrigger
                    value="thad"
                    className="whitespace-nowrap"
                    data-testid="thad-tab"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Thad
                  </TabsTrigger>
                </TabsList>
              </div>
              {/* Chapters Tab */}
              <TabsContent
                value="chapters"
                className="flex-1 flex flex-col mt-0 overflow-hidden"
              >
                {/* Scrollable Manuscript/Chapter List */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-1">
                    {chapters.length === 0 ? (
                      <EmptyState
                        size="inline"
                        art={<ChapterStackArt size={56} />}
                        title="No chapters yet"
                        body="Add your first chapter to start writing."
                        primaryAction={{
                          label: "Start a chapter",
                          icon: Plus,
                          onClick: () => setNewChapterOpen(true),
                          testId: "empty-chapters-new-btn",
                        }}
                        testId="empty-chapters-list"
                      />
                    ) : (
                      chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          onClick={() => setSelectedChapter(chapter)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-sm text-sm transition-colors",
                            selectedChapter?.id === chapter.id
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted",
                          )}
                          data-testid={`chapter-${chapter.id}`}
                        >
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {chapter.chapter_number}.
                          </span>
                          {chapter.title}
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Manuscript Buttons - All inside ManuscriptPanel, below list */}
                <div className="flex flex-col gap-2 border-t border-border p-4 shrink-0">
                  <Button
                    variant="outline"
                    className="w-full rounded-sm justify-start"
                    size="sm"
                    onClick={() => setNewChapterOpen(true)}
                    data-testid="add-chapter-btn"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add a chapter
                  </Button>

                  {/* Upload/Import Button */}
                  <Button
                    variant="outline"
                    className="w-full rounded-sm justify-start"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!selectedProject || uploading}
                    data-testid="upload-manuscript-btn"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Import a manuscript
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.docx,.pdf,.md"
                    onChange={handleFileInputChange}
                    className="hidden"
                    data-testid="file-input"
                  />

                  <Button
                    variant="outline"
                    className="w-full rounded-sm justify-start"
                    size="sm"
                    onClick={handleDuplicateChapter}
                    disabled={!selectedChapter}
                    data-testid="duplicate-chapter-btn"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate this chapter
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full rounded-sm justify-start"
                    size="sm"
                    onClick={openRenameDialog}
                    disabled={!selectedChapter}
                    data-testid="rename-chapter-btn"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename this chapter
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full rounded-sm justify-start text-destructive hover:text-destructive"
                    size="sm"
                    onClick={() => setDeleteChapterOpen(true)}
                    disabled={!selectedChapter}
                    data-testid="delete-chapter-btn"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete this chapter
                  </Button>

                  {/* Export Section */}
                  <div className="border-t border-border pt-2 mt-1 w-full space-y-1">
                    <Button
                      variant="outline"
                      className="w-full rounded-sm justify-start bg-accent/10 hover:bg-accent/20"
                      size="sm"
                      onClick={() => setExportDialogOpen(true)}
                      disabled={!selectedProject || chapters.length === 0}
                      data-testid="export-manuscript-btn"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Export the manuscript
                    </Button>
                  </div>

                  {/* Delete Manuscript Button */}
                  <div className="border-t border-border pt-2 mt-1 w-full">
                    <Button
                      variant="destructive"
                      className="w-full rounded-sm justify-start"
                      size="sm"
                      onClick={() => setDeleteManuscriptOpen(true)}
                      disabled={!selectedProject}
                      data-testid="delete-manuscript-btn"
                    >
                      <BookX className="h-4 w-4 mr-2" />
                      Delete this manuscript
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Workflow Tab */}
              <TabsContent
                value="workflow"
                className="flex-1 mt-0 overflow-hidden"
              >
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <WorkflowPanel
                      manuscriptContent={editor?.getText() || ""}
                      chapterCount={chapters.length}
                      projectId={selectedProject?.id}
                      projectTitle={selectedProject?.title}
                      ageGroup={selectedProject?.age_group}
                      autoAnalyzeOnMount={true}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Versions Tab */}
              <TabsContent
                value="versions"
                className="mt-0 h-full min-w-0 overflow-hidden"
              >
                <div className="h-full min-h-0 w-full min-w-0">
                  <VersionsPanel
                    parentType="chapter"
                    parentId={selectedChapter?.id}
                    refreshTrigger={autosave.refreshVersionsTrigger}
                    getCurrentContent={() => editor?.getHTML() || ""}
                    onRestoreVersion={(content) => {
                      if (editor) {
                        editor.commands.setContent(content);
                        toast.success("Restored.");
                      }
                    }}
                  />
                </div>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent
                value="notes"
                className="flex-1 mt-0 overflow-hidden"
              >
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <NotesPanel
                      parentType="chapter"
                      parentId={selectedChapter?.id}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Analyzer Tab */}
              <TabsContent
                value="analyzer"
                className="flex-1 mt-0 overflow-hidden"
              >
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <AnalyzerPanel
                      content={editor?.getText() || ""}
                      chapterId={selectedChapter?.id}
                      projectId={selectedProject?.id}
                      projectTitle={selectedProject?.title}
                      ageGroup={selectedProject?.age_group}
                      autoAnalyzeOnMount={true}
                      onApplyChange={(newContent) => {
                        if (editor) {
                          editor.commands.setContent(newContent);
                          toast.success("Applied.");
                        }
                      }}
                      onCreateVersion={async (label) => {
                        if (selectedChapter && editor) {
                          try {
                            await versionsApi.create({
                              parent_type: "chapter",
                              parent_id: selectedChapter.id,
                              content_snapshot: editor.getHTML(),
                              label: label,
                              created_by: "thad",
                            });
                          } catch (e) {
                            console.error("Failed to create version:", e);
                          }
                        }
                      }}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent
                value="thad"
                className="mt-0 h-full min-w-0 overflow-hidden"
              >
                <div className="h-full min-h-0 w-full min-w-0 p-4">
                  <ThadChatPanel
                    projectId={selectedProject?.id}
                    chapterId={selectedChapter?.id}
                    chapterTitle={selectedChapter?.title}
                    currentChapterContent={
                      editor?.getHTML() || selectedChapter?.content || ""
                    }
                    selectedText={selectedText}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </aside>

      {/* Editor Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onMouseMove={(e) => {
          if (!focusMode) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;

          setShowFocusToolbar(y <= 100);
        }}
      >
        {" "}
        {/* Toolbar */}
        {(!focusMode || showFocusToolbar) && (
          <div
            className={cn(
              "flex items-center justify-between px-4 py-2 border-b border-border bg-card transition-opacity duration-200",
              focusMode
                ? "absolute top-0 left-0 right-0 z-30 shadow-sm"
                : "relative",
            )}
          >
            <div className="flex items-center gap-1">
              <ToolbarButton
                icon={Bold}
                active={editor?.isActive("bold")}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              />
              <ToolbarButton
                icon={Italic}
                active={editor?.isActive("italic")}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              />
              <ToolbarButton
                icon={Heading1}
                active={editor?.isActive("heading", { level: 1 })}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 1 }).run()
                }
              />
              <ToolbarButton
                icon={Heading2}
                active={editor?.isActive("heading", { level: 2 })}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
              />
              <ToolbarButton
                icon={List}
                active={editor?.isActive("bulletList")}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              />
              <ToolbarButton
                icon={ListOrderedIcon}
                active={editor?.isActive("orderedList")}
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
              />
              <ToolbarButton
                icon={Quote}
                active={editor?.isActive("blockquote")}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              />
              <div className="w-px h-6 bg-border mx-2" />
              <ToolbarButton
                icon={Undo}
                onClick={() => editor?.chain().focus().undo().run()}
              />
              <ToolbarButton
                icon={Redo}
                onClick={() => editor?.chain().focus().redo().run()}
              />
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFocusMode((prev) => {
                    const next = !prev;
                    if (next) {
                      setSidebarCollapsed(true);
                      setAiPanelCollapsed(true);
                    }
                    return next;
                  });
                }}
              >
                {focusMode ? "Exit focus mode" : "Focus mode"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-version indicator */}
              <div
                className="flex items-center gap-2 px-2 py-1 rounded-sm bg-muted/50"
                data-testid="auto-version-indicator"
              >
                <div className="flex items-center gap-1.5">
                  {autosave.autoVersionSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  ) : (
                    <Clock
                      className={cn(
                        "h-3.5 w-3.5",
                        autosave.autoVersionEnabled
                          ? "text-accent"
                          : "text-muted-foreground",
                      )}
                    />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {autosave.autoVersionSaving
                      ? "Saving snapshot."
                      : "Auto-snapshot"}
                  </span>
                </div>
                <Switch
                  checked={autosave.autoVersionEnabled}
                  onCheckedChange={autosave.setAutoVersionEnabled}
                  className="scale-75"
                  data-testid="auto-version-toggle"
                />
              </div>

              <div className="w-px h-6 bg-border" />

              <span
                className={cn(
                  "text-xs",
                  autosave.saveState === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {getSaveStatusLabel()}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {editor?.storage.characterCount?.words() || 0} words
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={autosave.manualSave}
                disabled={autosave.saving || !selectedChapter}
                className="rounded-sm"
                data-testid="save-chapter-btn"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        )}
        {/* Main content */}
        <div className="relative flex-1 flex overflow-hidden">
          {/* Editor */}
          <div
            className={cn(
              "flex-1 overflow-auto",
              focusMode ? (showFocusToolbar ? "p-12 pt-20" : "p-12") : "p-8",
            )}
          >
            {" "}
            {selectedChapter ? (
              <div
                className={`${focusMode ? "max-w-4xl" : "max-w-3xl"} mx-auto`}
              >
                <Input
                  value={selectedChapter.title}
                  onChange={async (e) => {
                    const newTitle = e.target.value;
                    setSelectedChapter({ ...selectedChapter, title: newTitle });
                    await chapterApi.update(selectedChapter.id, {
                      title: newTitle,
                    });
                  }}
                  className="text-4xl font-serif font-medium border-none p-0 h-auto mb-8 focus-visible:ring-0 bg-transparent"
                  placeholder="Untitled chapter"
                  data-testid="chapter-title-input"
                />
                <EditorContent
                  editor={editor}
                  className="mx-auto max-w-3xl px-6 py-10 font-serif text-[18px] leading-8 text-foreground"
                  data-testid="chapter-editor"
                />
              </div>
            ) : (
              /* Empty state — warm, state-aware, drag-and-drop preserved */
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full transition-colors p-6",
                  isDragging &&
                    "bg-accent/10 border-2 border-dashed border-accent",
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                data-testid="drop-zone"
              >
                {isDragging ? (
                  <div className="flex flex-col items-center text-center animate-fade-in">
                    <FileUp className="h-14 w-14 mb-4 text-accent animate-bounce" />
                    <p className="font-serif text-2xl text-accent mb-1">
                      Drop it anywhere here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      .txt, .docx, .pdf, or .md
                    </p>
                  </div>
                ) : (
                  <EmptyState
                    size="page"
                    art={
                      chapters.length === 0 ? (
                        <BlankPageArt size={96} />
                      ) : (
                        <QuillMarkArt size={96} />
                      )
                    }
                    eyebrow={
                      chapters.length === 0
                        ? "Nothing on the page yet"
                        : "Choose a chapter"
                    }
                    title={
                      chapters.length === 0
                        ? "Where would you like to begin?"
                        : "Pick up where you left off."
                    }
                    body={
                      chapters.length === 0
                        ? "Start a fresh chapter, or drop in a manuscript file you already have."
                        : "Open a chapter from the list on the left, or bring in something new."
                    }
                    primaryAction={
                      chapters.length === 0
                        ? {
                            label: "Start a chapter",
                            icon: Plus,
                            onClick: () => setNewChapterOpen(true),
                            testId: "empty-editor-new-chapter-btn",
                          }
                        : undefined
                    }
                    secondaryAction={{
                      label: "Bring in a file",
                      icon: Upload,
                      onClick: () => fileInputRef.current?.click(),
                      testId: "empty-editor-browse-btn",
                    }}
                    testId="empty-editor"
                  />
                )}
              </div>
            )}
          </div>

          {/* AI Panel */}
          {!focusMode && (
            <aside
              className={cn(
                "flex flex-col bg-card border-l border-border sidebar-transition overflow-hidden",
                aiPanelCollapsed ? "w-12" : "w-80",
              )}
            >
              {aiPanelCollapsed ? (
                /* Collapsed state */
                <div className="flex items-center justify-center p-3 border-b border-border">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAiPanelCollapsed(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                /* Expanded state with Tabs */
                <Tabs
                  defaultValue="ai"
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <div className="flex items-center justify-between p-3 border-b border-border gap-2 shrink-0">
                    <TabsList className="grid grid-cols-2 h-8 flex-1">
                      <TabsTrigger
                        value="ai"
                        className="text-xs"
                        data-testid="ai-tab"
                      >
                        <Wand2 className="h-3 w-3 mr-1" />
                        Thad
                      </TabsTrigger>
                      <TabsTrigger
                        value="stats"
                        className="text-xs"
                        data-testid="stats-tab"
                      >
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Stats
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAiPanelCollapsed(true)}
                      className="shrink-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* AI Tab Content */}
                  <TabsContent
                    value="ai"
                    className="flex-1 flex flex-col mt-0 overflow-hidden"
                  >
                    <div className="p-3 space-y-2 border-b border-border shrink-0">
                      <div className="mb-3">
                        {selectedText?.trim() ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Reading your selection.
                          </div>
                        ) : (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            Reading the whole chapter.
                          </div>
                        )}
                      </div>

                      {/* Writing Help */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          On the writing
                        </p>
                        <Button
                          variant="outline"
                          className="w-full justify-start rounded-sm"
                          size="sm"
                          onClick={() =>
                            selectedText
                              ? handleRewriteSelected(selectedText)
                              : handleRewriteForTone()
                          }
                          disabled={aiLoading}
                          data-testid="rewrite-tone-btn"
                        >
                          <Wand2 className="h-4 w-4 mr-2" />
                          {selectedText
                            ? "Improve this passage"
                            : "Improve the chapter"}
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start rounded-sm"
                          size="sm"
                          onClick={handleSummarize}
                          disabled={aiLoading}
                          data-testid="summarize-btn"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Summarize the chapter
                        </Button>
                      </div>

                      {/* Structure */}
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          On the shape
                        </p>

                        <Button
                          variant="outline"
                          className="w-full justify-start rounded-sm"
                          size="sm"
                          onClick={() => setOutlineOpen(true)}
                          disabled={aiLoading}
                          data-testid="generate-outline-btn"
                        >
                          <ListOrdered className="h-4 w-4 mr-2" />
                          Outline the book
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start rounded-sm bg-accent/10 hover:bg-accent/20 text-accent"
                          size="sm"
                          onClick={() => {
                            if (editor && selectedChapter) {
                              setImportedContent(editor.getText());
                              setImportedFilename(selectedChapter.title);
                              setImportAnalysisOpen(true);
                            }
                          }}
                          disabled={!selectedChapter || !editor?.getText()}
                          data-testid="analyze-chapter-btn"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Read for structure
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="flex-1 min-h-0">
                      <div className="p-3">
                        {aiLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-accent" />
                          </div>
                        ) : aiResponse ? (
                          <div className="space-y-3">
                            {/* Response Type Label */}
                            {aiResponseType === "rewrite" && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Wand2 className="h-3 w-3" />
                                <span>The rewrite</span>
                              </div>
                            )}

                            {/* AI Response Content */}
                            {aiResponseType === "rewrite" ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>Original</span>
                                  </div>
                                  <div
                                    className="text-sm whitespace-pre-wrap p-3 bg-background rounded-sm border max-h-[260px] overflow-y-auto"
                                    data-testid="ai-original-preview"
                                  >
                                    {aiOriginalText}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>Rewrite</span>
                                  </div>
                                  <div
                                    className="ai-response text-sm whitespace-pre-wrap p-3 bg-muted/30 rounded-sm border max-h-[260px] overflow-y-auto"
                                    data-testid="ai-response"
                                  >
                                    {aiResponse}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="ai-response text-sm whitespace-pre-wrap p-3 bg-muted/30 rounded-sm border"
                                data-testid="ai-response"
                              >
                                {aiResponse}
                              </div>
                            )}

                            {/* Insert / Replace actions */}
                            <div className="space-y-2 pt-2">
                              {/* Primary Actions */}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1 rounded-sm"
                                  onClick={handleInsertIntoEditor}
                                  disabled={applyingAi}
                                  data-testid="insert-into-editor-btn"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  {applyingAi
                                    ? "Applying."
                                    : "Insert into the chapter"}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 rounded-sm"
                                  onClick={handleReplaceSelection}
                                  disabled={!hasStoredSelection || applyingAi}
                                  data-testid="replace-selection-btn"
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {applyingAi
                                    ? "Applying."
                                    : "Replace what's selected"}
                                </Button>
                              </div>
                              {/* Secondary Actions */}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full rounded-sm"
                                onClick={handleCopyAiResponse}
                                data-testid="copy-ai-response-btn"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                              </Button>

                              {/* Deny / Clear Action */}
                              {aiResponseType === "rewrite" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full rounded-sm"
                                  onClick={handleDenyRewrite}
                                  data-testid="deny-rewrite-btn"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Dismiss
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="w-full rounded-sm text-muted-foreground"
                                  onClick={clearAiResponse}
                                  data-testid="dismiss-ai-btn"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Dismiss
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Insert leaves what's there. Replace swaps your
                              selection.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Pick something to do, or highlight a passage and
                            choose an action.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Stats Tab Content */}
                  <TabsContent
                    value="stats"
                    className="flex-1 mt-0 overflow-hidden"
                  >
                    <ScrollArea className="h-full">
                      <div className="p-3">
                        <WritingStatsPanel
                          ageGroup={selectedProject?.age_group}
                          autoAnalyzeOnMount={true}
                        />
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* New Chapter Dialog */}
      <Dialog open={newChapterOpen} onOpenChange={setNewChapterOpen}>
        <DialogContent data-testid="new-chapter-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">New chapter</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="chapterTitle">Title</Label>
            <Input
              id="chapterTitle"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="Untitled chapter"
              className="mt-2 rounded-sm"
              data-testid="new-chapter-title-input"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewChapterOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateChapter}
              className="rounded-sm"
              data-testid="create-chapter-submit"
            >
              Add chapter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Chapter Dialog */}
      <Dialog open={renameChapterOpen} onOpenChange={setRenameChapterOpen}>
        <DialogContent data-testid="rename-chapter-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">Rename chapter</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="renameChapterTitle">Title</Label>
            <Input
              id="renameChapterTitle"
              value={renameChapterTitle}
              onChange={(e) => setRenameChapterTitle(e.target.value)}
              placeholder="Untitled chapter"
              className="mt-2 rounded-sm"
              data-testid="rename-chapter-title-input"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameChapterOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameChapter}
              className="rounded-sm"
              data-testid="rename-chapter-submit"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outline Dialog */}
      <Dialog open={outlineOpen} onOpenChange={setOutlineOpen}>
        <DialogContent data-testid="outline-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">Outline the book</DialogTitle>
            <DialogDescription>
              I'll work from the book's summary. Tell me how many chapters.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="chapterCount">How many chapters</Label>
            <Input
              id="chapterCount"
              type="number"
              min={3}
              max={50}
              value={outlineCount}
              onChange={(e) => setOutlineCount(parseInt(e.target.value) || 10)}
              className="mt-2 rounded-sm"
              data-testid="outline-chapter-count"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOutlineOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateOutline}
              className="rounded-sm"
              data-testid="generate-outline-submit"
            >
              Outline it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Chapter Confirmation Dialog */}
      <AlertDialog open={deleteChapterOpen} onOpenChange={setDeleteChapterOpen}>
        <AlertDialogContent data-testid="delete-chapter-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{selectedChapter?.title}&rdquo; — gone for good. Sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChapter}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-chapter-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Manuscript Confirmation Dialog */}
      <AlertDialog
        open={deleteManuscriptOpen}
        onOpenChange={setDeleteManuscriptOpen}
      >
        <AlertDialogContent data-testid="delete-manuscript-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this manuscript?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{selectedProject?.title}&rdquo; and every chapter inside —
              gone for good. Sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteManuscript}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-manuscript-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Manuscript Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-testid="export-manuscript-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              Export
            </DialogTitle>
            <DialogDescription>
              &ldquo;{selectedProject?.title}&rdquo; — pick a format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger
                  className="rounded-sm"
                  data-testid="export-format-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="epub">
                    EPUB — for readers (.epub)
                  </SelectItem>
                  <SelectItem value="docx">
                    Word — for editing (.docx)
                  </SelectItem>
                  <SelectItem value="pdf">PDF — for printing (.pdf)</SelectItem>
                  <SelectItem value="markdown">
                    Markdown — for plain text (.md)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Author override */}
            <div className="space-y-2">
              <Label htmlFor="export-author" className="text-sm font-medium">
                Author name
              </Label>
              <Input
                id="export-author"
                value={exportAuthorOverride}
                onChange={(e) => setExportAuthorOverride(e.target.value)}
                placeholder={user?.display_name || "Your name on the cover"}
                className="rounded-sm"
                data-testid="export-author-input"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use{" "}
                {user?.display_name
                  ? `"${user.display_name}"`
                  : "your account name"}
                .
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-title" className="text-sm">
                  Include a title page
                </Label>
                <Switch
                  id="include-title"
                  checked={exportIncludeTitlePage}
                  onCheckedChange={setExportIncludeTitlePage}
                  data-testid="export-title-page-switch"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="include-numbers" className="text-sm">
                  Include chapter numbers
                </Label>
                <Switch
                  id="include-numbers"
                  checked={exportIncludeChapterNumbers}
                  onCheckedChange={setExportIncludeChapterNumbers}
                  data-testid="export-chapter-numbers-switch"
                />
              </div>
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-sm">
              <p>
                <strong>{chapters.length}</strong>{" "}
                {chapters.length === 1 ? "chapter" : "chapters"}
              </p>
              <p className="mt-1">
                <strong>
                  {selectedProject?.word_count?.toLocaleString() || 0}
                </strong>{" "}
                words
              </p>
              {exportFormat === "epub" && (
                <p className="mt-1 text-accent">
                  If a cover exists in the art studio, it'll be embedded.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-sm"
              data-testid="confirm-export-btn"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting.
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload/Import Manuscript Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleUploadClose}>
        <DialogContent
          className="sm:max-w-2xl"
          data-testid="upload-manuscript-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Bring in a manuscript
            </DialogTitle>
            <DialogDescription>
              Take a look. Bring it in as a new chapter.
            </DialogDescription>
          </DialogHeader>

          {uploadPreview && (
            <div className="space-y-4 py-4">
              {/* File Info */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-sm">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">
                      {uploadPreview.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uploadPreview.file_type.toUpperCase()} ·{" "}
                      {uploadPreview.word_count.toLocaleString()} words
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUploadClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Chapter Title Input */}
              <div className="space-y-2">
                <Label htmlFor="uploadChapterTitle">Title</Label>
                <Input
                  id="uploadChapterTitle"
                  value={uploadChapterTitle}
                  onChange={(e) => setUploadChapterTitle(e.target.value)}
                  placeholder="Untitled chapter"
                  className="rounded-sm"
                  data-testid="upload-chapter-title-input"
                />
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <ScrollArea className="h-[200px] border border-border rounded-sm p-3">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {uploadPreview.preview}
                  </p>
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleUploadClose}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadConfirm}
              disabled={uploading || !uploadChapterTitle.trim()}
              className="rounded-sm"
              data-testid="confirm-upload-btn"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bringing it in.
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Bring it in
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Analysis Dialog */}
      <ImportAnalysisDialog
        open={importAnalysisOpen}
        onOpenChange={setImportAnalysisOpen}
        content={importedContent}
        filename={importedFilename}
        projectId={selectedProject?.id}
        chapterId={selectedChapter?.id}
        onActionComplete={handleImportActionComplete}
      />
    </div>
  );
}

// Toolbar Button Component
function ToolbarButton({ icon: Icon, active, onClick }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn("h-8 w-8 rounded-sm", active && "bg-muted")}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
