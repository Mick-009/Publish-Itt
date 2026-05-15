import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach the JWT token from localStorage to every request.
// AuthContext also sets axios.defaults.headers, but this interceptor ensures
// the api instance (which has its own config) also sends the token.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("publishitt_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// If the server returns 401, the token has expired — redirect to auth.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("publishitt_token");
      // Only redirect if not already on the auth page
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(error);
  },
);

// Project APIs
export const projectApi = {
  getAll: () => api.get("/projects"),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post("/projects", data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  exportDocx: (
    projectId,
    includeTitlePage = true,
    includeChapterNumbers = true,
    authorOverride = null,
  ) =>
    api.post(
      "/export/docx",
      {
        project_id: projectId,
        include_title_page: includeTitlePage,
        include_chapter_numbers: includeChapterNumbers,
        author_override: authorOverride,
      },
      { responseType: "blob" },
    ),
  exportPdf: (
    projectId,
    includeTitlePage = true,
    includeChapterNumbers = true,
    authorOverride = null,
  ) =>
    api.post(
      "/export/pdf",
      {
        project_id: projectId,
        include_title_page: includeTitlePage,
        include_chapter_numbers: includeChapterNumbers,
        author_override: authorOverride,
      },
      { responseType: "blob" },
    ),
  exportMarkdown: (
    projectId,
    includeTitlePage = true,
    includeChapterNumbers = true,
    authorOverride = null,
  ) =>
    api.post(
      "/export/markdown",
      {
        project_id: projectId,
        include_title_page: includeTitlePage,
        include_chapter_numbers: includeChapterNumbers,
        author_override: authorOverride,
      },
      { responseType: "blob" },
    ),
  exportEpub: (
    projectId,
    includeTitlePage = true,
    includeChapterNumbers = true,
    authorOverride = null,
  ) =>
    api.post(
      "/export/epub",
      {
        project_id: projectId,
        include_title_page: includeTitlePage,
        include_chapter_numbers: includeChapterNumbers,
        author_override: authorOverride,
      },
      { responseType: "blob" },
    ),
};

// Chapter APIs
export const chapterApi = {
  getByProject: (projectId) => api.get(`/chapters/project/${projectId}`),
  getById: (id) => api.get(`/chapters/${id}`),
  create: (data) => api.post("/chapters", data),
  update: (id, data) => api.put(`/chapters/${id}`, data),
  delete: (id) => api.delete(`/chapters/${id}`),
};

// Manuscript Upload APIs
export const uploadApi = {
  uploadManuscript: (file, projectId, chapterTitle = null) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", projectId);
    if (chapterTitle) {
      formData.append("chapter_title", chapterTitle);
    }
    return api.post("/manuscripts/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  previewManuscript: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/manuscripts/upload-preview", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Style Preset APIs
export const stylePresetApi = {
  getAll: () => api.get("/style-presets"),
  getById: (id) => api.get(`/style-presets/${id}`),
  create: (data) => api.post("/style-presets", data),
  update: (id, data) => api.put(`/style-presets/${id}`, data),
  delete: (id) => api.delete(`/style-presets/${id}`),
};

// Art Asset APIs
export const artAssetApi = {
  getByProject: (projectId) => api.get(`/art-assets/project/${projectId}`),
  create: (data) => api.post("/art-assets", data),
  delete: (id) => api.delete(`/art-assets/${id}`),
};

// Tone Profile APIs
export const toneProfileApi = {
  getByProject: (projectId) => api.get(`/tone-profiles/project/${projectId}`),
  getByChapter: (chapterId) => api.get(`/tone-profiles/chapter/${chapterId}`),
};

// AI APIs
export const aiApi = {
  rewrite: (content, tone) => api.post("/ai/rewrite", { content, tone }),
  summarize: (content) => api.post("/ai/summarize", { content }),
  generateOutline: (projectTitle, projectSummary, targetChapterCount) =>
    api.post("/ai/outline", {
      project_title: projectTitle,
      project_summary: projectSummary,
      target_chapter_count: targetChapterCount,
    }),
  analyzeWorkflow: (statusDescription) =>
    api.post("/ai/workflow-analysis", {
      status_description: statusDescription,
    }),
  analyzeWorkflowStage: (
    manuscript,
    sectionInfo,
    workflowStage,
    goals,
    timeAway,
    ageGroup,
    projectId,
  ) =>
    api.post("/ai/workflow-stage", {
      manuscript,
      section_info: sectionInfo,
      workflow_stage: workflowStage,
      goals,
      time_away: timeAway,
      age_group: ageGroup,
      project_id: projectId,
    }),
  analyzeTone: (
    content,
    projectId,
    chapterId,
    sectionInfo,
    intendedTone,
    goals,
    ageGroup,
  ) =>
    api.post("/ai/analyze-tone", {
      content,
      project_id: projectId,
      chapter_id: chapterId,
      section_info: sectionInfo,
      intended_tone: intendedTone,
      goals: goals,
      age_group: ageGroup,
    }),
  generateArtPrompts: (
    projectId,
    chapterId,
    stylePreset,
    promptType,
    context,
    artProfile,
  ) =>
    api.post("/ai/art-prompts", {
      project_id: projectId,
      chapter_id: chapterId,
      style_preset: stylePreset,
      prompt_type: promptType,
      context,
      art_profile: artProfile,
    }),
  generateArtProfileSummary: (profile) =>
    api.post("/ai/art-profile-summary", profile),
  extractScene: (chapterContent, artProfile) =>
    api.post("/ai/extract-scene", {
      chapter_content: chapterContent,
      art_profile: artProfile,
    }),
  generateSceneArtPrompt: (
    projectId,
    chapterId,
    sceneText,
    promptType,
    stylePreset,
    artProfile,
  ) =>
    api.post("/ai/scene-art-prompt", {
      project_id: projectId,
      chapter_id: chapterId,
      scene_text: sceneText,
      prompt_type: promptType,
      style_preset: stylePreset,
      art_profile: artProfile,
    }),
  generateImage: (
    prompt,
    size = "1024x1024",
    projectId = null,
    chapterId = null,
    imageType = "cover",
  ) =>
    api.post(
      "/ai/generate-image",
      {
        prompt,
        size,
        project_id: projectId,
        chapter_id: chapterId,
        image_type: imageType,
      },
      { timeout: 120000 },
    ), // 2 minute timeout for image generation
  chat: (message, chapterContent, selectedText = null, projectId = null) =>
    api.post("/ai/chat", {
      message,
      chapter_content: chapterContent,
      selected_text: selectedText,
      project_id: projectId,
    }),
  askThad: (query, context) => api.post("/ai/ask-thad", { query, context }),
  thadWelcome: (userName, bookTitle, ageGroup, theme, deviceType) =>
    api.post("/ai/thad/welcome", {
      user_name: userName,
      book_title: bookTitle,
      age_group: ageGroup,
      theme: theme,
      device_type: deviceType,
    }),
  thadTour: (userName, bookTitle, ageGroup, theme, deviceType, currentStep) =>
    api.post("/ai/thad/tour", {
      user_name: userName,
      book_title: bookTitle,
      age_group: ageGroup,
      theme: theme,
      device_type: deviceType,
      current_step: currentStep,
    }),
};

// Phase 2: regenerate-with-feedback for Thad outputs.
//
// All endpoints sit under /api/thad/* and require auth.
// source_type is one of "analysis" or "workflow_recommendation".
// source_id is the chapter ID for analysis sources, a stable workflow ID
// (or the project ID) for workflow recommendations.
export const thadApi = {
  // Send writer feedback. Thad returns a new response in the same shape
  // as the previous one (parse it on the frontend).
  regenerate: (sourceType, sourceId, projectId, userFeedback, previousResponse) =>
    api.post("/thad/regenerate", {
      source_type: sourceType,
      source_id: sourceId,
      project_id: projectId,
      user_feedback: userFeedback,
      previous_response: previousResponse,
    }),

  // Get all revisions for a given source, newest first.
  getRevisions: (sourceType, sourceId, projectId) =>
    api.get(`/thad/revisions/${sourceType}/${sourceId}`, {
      params: { project_id: projectId },
    }),

  // List active style notes for a project.
  // Pass includeInactive=true to also get retired ones.
  listStyleNotes: (projectId, includeInactive = false) =>
    api.get("/thad/style-notes", {
      params: { project_id: projectId, include_inactive: includeInactive },
    }),

  createStyleNote: (projectId, note, sourceRevisionId = null) =>
    api.post("/thad/style-notes", {
      project_id: projectId,
      note,
      source_revision_id: sourceRevisionId,
    }),

  // Toggle active/inactive — keeps history, hides from future analyses.
  setStyleNoteActive: (noteId, active) =>
    api.patch(`/thad/style-notes/${noteId}`, { active }),

  // Hard delete — gone for good.
  deleteStyleNote: (noteId) => api.delete(`/thad/style-notes/${noteId}`),
};

// Phase 3a: wow-moment onboarding.
//
// getSamples returns the curated genre/excerpt/Thad-read JSON.
// getStatus returns { onboarding_complete: bool } from the user record.
// complete marks the user's onboarding done (used for both finish and skip).
// reset clears the flag — used by the "Replay the intro" link in settings.
export const onboardingApi = {
  getSamples: () => api.get("/onboarding/samples"),
  getStatus: () => api.get("/onboarding/status"),
  complete: ({ chosen_genre = null, skipped = false } = {}) =>
    api.post("/onboarding/complete", {
      chosen_genre,
      skipped,
    }),
  reset: () => api.post("/onboarding/reset"),
};

// Market Intelligence APIs
export const marketApi = {
  generateBookIdeas: (universe, count = 10) =>
    api.post("/ai/market/book-ideas", { universe, count }),
  analyzeMarket: (genre, ageGroup) =>
    api.post("/ai/market/analysis", { genre, age_group: ageGroup }),
  customerResearch: (bookIdea) =>
    api.post("/ai/market/customer-research", { book_idea: bookIdea }),
  generateMarketOutline: (bookIdea, chapterCount = 12) =>
    api.post("/ai/market/outline", {
      book_idea: bookIdea,
      chapter_count: chapterCount,
    }),
  generateManuscriptDraft: (bookIdea, wordCount = 30000) =>
    api.post("/ai/market/manuscript-draft", {
      book_idea: bookIdea,
      word_count: wordCount,
    }),
  generateBookDescription: (bookTitle, bookSummary) =>
    api.post("/ai/market/book-description", {
      book_title: bookTitle,
      book_summary: bookSummary,
    }),
  analyzeSales: (salesData) =>
    api.post("/ai/market/sales-analysis", { sales_data: salesData }),
};

// Import Analysis APIs
export const importAnalysisApi = {
  analyze: (content, filename, projectId, chapterId) =>
    api.post("/ai/import/analyze", {
      content,
      filename,
      project_id: projectId,
      chapter_id: chapterId,
    }),
  executeAction: (action, content, projectId, chapterId) =>
    api.post("/ai/import/action", {
      action,
      content,
      project_id: projectId,
      chapter_id: chapterId,
    }),
  implementAction: (
    action,
    originalContent,
    chapterId,
    projectId,
    extractedNotes = null,
  ) =>
    api.post("/ai/import/implement", {
      action,
      original_content: originalContent,
      chapter_id: chapterId,
      project_id: projectId,
      apply_content: true,
      extracted_notes: extractedNotes,
    }),
  splitAndCreateChapters: (content, projectId, manuscriptId) =>
    api.post("/ai/import/split-chapters", {
      content,
      project_id: projectId,
      manuscript_id: manuscriptId,
    }),
};

// ============== DATA COLLECTIONS APIs ==============

// ============== DEPRECATED APIs ==============
// NOTE: manuscriptsApi and migrationApi are deprecated.
// Use projectApi for all project/manuscript operations.
// These are kept for backward compatibility only.

// Manuscripts Collection (DEPRECATED - use projectApi instead)
export const manuscriptsApi = {
  /** @deprecated Use projectApi.getAll() instead */
  getAll: () => {
    console.warn(
      "[DEPRECATED] manuscriptsApi.getAll() - use projectApi.getAll() instead",
    );
    return api.get("/manuscripts-collection");
  },
  /** @deprecated Use projectApi.getById() instead */
  getById: (id) => {
    console.warn(
      "[DEPRECATED] manuscriptsApi.getById() - use projectApi.getById() instead",
    );
    return api.get(`/manuscripts-collection/${id}`);
  },
  /** @deprecated Use projectApi.create() instead */
  create: (data) => {
    console.warn(
      "[DEPRECATED] manuscriptsApi.create() - use projectApi.create() instead",
    );
    return api.post("/manuscripts-collection", data);
  },
  /** @deprecated Use projectApi.update() instead */
  update: (id, data) => {
    console.warn(
      "[DEPRECATED] manuscriptsApi.update() - use projectApi.update() instead",
    );
    return api.put(`/manuscripts-collection/${id}`, data);
  },
  /** @deprecated Use projectApi.delete() instead */
  delete: (id) => {
    console.warn(
      "[DEPRECATED] manuscriptsApi.delete() - use projectApi.delete() instead",
    );
    return api.delete(`/manuscripts-collection/${id}`);
  },
  /** @deprecated Use chapterApi.getByProject() instead */
  getChapters: (id) => {
    console.warn(
      "[DEPRECATED] manuscriptsApi.getChapters() - use chapterApi.getByProject() instead",
    );
    return api.get(`/manuscripts-collection/${id}/chapters`);
  },
};

// Versions Collection
export const versionsApi = {
  getByParent: (parentType, parentId) =>
    api.get(`/versions/parent/${parentType}/${parentId}`),
  getById: (id) => api.get(`/versions/${id}`),
  create: (data) => api.post("/versions", data),
  delete: (id) => api.delete(`/versions/${id}`),
};

// Notes Collection
export const notesApi = {
  getByParent: (parentType, parentId) =>
    api.get(`/notes/parent/${parentType}/${parentId}`),
  getById: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post("/notes", data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
};

// Migration API (DEPRECATED)
export const migrationApi = {
  /** @deprecated The manuscripts_collection pattern is deprecated */
  migrateProjectsToManuscripts: () => {
    console.warn(
      "[DEPRECATED] migrationApi.migrateProjectsToManuscripts() - manuscripts_collection is deprecated",
    );
    return api.post("/migrate/projects-to-manuscripts");
  },
};

// Book Art Profile API
export const artProfileApi = {
  getByProject: (projectId) => api.get(`/art-profiles/project/${projectId}`),
  createOrUpdate: (data) => api.post("/art-profiles", data),
  update: (projectId, data) =>
    api.put(`/art-profiles/project/${projectId}`, data),
};

// Writing Statistics API
export const statsApi = {
  logSession: (data) => api.post("/stats/session", data),
  getDailyStats: (date) => api.get(`/stats/daily/${date}`),
  getStreak: () => api.get("/stats/streak"),
  getOverview: () => api.get("/stats/overview"),
  getWeekly: () => api.get("/stats/weekly"),
  getToday: () => api.get("/stats/today"),
  getMomentum: (
    dailyWords,
    weeklyWords,
    streak,
    totalWords,
    sessionMinutes,
    timeAway,
    goals,
    ageGroup,
  ) =>
    api.post("/ai/writing-momentum", {
      daily_words: dailyWords,
      weekly_words: weeklyWords,
      streak: streak,
      total_words: totalWords,
      session_minutes: sessionMinutes,
      time_away: timeAway,
      goals: goals,
      age_group: ageGroup,
    }),
};

// User Preferences API
export const userApi = {
  updatePreferences: (data) => api.patch("/auth/me/preferences", data),
};

// Import Manuscript Action
export const actionsApi = {
  importManuscript: (file, title = null) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title) {
      formData.append("title", title);
    }
    return api.post("/actions/import-manuscript", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export default api;
