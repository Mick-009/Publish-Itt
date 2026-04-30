/**
 * useChapterAutosave
 *
 * Encapsulates all autosave, auto-versioning, and dirty-state logic that
 * previously lived inside ManuscriptWorkspace. Drop-in replacement — the
 * component just passes the editor and selectedChapter in and gets back the
 * same refs and state it needs to render.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { chapterApi, versionsApi } from "@/lib/api";
import { toast } from "sonner";

const AUTO_VERSION_INTERVAL = 10 * 60 * 1000; // 10 minutes
const CHAPTER_AUTO_SAVE_DELAY = 2000;          // 2 seconds debounce

// ── Simple debounce util (keeps the hook self-contained) ─────────────────────
function debounce(fn, wait) {
  let timeout;
  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}

export function useChapterAutosave({ editor, selectedChapter, selectedProject, versionsApi: _versionsApi }) {
  // ── Save state ───────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("saved"); // "saved" | "saving" | "dirty" | "error"
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // ── Version state ────────────────────────────────────────────────────────
  const [autoVersionEnabled, setAutoVersionEnabled] = useState(true);
  const [lastVersionTime, setLastVersionTime] = useState(null);
  const [editingStartTime, setEditingStartTime] = useState(null);
  const [autoVersionSaving, setAutoVersionSaving] = useState(false);
  const [refreshVersionsTrigger, setRefreshVersionsTrigger] = useState(0);

  // ── Internal refs ────────────────────────────────────────────────────────
  const lastContentRef = useRef("");
  const lastSavedContentRef = useRef("");
  const currentContentRef = useRef("");
  const selectedChapterRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(null);

  // Keep ref in sync so async callbacks always see latest chapter
  useEffect(() => {
    selectedChapterRef.current = selectedChapter;
  }, [selectedChapter]);

  // ── Sync helper: update chapter in parent state after save ───────────────
  // Returns a function so the workspace can pass its setState down.
  // We accept optional setChapters/setSelectedChapter from outside.
  const [_setChapters, _setSelectedChapter] = useState([null, null]);
  const setExternalState = useCallback((setChapters, setSelectedChapter) => {
    _setChapters[0] = setChapters;
    _setChapters[1] = setSelectedChapter;
  }, []); // eslint-disable-line

  const syncSavedChapterState = useCallback((chapterId, savedChapter, content) => {
    _setChapters[0]?.((prev) =>
      prev.map((ch) => (ch.id === chapterId ? { ...ch, ...savedChapter, content } : ch))
    );
    _setChapters[1]?.((prev) =>
      prev?.id === chapterId ? { ...prev, ...savedChapter, content } : prev
    );
  }, []); // eslint-disable-line

  // ── Core persist function ─────────────────────────────────────────────────
  const persistChapterContent = useCallback(
    async (content, { showSuccessToast = false, showErrorToast = false } = {}) => {
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
          showSuccessToast: queuedSaveRef.current?.showSuccessToast || showSuccessToast,
          showErrorToast: queuedSaveRef.current?.showErrorToast || showErrorToast,
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
          setSaveState(currentContentRef.current === content ? "saved" : "dirty");
        }
        if (showSuccessToast) toast.success("Chapter saved!");
      } catch (error) {
        console.error("Chapter save failed:", error);
        if (selectedChapterRef.current?.id === chapterId) setSaveState("error");
        if (showErrorToast) toast.error("Failed to save chapter");
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);

        const queued = queuedSaveRef.current;
        queuedSaveRef.current = null;
        if (queued) {
          void persistChapterContent(queued.content, {
            showSuccessToast: queued.showSuccessToast,
            showErrorToast: queued.showErrorToast,
          });
        }
      }
    },
    [syncSavedChapterState],
  );

  // ── Debounced wrapper ─────────────────────────────────────────────────────
  const debouncedSave = useMemo(
    () => debounce((content) => { void persistChapterContent(content); }, CHAPTER_AUTO_SAVE_DELAY),
    [persistChapterContent],
  );

  // ── Load chapter into editor when selection changes ───────────────────────
  const loadedChapterIdRef = useRef(null);

  useEffect(() => {
    if (!selectedChapter || !editor) return;

    const isDifferentChapter = loadedChapterIdRef.current !== selectedChapter.id;

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

    // Same chapter — just sync metadata
    lastSavedContentRef.current = selectedChapter.content || lastSavedContentRef.current;
    setLastSavedAt(selectedChapter.updated_at || selectedChapter.created_at);
    setSaveState(
      currentContentRef.current === (selectedChapter.content || "") ? "saved" : "dirty"
    );
  }, [selectedChapter, editor, debouncedSave]);

  // Cleanup on unmount
  useEffect(() => () => { debouncedSave.cancel?.(); }, [debouncedSave]);

  // ── Editor onUpdate wiring ────────────────────────────────────────────────
  // Returns a handler to attach to the editor's onUpdate callback
  const handleEditorUpdate = useCallback(
    (content) => {
      currentContentRef.current = content;
      if (!selectedChapterRef.current) return;

      if (content === lastSavedContentRef.current) {
        setSaveState((prev) => (prev === "error" ? prev : "saved"));
        return;
      }
      setSaveState((prev) => (prev === "dirty" ? prev : "dirty"));
      debouncedSave(content);
    },
    [debouncedSave],
  );

  // ── Auto-versioning ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoVersionEnabled || !selectedChapter || !editor) return;

    const check = async () => {
      const currentContent = editor.getHTML();
      const hasChanged = currentContent !== lastContentRef.current;

      if (!hasChanged) { setEditingStartTime(null); return; }
      if (!editingStartTime) { setEditingStartTime(Date.now()); return; }

      const elapsed = Date.now() - editingStartTime;
      if (elapsed < AUTO_VERSION_INTERVAL) return;
      if (lastVersionTime && Date.now() - lastVersionTime < AUTO_VERSION_INTERVAL) return;

      setAutoVersionSaving(true);
      try {
        const timestamp = new Date().toLocaleString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
        await versionsApi.create({
          parent_type: "chapter",
          parent_id: selectedChapter.id,
          content_snapshot: currentContent,
          label: `Auto snapshot - ${timestamp}`,
          created_by: "auto",
        });

        lastContentRef.current = currentContent;
        setLastVersionTime(Date.now());
        setEditingStartTime(null);
        setRefreshVersionsTrigger((n) => n + 1);
        toast.success("Auto-saved version snapshot", { description: "Your work has been preserved" });
      } catch (err) {
        console.error("Auto-version save failed:", err);
      } finally {
        setAutoVersionSaving(false);
      }
    };

    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [autoVersionEnabled, selectedChapter, editor, editingStartTime, lastVersionTime]);

  // Track editing start time
  useEffect(() => {
    if (!editor || !selectedChapter || !autoVersionEnabled) return;
    const onUpdate = () => {
      const content = editor.getHTML();
      if (content !== lastContentRef.current && !editingStartTime) {
        setEditingStartTime(Date.now());
      }
    };
    editor.on("update", onUpdate);
    return () => editor.off("update", onUpdate);
  }, [editor, selectedChapter, autoVersionEnabled, editingStartTime]);

  // ── Manual save trigger ───────────────────────────────────────────────────
  const manualSave = useCallback(async () => {
    if (saveState === "error") {
      toast.error("Save failed. Please check your connection.");
      return;
    }
    const content = currentContentRef.current;
    debouncedSave.cancel?.();
    await persistChapterContent(content, { showSuccessToast: true, showErrorToast: true });
  }, [saveState, debouncedSave, persistChapterContent]);

  return {
    // State
    saving,
    saveState,
    lastSavedAt,
    autoVersionEnabled,
    setAutoVersionEnabled,
    autoVersionSaving,
    refreshVersionsTrigger,
    setRefreshVersionsTrigger,
    // Refs (expose for the workspace component)
    currentContentRef,
    lastSavedContentRef,
    // Actions
    handleEditorUpdate,
    persistChapterContent,
    debouncedSave,
    manualSave,
    setExternalState,
    setLastSavedAt,
    setSaveState,
  };
}
