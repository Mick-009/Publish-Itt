import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  projectApi,
  chapterApi,
  stylePresetApi,
  artAssetApi,
  aiApi,
  artProfileApi,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Sparkles,
  ImageIcon,
  Book,
  FileImage,
  Image,
  Save,
  Trash2,
  Palette,
  RefreshCw,
  ArrowRight,
  Check,
  Lightbulb,
  Wand2,
  Eye,
  Users,
  MapPin,
  Zap,
  Edit3,
  RotateCcw,
  ImagePlus,
  Download,
} from "lucide-react";

// Genre options
const GENRE_OPTIONS = [
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Thriller",
  "Romance",
  "Horror",
  "Historical Fiction",
  "Literary Fiction",
  "Adventure",
  "Children's",
  "Middle Grade",
  "Young Adult",
  "Non-Fiction",
];

// Age group options
const AGE_GROUP_OPTIONS = [
  "Picture Book (0-5)",
  "Early Reader (5-8)",
  "Middle Grade (8-12)",
  "Young Adult (12-18)",
  "New Adult (18-25)",
  "Adult",
];

// Mood options
const MOOD_OPTIONS = [
  "Whimsical",
  "Dark",
  "Mysterious",
  "Uplifting",
  "Melancholic",
  "Adventurous",
  "Romantic",
  "Suspenseful",
  "Cozy",
  "Epic",
  "Playful",
  "Serene",
  "Intense",
  "Nostalgic",
];

// Art style options
const ART_STYLE_OPTIONS = [
  "Watercolor",
  "Oil Painting",
  "Digital Art",
  "Line Art",
  "Cartoon",
  "Realistic",
  "Abstract",
  "Minimalist",
  "Vintage",
  "Art Nouveau",
  "Comic Book",
  "Storybook Illustration",
  "Photorealistic",
  "Impressionist",
];

export default function ArtStudio() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [stylePresets, setStylePresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [artAssets, setArtAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [promptType, setPromptType] = useState("cover");
  const [context, setContext] = useState("");
  const [activeTab, setActiveTab] = useState("generate");

  // Book Art Profile State
  const [artProfile, setArtProfile] = useState({
    project_id: "",
    genre: "",
    age_group: "",
    mood: "",
    art_style_preferences: "",
    color_palette: "",
    reference_notes: "",
    ai_summary: null,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSummaryLoading, setProfileSummaryLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Refinement Suggestions State
  const [refinementSuggestions, setRefinementSuggestions] = useState([]);
  const [showRefinements, setShowRefinements] = useState(false);
  const [refinementsLoading, setRefinementsLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Scene Extraction State
  const [extractedScene, setExtractedScene] = useState("");
  const [sceneExtracting, setSceneExtracting] = useState(false);
  const [useExtractedScene, setUseExtractedScene] = useState(true);

  // Structured Art Prompt Output
  const [artPromptResult, setArtPromptResult] = useState(null);

  // Image Generation State
  const [generatedImage, setGeneratedImage] = useState(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageSize, setImageSize] = useState("1024x1024");

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setSelectedProject(project);
        loadChapters(projectId);
        loadArtAssets(projectId);
        loadArtProfile(projectId, project);
      }
    }
  }, [projectId, projects]);

  const loadInitialData = async () => {
    try {
      const [projectsRes, presetsRes] = await Promise.all([
        projectApi.getAll(),
        stylePresetApi.getAll(),
      ]);
      setProjects(projectsRes.data);
      setStylePresets(presetsRes.data);

      if (!projectId && projectsRes.data.length > 0) {
        const firstProject = projectsRes.data[0];
        setSelectedProject(firstProject);
        loadChapters(firstProject.id);
        loadArtAssets(firstProject.id);
        loadArtProfile(firstProject.id, firstProject);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async (projId) => {
    try {
      const res = await chapterApi.getByProject(projId);
      setChapters(res.data);
    } catch (error) {
      console.error("Failed to load chapters");
    }
  };

  const loadArtAssets = async (projId) => {
    try {
      const res = await artAssetApi.getByProject(projId);
      setArtAssets(res.data);
    } catch (error) {
      console.error("Failed to load art assets");
    }
  };

  const loadArtProfile = async (projId, project) => {
    setProfileLoading(true);
    setProfileLoaded(false);
    try {
      const res = await artProfileApi.getByProject(projId);
      setArtProfile(res.data);
      setHasUnsavedChanges(false);
      setProfileLoaded(true);
    } catch (error) {
      // Profile doesn't exist yet - auto-suggest based on project metadata
      const suggestedProfile = {
        project_id: projId,
        genre: project?.genre || "",
        age_group: project?.age_group || "",
        mood: "",
        art_style_preferences: "",
        color_palette: "",
        reference_notes: "",
        ai_summary: null,
      };
      setArtProfile(suggestedProfile);
      setHasUnsavedChanges(false);
      setProfileLoaded(true);
    } finally {
      setProfileLoading(false);
    }
  };

  // Auto-generate suggestions when profile has existing summary
  const generateSuggestions = useCallback(
    async (profileData) => {
      if (!profileData?.ai_summary || !selectedProject) return;

      setRefinementsLoading(true);
      try {
        const res = await aiApi.generateArtProfileSummary({
          ...profileData,
          project_id: selectedProject.id,
        });

        if (res.data.refinements && res.data.refinements.length > 0) {
          setRefinementSuggestions(res.data.refinements);
          setShowRefinements(true);
        }
      } catch (error) {
        console.error("Failed to auto-generate suggestions:", error);
      } finally {
        setRefinementsLoading(false);
      }
    },
    [selectedProject],
  );

  // Auto-regenerate suggestions when profile loads with existing summary
  useEffect(() => {
    if (profileLoaded && artProfile?.ai_summary) {
      generateSuggestions(artProfile);
    }
  }, [profileLoaded, artProfile, generateSuggestions]);

  const handleProjectChange = (projId) => {
    const project = projects.find((p) => p.id === projId);
    setSelectedProject(project);
    setSelectedChapter(null);
    setExtractedScene("");
    setArtPromptResult(null);
    navigate(`/art/${projId}`);
    loadChapters(projId);
    loadArtAssets(projId);
    loadArtProfile(projId, project);
    setAiResponse("");
  };

  // Extract visually rich scene from chapter content
  const extractSceneFromChapter = async (chapter) => {
    if (!chapter?.content) {
      setExtractedScene("");
      return;
    }

    setSceneExtracting(true);
    try {
      // Use AI to identify the most visually rich moment
      const res = await aiApi.extractScene(chapter.content, artProfile);
      if (res.data?.scene) {
        setExtractedScene(res.data.scene);
        setUseExtractedScene(true);
      }
    } catch (error) {
      console.error("Scene extraction failed:", error);
      // Fallback: use first 500 characters of chapter content
      const plainText = chapter.content.replace(/<[^>]*>/g, "").trim();
      setExtractedScene(
        plainText.substring(0, 500) + (plainText.length > 500 ? "..." : ""),
      );
    } finally {
      setSceneExtracting(false);
    }
  };

  const handleChapterChange = (chapterId) => {
    if (chapterId === "none") {
      setSelectedChapter(null);
      setExtractedScene("");
    } else {
      const chapter = chapters.find((c) => c.id === chapterId);
      setSelectedChapter(chapter);
      if (chapter) {
        extractSceneFromChapter(chapter);
      }
    }
  };

  const handleProfileChange = (field, value) => {
    setArtProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedProject) return;

    setProfileLoading(true);
    try {
      const profileData = {
        ...artProfile,
        project_id: selectedProject.id,
      };
      await artProfileApi.createOrUpdate(profileData);
      setHasUnsavedChanges(false);
      toast.success("Art profile saved!");
    } catch (error) {
      toast.error("Failed to save art profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleGenerateProfileSummary = async () => {
    if (!selectedProject) return;

    setProfileSummaryLoading(true);
    setRefinementsLoading(true);
    try {
      const res = await aiApi.generateArtProfileSummary({
        ...artProfile,
        project_id: selectedProject.id,
      });

      setArtProfile((prev) => ({
        ...prev,
        ai_summary: res.data.summary,
      }));

      // Store refinements for the bubble display
      if (res.data.refinements && res.data.refinements.length > 0) {
        setRefinementSuggestions(res.data.refinements);
        setShowRefinements(true);
      }

      setHasUnsavedChanges(true);
      toast.success("Visual identity summary generated!");
    } catch (error) {
      toast.error("Failed to generate summary");
    } finally {
      setProfileSummaryLoading(false);
      setRefinementsLoading(false);
    }
  };

  const handleRegenerateRefinements = async () => {
    if (!selectedProject) return;

    setRefinementsLoading(true);
    try {
      const res = await aiApi.generateArtProfileSummary({
        ...artProfile,
        project_id: selectedProject.id,
      });

      // Update refinements
      if (res.data.refinements && res.data.refinements.length > 0) {
        setRefinementSuggestions(res.data.refinements);
        toast.success("Refinement suggestions updated!");
      }

      // Also update summary if available
      if (res.data.summary) {
        setArtProfile((prev) => ({
          ...prev,
          ai_summary: res.data.summary,
        }));
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      toast.error("Failed to regenerate suggestions");
    } finally {
      setRefinementsLoading(false);
    }
  };

  const handleGeneratePrompts = async () => {
    if (!selectedProject) {
      toast.error("Please select a project");
      return;
    }
    if (!selectedPreset) {
      toast.error("Please select a style preset");
      return;
    }

    setAiLoading(true);
    setArtPromptResult(null);

    try {
      // Determine scene text: use extracted scene if enabled, otherwise use manual context
      const sceneText =
        useExtractedScene && extractedScene ? extractedScene : context;

      if (!sceneText && promptType !== "cover") {
        toast.error("Please provide scene context or select a chapter");
        setAiLoading(false);
        return;
      }

      const res = await aiApi.generateSceneArtPrompt(
        selectedProject.id,
        selectedChapter?.id,
        sceneText || selectedProject.summary || selectedProject.title,
        promptType,
        selectedPreset,
        artProfile,
      );

      // Store structured result
      setArtPromptResult(res.data);

      // Keep legacy response for saving
      setAiResponse(res.data.main_prompt || res.data.response);

      // Clear any previous generated image
      setGeneratedImage(null);

      toast.success("Art prompt generated!");
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Failed to generate art prompts");
    } finally {
      setAiLoading(false);
    }
  };

  // Generate actual image from the prompt
  const handleGenerateImage = async () => {
    const prompt = artPromptResult?.main_prompt || aiResponse;
    if (!prompt) {
      toast.error("Please generate an art prompt first");
      return;
    }

    setImageGenerating(true);
    setGeneratedImage(null);

    try {
      const res = await aiApi.generateImage(
        prompt,
        imageSize,
        selectedProject?.id,
        selectedChapter?.id,
        promptType,
      );

      if (res.data.success && res.data.image_base64) {
        setGeneratedImage(res.data.image_base64);
        toast.success("Image generated successfully!");

        // Reload assets if a new one was created
        if (res.data.asset_id && selectedProject) {
          loadArtAssets(selectedProject.id);
        }
      } else {
        toast.error(res.data.message || "Failed to generate image");
      }
    } catch (error) {
      console.error("Image generation failed:", error);
      toast.error(
        "Failed to generate image: " +
          (error.response?.data?.detail || error.message),
      );
    } finally {
      setImageGenerating(false);
    }
  };

  const handleSaveAsset = async () => {
    const promptToSave = artPromptResult?.main_prompt || aiResponse;
    if (!promptToSave || !selectedProject) return;

    try {
      await artAssetApi.create({
        project_id: selectedProject.id,
        chapter_id: selectedChapter?.id,
        type: promptType,
        style_preset: selectedPreset,
        prompt_used: promptToSave,
        status: "generated",
      });
      loadArtAssets(selectedProject.id);
      toast.success("Art asset saved!");
    } catch (error) {
      toast.error("Failed to save art asset");
    }
  };

  const handleDeleteAsset = async (assetId) => {
    try {
      await artAssetApi.delete(assetId);
      setArtAssets(artAssets.filter((a) => a.id !== assetId));
      toast.success("Asset deleted");
    } catch (error) {
      toast.error("Failed to delete asset");
    }
  };

  const promptTypeOptions = [
    { value: "cover", label: "Cover Art", icon: Book },
    { value: "chapter_header", label: "Chapter Header", icon: FileImage },
    { value: "spot_illustration", label: "Spot Illustration", icon: Image },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="font-serif text-2xl mb-2">No Projects Yet</h2>
        <p className="text-muted-foreground mb-4">
          Create a project to generate art prompts
        </p>
        <Button onClick={() => navigate("/")} className="rounded-sm">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div
      className="p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in"
      data-testid="art-studio"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
            Cover & Art
          </h1>
          <p className="mt-2 text-muted-foreground">
            Define your visual identity and generate art prompts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedProject?.id}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger
              className="w-48 rounded-sm"
              data-testid="art-project-select"
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
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-sm">
          <TabsTrigger
            value="profile"
            className="rounded-sm"
            data-testid="art-profile-tab"
          >
            <Palette className="h-4 w-4 mr-2" />
            Book Art Profile
          </TabsTrigger>
          <TabsTrigger
            value="generate"
            className="rounded-sm"
            data-testid="generate-tab"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Art
          </TabsTrigger>
        </TabsList>

        {/* Book Art Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Palette className="h-5 w-5 text-accent" />
                      Visual Identity
                    </CardTitle>
                    <CardDescription>
                      Define the artistic direction for your book
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <Badge
                        variant="outline"
                        className="text-orange-500 border-orange-500/50"
                      >
                        Unsaved changes
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveProfile}
                      disabled={profileLoading || !hasUnsavedChanges}
                      className="rounded-sm"
                      data-testid="save-profile-btn"
                    >
                      {profileLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save Profile
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Genre */}
                  <div className="space-y-2">
                    <Label htmlFor="genre">Genre</Label>
                    <Select
                      value={artProfile.genre}
                      onValueChange={(v) => handleProfileChange("genre", v)}
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="profile-genre"
                      >
                        <SelectValue placeholder="Select genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRE_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Age Group */}
                  <div className="space-y-2">
                    <Label htmlFor="age_group">Age Group</Label>
                    <Select
                      value={artProfile.age_group}
                      onValueChange={(v) => handleProfileChange("age_group", v)}
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="profile-age-group"
                      >
                        <SelectValue placeholder="Select age group" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_GROUP_OPTIONS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mood */}
                  <div className="space-y-2">
                    <Label htmlFor="mood">Mood</Label>
                    <Select
                      value={artProfile.mood}
                      onValueChange={(v) => handleProfileChange("mood", v)}
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="profile-mood"
                      >
                        <SelectValue placeholder="Select mood" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOOD_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Art Style */}
                  <div className="space-y-2">
                    <Label htmlFor="art_style">Art Style Preferences</Label>
                    <Select
                      value={artProfile.art_style_preferences}
                      onValueChange={(v) =>
                        handleProfileChange("art_style_preferences", v)
                      }
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="profile-art-style"
                      >
                        <SelectValue placeholder="Select art style" />
                      </SelectTrigger>
                      <SelectContent>
                        {ART_STYLE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Color Palette */}
                <div className="space-y-2">
                  <Label htmlFor="color_palette">Color Palette</Label>
                  <Input
                    id="color_palette"
                    placeholder="e.g., Earth tones with deep forest greens and golden highlights"
                    value={artProfile.color_palette}
                    onChange={(e) =>
                      handleProfileChange("color_palette", e.target.value)
                    }
                    className="rounded-sm"
                    data-testid="profile-color-palette"
                  />
                </div>

                {/* Reference Notes */}
                <div className="space-y-2">
                  <Label htmlFor="reference_notes">Reference Notes</Label>
                  <Textarea
                    id="reference_notes"
                    placeholder="Add any reference artists, existing book covers you like, or specific visual elements you want to include..."
                    value={artProfile.reference_notes}
                    onChange={(e) =>
                      handleProfileChange("reference_notes", e.target.value)
                    }
                    className="min-h-[100px] rounded-sm resize-none"
                    data-testid="profile-reference-notes"
                  />
                </div>

                {/* Generate Summary Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleGenerateProfileSummary}
                    disabled={profileSummaryLoading}
                    className="rounded-sm"
                    data-testid="generate-summary-btn"
                  >
                    {profileSummaryLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Visual Identity Summary
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Summary & Tips */}
            <div className="space-y-4">
              {/* Visual Identity Summary */}
              <Card className="border-l-4 border-l-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    Visual Identity Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {artProfile.ai_summary ? (
                    <p
                      className="text-sm text-muted-foreground leading-relaxed"
                      data-testid="ai-summary"
                    >
                      {artProfile.ai_summary}
                    </p>
                  ) : (
                    <div className="text-center py-4">
                      <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Fill in your profile details and click &ldquo;Generate
                        Visual Identity Summary&rdquo; to get an AI-crafted
                        description of your book&apos;s visual style.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Refinement Suggestions Bubble */}
              {showRefinements && refinementSuggestions.length > 0 && (
                <Card
                  className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-500/5 to-transparent relative"
                  data-testid="refinement-suggestions-card"
                >
                  {/* Speech bubble pointer */}
                  <div className="absolute -top-2 left-6 w-4 h-4 bg-card border-l border-t border-purple-500/30 transform rotate-45" />

                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-purple-500" />
                        Refinement Suggestions
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRegenerateRefinements}
                          disabled={refinementsLoading}
                          className="h-7 px-2 text-xs"
                          data-testid="regenerate-refinements-btn"
                        >
                          {refinementsLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              Refresh
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRefinements(false)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          data-testid="close-refinements-btn"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Based on your current profile, consider these style
                      refinements:
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4">
                    <div className="space-y-3">
                      {refinementSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                          data-testid={`refinement-suggestion-${index}`}
                        >
                          <div className="rounded-full bg-purple-500/20 text-purple-600 w-6 h-6 flex items-center justify-center shrink-0 text-xs font-bold">
                            {index + 1}
                          </div>
                          <p className="text-sm leading-relaxed">
                            {suggestion}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground text-center">
                        💡 Update your profile fields above and click{" "}
                        <strong>Refresh</strong> to get new suggestions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* How It Works */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <div className="rounded-full bg-accent/20 text-accent w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">
                      1
                    </div>
                    <p>Define your genre, mood, and visual preferences</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="rounded-full bg-accent/20 text-accent w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">
                      2
                    </div>
                    <p>Generate a visual identity summary with Thad</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="rounded-full bg-accent/20 text-accent w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">
                      3
                    </div>
                    <p>Your profile automatically informs all art generation</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Generate Art Tab */}
        <TabsContent value="generate">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generation Panel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Generate Art Prompts
                </CardTitle>
                {artProfile.ai_summary && (
                  <CardDescription className="flex items-center gap-2 text-green-600">
                    <Check className="h-3 w-3" />
                    Using Book Art Profile
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Prompt Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prompt Type</label>
                    <Select value={promptType} onValueChange={setPromptType}>
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="prompt-type-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {promptTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className="h-4 w-4" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Style Preset */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Style Preset</label>
                    <Select
                      value={selectedPreset}
                      onValueChange={setSelectedPreset}
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="style-preset-select"
                      >
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {stylePresets.length > 0 ? (
                          stylePresets.map((preset) => (
                            <SelectItem key={preset.id} value={preset.name}>
                              {preset.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="default" disabled>
                            No presets - create one in Settings
                          </SelectItem>
                        )}
                        <SelectItem value="Epic Fantasy">
                          Epic Fantasy
                        </SelectItem>
                        <SelectItem value="Dark & Moody">
                          Dark & Moody
                        </SelectItem>
                        <SelectItem value="Whimsical Children">
                          Whimsical Children
                        </SelectItem>
                        <SelectItem value="Sci-Fi Futuristic">
                          Sci-Fi Futuristic
                        </SelectItem>
                        <SelectItem value="Romance Soft">
                          Romance Soft
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Chapter (optional) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Chapter</label>
                    <Select
                      value={selectedChapter?.id || "none"}
                      onValueChange={handleChapterChange}
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="art-chapter-select"
                      >
                        <SelectValue placeholder="Select chapter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          No chapter selected
                        </SelectItem>
                        {chapters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.chapter_number}. {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Extracted Scene Section */}
                {selectedChapter && (
                  <Card className="border-dashed bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-accent" />
                          <span className="text-sm font-medium">
                            Extracted Scene
                          </span>
                          {sceneExtracting && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setUseExtractedScene(!useExtractedScene)
                            }
                            className="h-7 text-xs"
                            data-testid="toggle-extracted-scene"
                          >
                            {useExtractedScene ? (
                              <>
                                <Edit3 className="h-3 w-3 mr-1" />
                                Edit manually
                              </>
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Use extracted
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              extractSceneFromChapter(selectedChapter)
                            }
                            disabled={sceneExtracting}
                            className="h-7 text-xs"
                            data-testid="re-extract-scene"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {sceneExtracting ? (
                        <p className="text-sm text-muted-foreground italic">
                          Analyzing chapter for visually rich moments...
                        </p>
                      ) : extractedScene ? (
                        <p
                          className="text-sm text-muted-foreground leading-relaxed"
                          data-testid="extracted-scene-text"
                        >
                          {extractedScene}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No scene extracted yet. Click refresh to analyze the
                          chapter.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Manual Context Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      {selectedChapter && useExtractedScene
                        ? "Additional Context (optional)"
                        : "Scene Context"}
                    </label>
                  </div>
                  <Textarea
                    placeholder={
                      selectedChapter && useExtractedScene
                        ? "Add any additional details or override the extracted scene..."
                        : "Describe the scene, mood, or specific elements you want in the artwork..."
                    }
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="min-h-[80px] rounded-sm resize-none"
                    data-testid="art-context-input"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleGeneratePrompts}
                    disabled={aiLoading || !selectedPreset}
                    className="flex-1 rounded-sm"
                    data-testid="generate-art-btn"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate{" "}
                        {
                          promptTypeOptions.find((o) => o.value === promptType)
                            ?.label
                        }{" "}
                        Prompt
                      </>
                    )}
                  </Button>
                  {(artPromptResult || aiResponse) && (
                    <Button
                      variant="outline"
                      onClick={handleSaveAsset}
                      className="rounded-sm"
                      data-testid="save-art-asset-btn"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                </div>

                {/* Structured Art Prompt Result */}
                {artPromptResult && (
                  <div className="space-y-4 mt-4">
                    {/* Main Art Prompt */}
                    <Card className="border-l-4 border-l-accent">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-accent" />
                          Art Prompt
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="max-h-[200px]">
                          <p
                            className="text-sm leading-relaxed whitespace-pre-wrap"
                            data-testid="main-art-prompt"
                          >
                            {artPromptResult.main_prompt}
                          </p>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Focus Elements */}
                    {artPromptResult.focus_elements && (
                      <Card>
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium">
                            Focus Elements
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {artPromptResult.focus_elements.characters?.length >
                            0 && (
                            <div className="flex items-start gap-2">
                              <Users className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">
                                  Characters
                                </p>
                                <p
                                  className="text-sm"
                                  data-testid="focus-characters"
                                >
                                  {artPromptResult.focus_elements.characters.join(
                                    ", ",
                                  )}
                                </p>
                              </div>
                            </div>
                          )}
                          {artPromptResult.focus_elements.setting && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">
                                  Setting
                                </p>
                                <p
                                  className="text-sm"
                                  data-testid="focus-setting"
                                >
                                  {artPromptResult.focus_elements.setting}
                                </p>
                              </div>
                            </div>
                          )}
                          {artPromptResult.focus_elements.action && (
                            <div className="flex items-start gap-2">
                              <Zap className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">
                                  Action
                                </p>
                                <p
                                  className="text-sm"
                                  data-testid="focus-action"
                                >
                                  {artPromptResult.focus_elements.action}
                                </p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Refinement Suggestions */}
                    {artPromptResult.refinement_suggestions?.length > 0 && (
                      <Card className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-purple-500" />
                            Refinement Suggestions
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {artPromptResult.refinement_suggestions.map(
                              (suggestion, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-2 text-sm"
                                  data-testid={`art-refinement-${index}`}
                                >
                                  <ArrowRight className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                                  <span className="text-muted-foreground">
                                    {suggestion}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Generate Image Section */}
                    <Card className="border-2 border-dashed border-accent/50 bg-accent/5">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <ImagePlus className="h-4 w-4 text-accent" />
                          Generate Actual Image
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              Image Size
                            </label>
                            <Select
                              value={imageSize}
                              onValueChange={setImageSize}
                            >
                              <SelectTrigger
                                className="rounded-sm h-9"
                                data-testid="image-size-select"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1024x1024">
                                  Square (1024×1024)
                                </SelectItem>
                                <SelectItem value="1536x1024">
                                  Landscape (1536×1024)
                                </SelectItem>
                                <SelectItem value="1024x1536">
                                  Portrait (1024×1536)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={handleGenerateImage}
                            disabled={
                              imageGenerating || !artPromptResult?.main_prompt
                            }
                            className="rounded-sm bg-gradient-to-r from-accent to-purple-500 hover:from-accent/90 hover:to-purple-500/90"
                            data-testid="generate-image-btn"
                          >
                            {imageGenerating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <ImagePlus className="h-4 w-4 mr-2" />
                                Generate Image
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Generated Image Display */}
                        {generatedImage && (
                          <div className="relative">
                            <img
                              src={`data:image/png;base64,${generatedImage}`}
                              alt="Generated artwork"
                              className="w-full rounded-lg border border-border shadow-lg"
                              data-testid="generated-image"
                            />
                            <div className="absolute bottom-3 right-3 flex gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = `data:image/png;base64,${generatedImage}`;
                                  link.download = `${selectedProject?.title || "artwork"}_${promptType}_${Date.now()}.png`;
                                  link.click();
                                }}
                                className="rounded-sm shadow-md"
                                data-testid="download-image-btn"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        )}

                        {imageGenerating && (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-12 w-12 animate-spin text-accent mb-4" />
                            <p className="text-sm">Creating your artwork...</p>
                            <p className="text-xs mt-1">
                              This may take up to a minute
                            </p>
                          </div>
                        )}

                        {!generatedImage && !imageGenerating && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Click &ldquo;Generate Image&rdquo; to create actual
                            artwork from the prompt above
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Legacy AI Response (fallback) */}
                {!artPromptResult && aiResponse && (
                  <div className="mt-4 p-4 bg-muted rounded-sm">
                    <ScrollArea className="max-h-[300px]">
                      <div
                        className="ai-response text-sm whitespace-pre-wrap"
                        data-testid="art-ai-response"
                      >
                        {aiResponse}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved Assets */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Saved Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {artAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-sm text-center">
                        No saved art assets yet. Generate prompts and save them
                        here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {artAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="p-3 bg-muted rounded-sm"
                          data-testid={`art-asset-${asset.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <Badge
                              variant="outline"
                              className="capitalize text-xs"
                            >
                              {asset.type.replace("_", " ")}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteAsset(asset.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Style: {asset.style_preset}
                          </p>
                          <p className="text-xs line-clamp-3">
                            {asset.prompt_used.substring(0, 150)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
