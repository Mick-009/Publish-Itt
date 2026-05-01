import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

// Auto-save interval in milliseconds (10 minutes)
const AUTO_VERSION_INTERVAL = 10 * 60 * 1000;
const CHAPTER_AUTO_SAVE_DELAY = 2000;

export default function ManuscriptWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(null);
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

  useEffect(() => {
    if (!selectedChapter?.id) return;

    setSelectedText("");
    setSelectedRange(null);

    if (aiResponse) {
      setAiResponse("");
      setAiResponseType(null);
      toast.info("AI response cleared on chapter change");
    }

    if (editor) {
      const pos = editor.state.selection.to;
      editor.commands.setTextSelection(pos);
    }

    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  }, [selectedChapter?.id]);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiOriginalText, setAiOriginalText] = useState("");
  const [aiResponseType, setAiResponseType] = useState(null); // 'rewrite', 'summarize', 'outline', etc.
  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState(null);
  const [applyingAi, setApplyingAi] = useState(false);

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

  // Dialog state
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineCount, setOutlineCount] = useState(10);
  const [renameChapterOpen, setRenameChapterOpen] = useState(false);
  const [renameChapterTitle, setRenameChapterTitle] = useState("");
  const [deleteManuscriptOpen, setDeleteManuscriptOpen] = useState(false);
  const [deleteChapterOpen, setDeleteChapterOpen] = useState(false);

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadChapterTitle, setUploadChapterTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Import Analysis state
  const [importAnalysisOpen, setImportAnalysisOpen] = useState(false);
  const [importedContent, setImportedContent] = useState("");
  const [importedFilename, setImportedFilename] = useState("");

  // Auto-version state
  const [autoVersionEnabled, setAutoVersionEnabled] = useState(true);
  const [lastVersionTime, setLastVersionTime] = useState(null);
  const [editingStartTime, setEditingStartTime] = useState(null);
  const [autoVersionSaving, setAutoVersionSaving] = useState(false);
  const lastContentRef = useRef("");
  const lastSavedContentRef = useRef("");
  const currentContentRef = useRef("");
  const selectedChapterRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(null);
  const versionsPanelRef = useRef(null);
  const [refreshVersionsTrigger, setRefreshVersionsTrigger] = useState(0);

  // Writing stats tracking state
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  const lastWordCountRef = useRef(0);
  const statsIntervalRef = useRef(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("docx");
  const [exportIncludeTitlePage, setExportIncludeTitlePage] = useState(true);
  const [exportIncludeChapterNumbers, setExportIncludeChapterNumbers] =
    useState(true);

  useEffect(() => {
    selectedChapterRef.current = selectedChapter;
  }, [selectedChapter]);

  // Editor setup
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing your chapter...",
      }),
      CharacterCount,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      currentContentRef.current = content;

      if (!selectedChapterRef.current) {
        return;
      }

      if (content === lastSavedContentRef.current) {
        setSaveState((prev) => (prev === "error" ? prev : "saved"));
        return;
      }

      setSaveState((prev) => (prev === "dirty" ? prev : "dirty"));
      debouncedSave(content);
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

  const syncSavedChapterState = useCallback(
    (chapterId, savedChapter, content) => {
      setChapters((prev) =>
        prev.map((chapter) =>
          chapter.id === chapterId
            ? { ...chapter, ...savedChapter, content }
            : chapter,
        ),
      );
      setSelectedChapter((prev) =>
        prev?.id === chapterId ? { ...prev, ...savedChapter, content } : prev,
      );
    },
    [],
  );

  const persistChapterContent = useCallback(
    async (
      content,
      { showSuccessToast = false, showErrorToast = false } = {},
    ) => {
      const activeChapter = selectedChapterRef.current;
      if (!activeChapter) return;

      if (content === lastSavedContentRef.current && !saveInFlightRef.current) {
        setSaving(false);
        setSaveState("saved");
        return;
      }

      if (saveInFlightRef.current) {
        queuedSaveRef.current = {
          content,
          showSuccessToast:
            queuedSaveRef.current?.showSuccessToast || showSuccessToast,
          showErrorToast:
            queuedSaveRef.current?.showErrorToast || showErrorToast,
        };
        return;
      }

      const chapterId = activeChapter.id;
      saveInFlightRef.current = true;
      setSaving(true);
      setSaveState("saving");

      try {
        const response = await chapterApi.update(chapterId, { content });
        const savedChapter = response.data || {
          ...activeChapter,
          content,
          updated_at: new Date().toISOString(),
        };

        lastSavedContentRef.current = content;
        syncSavedChapterState(chapterId, savedChapter, content);

        if (selectedChapterRef.current?.id === chapterId) {
          setLastSavedAt(savedChapter.updated_at || new Date().toISOString());
          setSaveState(
            currentContentRef.current === content ? "saved" : "dirty",
          );
        }

        if (showSuccessToast) {
          toast.success("Chapter saved!");
        }
      } catch (error) {
        console.error("Chapter save failed:", error);

        if (selectedChapterRef.current?.id === chapterId) {
          setSaveState("error");
        }

        if (showErrorToast) {
          toast.error("Failed to save chapter");
        }
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);

        const queuedSave = queuedSaveRef.current;
        queuedSaveRef.current = null;

        if (queuedSave) {
          void persistChapterContent(queuedSave.content, {
            showSuccessToast: queuedSave.showSuccessToast,
            showErrorToast: queuedSave.showErrorToast,
          });
        }
      }
    },
    [syncSavedChapterState],
  );

  // Debounced save function
  const debouncedSave = useMemo(
    () =>
      debounce((content) => {
        void persistChapterContent(content);
      }, CHAPTER_AUTO_SAVE_DELAY),
    [persistChapterContent],
  );

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

  const loadedChapterIdRef = useRef(null);

  useEffect(() => {
    if (!selectedChapter || !editor) return;

    const isDifferentChapter =
      loadedChapterIdRef.current !== selectedChapter.id;

    if (isDifferentChapter) {
      debouncedSave.cancel?.();
      queuedSaveRef.current = null;

      editor.commands.setContent(selectedChapter.content || "");

      loadedChapterIdRef.current = selectedChapter.id;

      currentContentRef.current = selectedChapter.content || "";
      lastContentRef.current = selectedChapter.content || "";
      lastSavedContentRef.current = selectedChapter.content || "";
      setEditingStartTime(null);
      setLastVersionTime(null);
      setLastSavedAt(selectedChapter.updated_at || selectedChapter.created_at);
      setSaveState("saved");
      return;
    }

    // Same chapter: update metadata only, do not reset editor content/history
    lastSavedContentRef.current =
      selectedChapter.content || lastSavedContentRef.current;
    setLastSavedAt(selectedChapter.updated_at || selectedChapter.created_at);
    setSaveState(
      currentContentRef.current === (selectedChapter.content || "")
        ? "saved"
        : "dirty",
    );
  }, [selectedChapter, editor, debouncedSave]);

  useEffect(() => {
    return () => {
      debouncedSave.cancel?.();
    };
  }, [debouncedSave]);

  // Auto-version logic: Save a version snapshot after 10 minutes of editing
  useEffect(() => {
    if (!autoVersionEnabled || !selectedChapter || !editor) return;

    const checkAndSaveVersion = async () => {
      const currentContent = editor.getHTML();
      const hasContentChanged = currentContent !== lastContentRef.current;

      if (!hasContentChanged) {
        // No changes, reset editing timer
        setEditingStartTime(null);
        return;
      }

      // Start tracking editing time if not already
      if (!editingStartTime) {
        setEditingStartTime(Date.now());
        return;
      }

      // Check if 10 minutes have passed since editing started
      const timeSinceEditStart = Date.now() - editingStartTime;
      if (timeSinceEditStart >= AUTO_VERSION_INTERVAL) {
        // Also check if we haven't saved a version recently
        if (
          lastVersionTime &&
          Date.now() - lastVersionTime < AUTO_VERSION_INTERVAL
        ) {
          return;
        }

        // Save auto-version
        setAutoVersionSaving(true);
        try {
          const timestamp = new Date().toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          await versionsApi.create({
            parent_type: "chapter",
            parent_id: selectedChapter.id,
            content_snapshot: currentContent,
            label: `Auto snapshot - ${timestamp}`,
            created_by: "auto",
          });

          // Update tracking
          lastContentRef.current = currentContent;
          setLastVersionTime(Date.now());
          setEditingStartTime(null);

          toast.success("Auto-saved version snapshot", {
            description: "Your work has been preserved",
            icon: <GitBranch className="h-4 w-4" />,
          });
        } catch (error) {
          console.error("Auto-version save failed:", error);
        } finally {
          setAutoVersionSaving(false);
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkAndSaveVersion, 60 * 1000);

    return () => clearInterval(interval);
  }, [
    autoVersionEnabled,
    selectedChapter,
    editor,
    editingStartTime,
    lastVersionTime,
  ]);

  // Track content changes to detect editing
  useEffect(() => {
    if (!editor || !selectedChapter || !autoVersionEnabled) return;

    const handleUpdate = () => {
      const currentContent = editor.getHTML();
      if (currentContent !== lastContentRef.current && !editingStartTime) {
        setEditingStartTime(Date.now());
      }
    };

    editor.on("update", handleUpdate);
    return () => editor.off("update", handleUpdate);
  }, [editor, selectedChapter, autoVersionEnabled, editingStartTime]);

  // Writing stats tracking - log sessions every 5 minutes
  useEffect(() => {
    if (!editor || !selectedChapter) return;

    const logWritingSession = async () => {
      const currentWordCount = editor.storage.characterCount?.words() || 0;
      const wordDiff = currentWordCount - lastWordCountRef.current;

      // Only log if there's been writing activity
      if (wordDiff === 0 && !sessionStartTime) return;

      const timeSpent = sessionStartTime
        ? Math.floor((Date.now() - sessionStartTime) / 1000)
        : 0;

      // Only log if significant activity (at least 10 words or 60 seconds)
      if (Math.abs(wordDiff) >= 10 || timeSpent >= 60) {
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

          // Reset session tracking
          lastWordCountRef.current = currentWordCount;
          setSessionStartTime(null);
          setSessionWordCount(0);
        } catch (error) {
          console.error("Failed to log writing session:", error);
        }
      }
    };

    // Track when editing starts
    const handleEditorUpdate = () => {
      if (!sessionStartTime) {
        setSessionStartTime(Date.now());
        lastWordCountRef.current = editor.storage.characterCount?.words() || 0;
      }
      setSessionWordCount(editor.storage.characterCount?.words() || 0);
    };

    editor.on("update", handleEditorUpdate);

    // Log session every 5 minutes
    statsIntervalRef.current = setInterval(logWritingSession, 5 * 60 * 1000);

    // Also log on unmount/chapter change
    return () => {
      editor.off("update", handleEditorUpdate);
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      // Log final session
      logWritingSession();
    };
  }, [editor, selectedChapter, selectedProject, sessionStartTime]);

  const loadProjects = async () => {
    try {
      const res = await projectApi.getAll();
      setProjects(res.data);
      if (!projectId && res.data.length > 0) {
        setSelectedProject(res.data[0]);
        loadChapters(res.data[0].id);
      }
    } catch (error) {
      toast.error("Failed to load projects");
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
      toast.error("Failed to load chapters");
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
      toast.success("Chapter created!");
    } catch (error) {
      toast.error("Failed to add a new chapter");
    }
  };

  const handleSaveChapter = async () => {
    if (!selectedChapter || !editor) return;
    debouncedSave.cancel?.();
    await persistChapterContent(editor.getHTML(), {
      showSuccessToast: true,
      showErrorToast: true,
    });
  };

  const getSaveStatusLabel = () => {
    if (!selectedChapter) {
      return "No chapter selected";
    }

    if (saveState === "saving") {
      return "Saving...";
    }

    if (saveState === "dirty") {
      return "Unsaved changes";
    }

    if (saveState === "error") {
      return "Save failed";
    }

    if (lastSavedAt) {
      return `Saved ${new Date(lastSavedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }

    return "All changes saved";
  };

  const handleDeleteChapter = async () => {
    if (!selectedChapter) return;

    try {
      await chapterApi.delete(selectedChapter.id);
      const newChapters = chapters.filter((c) => c.id !== selectedChapter.id);
      setChapters(newChapters);
      setSelectedChapter(newChapters.length > 0 ? newChapters[0] : null);
      setDeleteChapterOpen(false);
      toast.success("Chapter deleted");
    } catch (error) {
      toast.error("Failed to delete chapter");
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
      toast.success("Chapter duplicated!");
    } catch (error) {
      toast.error("Failed to duplicate chapter");
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
      toast.success("Chapter renamed!");
    } catch (error) {
      toast.error("Failed to rename chapter");
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

      toast.success("Manuscript deleted successfully.");
    } catch (error) {
      toast.error("Failed to delete manuscript");
    }
  };

  const openRenameDialog = () => {
    if (selectedChapter) {
      setRenameChapterTitle(selectedChapter.title);
      setRenameChapterOpen(true);
    }
  };

  // Export Functions
  const handleExport = async () => {
    if (!selectedProject) {
      toast.error("No project selected");
      return;
    }

    if (chapters.length === 0) {
      toast.error("No chapters to export");
      return;
    }

    setExporting(true);
    try {
      let response;
      if (exportFormat === "docx") {
        response = await projectApi.exportDocx(
          selectedProject.id,
          exportIncludeTitlePage,
          exportIncludeChapterNumbers,
        );
      } else {
        response = await projectApi.exportPdf(
          selectedProject.id,
          exportIncludeTitlePage,
          exportIncludeChapterNumbers,
        );
      }

      // Create download link
      const blob = new Blob([response.data], {
        type:
          exportFormat === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const safeTitle = selectedProject.title
        .replace(/[^\w\s-]/g, "")
        .trim()
        .substring(0, 50);
      link.download = `${safeTitle || "manuscript"}.${exportFormat}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported as ${exportFormat.toUpperCase()} successfully!`);
      setExportDialogOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        "Failed to export: " + (error.response?.data?.detail || error.message),
      );
    } finally {
      setExporting(false);
    }
  };

  // AI Functions
  const handleRewriteForTone = async () => {
    const target = getAiTarget();

    if (!target.text?.trim()) {
      toast.error("No content to rewrite");
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
                `Chunk ${i + 1} failed`,
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
          "Failed to get AI response",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!editor || !editor.getText().trim()) {
      toast.error("No content to summarize");
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
      toast.error("Failed to get AI response");
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!selectedProject?.summary) {
      toast.error("Please add a summary to your project first");
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
      toast.error("Failed to generate outline");
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
      toast.error("Could not create version snapshot");
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

      const label = `AI Snapshot - ${actionLabel} - ${timestamp}`;

      await versionsApi.create({
        parent_type: "chapter",
        parent_id: selectedChapter.id,
        content_snapshot: currentContent,
        label,
        created_by: "ai",
      });

      setRefreshVersionsTrigger((prev) => prev + 1);
      return true;
    } catch (error) {
      console.error("AI snapshot failed:", error);
      toast.error("Version snapshot failed. AI content was not applied.");
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
      await persistChapterContent(updatedContent, {
        showSuccessToast: false,
        showErrorToast: true,
      });

      toast.success("Inserted into editor");
    } catch (error) {
      console.error("Insert into editor failed:", error);
      toast.error("Could not insert AI response");
    } finally {
      setApplyingAi(false);
    }
  };

  const handleReplaceSelection = async () => {
    if (!editor || !aiResponse?.trim()) return;
    if (applyingAi) return;

    if (!hasStoredSelection) {
      toast.error("Select text in the editor first");
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
      await persistChapterContent(updatedContent, {
        showSuccessToast: false,
        showErrorToast: true,
      });

      toast.success("Selection replaced");
    } catch (error) {
      console.error("Replace selection failed:", error);
      toast.error("Could not replace selection");
    } finally {
      setApplyingAi(false);
    }
  };

  const handleCopyAiResponse = async () => {
    if (!aiResponse?.trim()) return;

    try {
      await navigator.clipboard.writeText(aiResponse);
      toast.success("AI response copied");
    } catch (error) {
      console.error("Failed to copy AI response:", error);
      toast.error("Could not copy response");
    }
  };

  // Deny/dismiss the rewrite suggestion
  const handleDenyRewrite = () => {
    clearAiResponse();
    toast.info("Rewrite was dismissed");
  };

  // Upload Functions
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
      toast.error(`Unsupported file type. Allowed: ${allowedTypes.join(", ")}`);
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
        "Failed to preview file: " +
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
        "Failed to import manuscript: " +
          (error.response?.data?.detail || error.message),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleImportActionComplete = (actionId, result) => {
    // Handle specific actions if needed
    if (actionId === "autoformat" && selectedChapter && editor) {
      // Could apply the formatted content back to the editor
      toast.success("You can review the formatted content in the results");
    }
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
      setAiResponse("THAD couldn't rewrite that selection right now.");
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
                    Versions
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
                    Insight
                  </TabsTrigger>
                  <TabsTrigger
                    value="thad"
                    className="whitespace-nowrap"
                    data-testid="thad-tab"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    THAD
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
                          label: "New chapter",
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
                    Add A New Chapter
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
                    Import Your Manuscript
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
                    Duplicate Your Chapter
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
                    Rename Your Chapter
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
                    Delete Your Chapter
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
                      Export Your Manuscript
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
                      Delete Your Manuscript
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
                    refreshTrigger={refreshVersionsTrigger}
                    getCurrentContent={() => editor?.getHTML() || ""}
                    onRestoreVersion={(content) => {
                      if (editor) {
                        editor.commands.setContent(content);
                        toast.success("Version restored");
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
                          toast.success("Change applied to editor");
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
                              created_by: "thaddaeus",
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
                {focusMode ? "Exit Focus Mode" : "Focus Mode"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-version indicator */}
              <div
                className="flex items-center gap-2 px-2 py-1 rounded-sm bg-muted/50"
                data-testid="auto-version-indicator"
              >
                <div className="flex items-center gap-1.5">
                  {autoVersionSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  ) : (
                    <Clock
                      className={cn(
                        "h-3.5 w-3.5",
                        autoVersionEnabled
                          ? "text-accent"
                          : "text-muted-foreground",
                      )}
                    />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {autoVersionSaving ? "Saving version..." : "Auto-version"}
                  </span>
                </div>
                <Switch
                  checked={autoVersionEnabled}
                  onCheckedChange={setAutoVersionEnabled}
                  className="scale-75"
                  data-testid="auto-version-toggle"
                />
              </div>

              <div className="w-px h-6 bg-border" />

              <span
                className={cn(
                  "text-xs",
                  saveState === "error"
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
                onClick={handleSaveChapter}
                disabled={saving || !selectedChapter}
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
                  placeholder="New Chapter Title"
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
                            label: "New chapter",
                            icon: Plus,
                            onClick: () => setNewChapterOpen(true),
                            testId: "empty-editor-new-chapter-btn",
                          }
                        : undefined
                    }
                    secondaryAction={{
                      label: "Browse files to import",
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
                        THAD
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
                            THAD is working on selected text.
                          </div>
                        ) : (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            THAD will use the full chapter.
                          </div>
                        )}
                      </div>

                      {/* Writing Help */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Writing Help
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
                          Improve Writing
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
                          Chapter Summary
                        </Button>
                      </div>

                      {/* Structure */}
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Structure
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
                          Create Outline
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
                          Analyze Structure
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
                                <span>Preview The Suggested Rewrite</span>
                              </div>
                            )}

                            {/* AI Response Content */}
                            {aiResponseType === "rewrite" ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>Original Text</span>
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
                                    <span>Rewritten Text</span>
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
                                    ? "Applying..."
                                    : "Insert into Editor"}
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
                                    ? "Applying..."
                                    : "Replace Selection"}
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
                                Copy The Response
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
                                  Clear The Response
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
                                  Clear The Response
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Insert is non-destructive. Replace uses your
                              selected text.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            THAD is ready to help! Select a section of text OR
                            choose an action to get started.
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
            <DialogTitle className="font-serif">Add New Chapter</DialogTitle>
            <DialogDescription>
              Create a new chapter for your manuscript.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="chapterTitle">A New Chapter Title</Label>
            <Input
              id="chapterTitle"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="Enter new chapter title"
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
              Add A New Chapter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Chapter Dialog */}
      <Dialog open={renameChapterOpen} onOpenChange={setRenameChapterOpen}>
        <DialogContent data-testid="rename-chapter-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Rename Your Chapter
            </DialogTitle>
            <DialogDescription>
              Enter A New Name For This Chapter.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="renameChapterTitle">A New Chapter Title</Label>
            <Input
              id="renameChapterTitle"
              value={renameChapterTitle}
              onChange={(e) => setRenameChapterTitle(e.target.value)}
              placeholder="Enter new chapter title"
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
            <DialogTitle className="font-serif">
              Generate A Book Outline
            </DialogTitle>
            <DialogDescription>
              THAD will generate a chapter-by-chapter outline based on your
              project summary.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="chapterCount">Number of Chapters</Label>
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
              Generate Outline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Chapter Confirmation Dialog */}
      <AlertDialog open={deleteChapterOpen} onOpenChange={setDeleteChapterOpen}>
        <AlertDialogContent data-testid="delete-chapter-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this chapter?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The chapter &ldquo;
              {selectedChapter?.title}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChapter}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-chapter-btn"
            >
              Delete This Chapter
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
            <AlertDialogTitle>
              Are you sure you want to delete this manuscript?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The manuscript &ldquo;
              {selectedProject?.title}&rdquo; and all its chapters will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteManuscript}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-manuscript-btn"
            >
              Delete This Manuscript
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
              Export Your Manuscript
            </DialogTitle>
            <DialogDescription>
              Export &ldquo;{selectedProject?.title}&rdquo; as a document file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger
                  className="rounded-sm"
                  data-testid="export-format-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docx">Microsoft Word (.docx)</SelectItem>
                  <SelectItem value="pdf">PDF Document (.pdf)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-title" className="text-sm">
                  Include A Title Page
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
                  Include Chapter Numbers
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
                <strong>{chapters.length}</strong> Chapter
                {chapters.length !== 1 ? "s" : ""} Will Be Exported
              </p>
              <p className="mt-1">
                Total Words:{" "}
                <strong>
                  {selectedProject?.word_count?.toLocaleString() || 0}
                </strong>
              </p>
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
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export {exportFormat.toUpperCase()}
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
              Import Your Manuscript
            </DialogTitle>
            <DialogDescription>
              Preview And Import Your External Manuscript As A New Chapter.
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
                      {uploadPreview.file_type.toUpperCase()} •{" "}
                      {uploadPreview.word_count.toLocaleString()} Words
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
                <Label htmlFor="uploadChapterTitle">Chapter Title</Label>
                <Input
                  id="uploadChapterTitle"
                  value={uploadChapterTitle}
                  onChange={(e) => setUploadChapterTitle(e.target.value)}
                  placeholder="Enter chapter title"
                  className="rounded-sm"
                  data-testid="upload-chapter-title-input"
                />
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Content Preview</Label>
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
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import As A Chapter
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

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
