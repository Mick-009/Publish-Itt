import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectApi, chapterApi, aiApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Sparkles, Palette, FileText, Plus, Upload } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { AnalyzeLoopArt } from "@/components/EmptyStateArt";

export default function ToneStyleWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [customText, setCustomText] = useState("");

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
    navigate(`/tone/${projId}`);
    loadChapters(projId);
    setAiResponse("");
  };

  const handleChapterChange = (chapterId) => {
    const chapter = chapters.find((c) => c.id === chapterId);
    setSelectedChapter(chapter);
    setAiResponse("");
  };

  const handleAnalyzeTone = async () => {
    const strippedChapterText = stripHtml(selectedChapter?.content || "");
    const textToAnalyze = customText.trim() || strippedChapterText;

    if (!textToAnalyze) {
      toast.error(
        "No content to analyze. Select a chapter or enter custom text.",
      );
      return;
    }

    setAiLoading(true);
    try {
      const res = await aiApi.analyzeTone(
        textToAnalyze,
        selectedProject?.id,
        selectedChapter?.id,
      );
      console.log("Tone analysis response:", res.data);
      const output =
        res.data?.response || res.data?.analysis || res.data?.result || "";

      if (!output) {
        toast.error("Tone analysis returned no content");
        return;
      }

      setAiResponse(output);
    } catch (error) {
      console.error("Tone analysis failed:", error);
      toast.error("Failed to analyze tone");
    } finally {
      setAiLoading(false);
    }
  };

  // Strip HTML tags for display
  const stripHtml = (html) => {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return doc.body.textContent || "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        size="page"
        art={<AnalyzeLoopArt size={96} />}
        eyebrow="Tone & style studio"
        title="Bring me something to read."
        body="Once you have a project with a draft, I'll analyze its voice — pacing, tone, sentence shape, the kind of feedback an editor gives at three in the morning."
        primaryAction={{
          label: "Start a new project",
          icon: Plus,
          onClick: () => navigate("/?action=new_project"),
          showArrow: true,
          testId: "empty-tonestyle-new-project",
        }}
        secondaryAction={{
          label: "Import a manuscript",
          icon: Upload,
          onClick: () => navigate("/?action=import"),
          testId: "empty-tonestyle-import",
        }}
        testId="empty-tonestyle-no-projects"
      />
    );
  }

  return (
    <div
      className="p-8 lg:p-12 max-w-6xl mx-auto animate-fade-in"
      data-testid="tone-workspace"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
            Voice & Style
          </h1>
          <p className="mt-2 text-muted-foreground">
            Analyze voice, reading level, and pacing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedProject?.id}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger
              className="w-48 rounded-sm"
              data-testid="tone-project-select"
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
          {chapters.length > 0 && (
            <Select
              value={selectedChapter?.id}
              onValueChange={handleChapterChange}
            >
              <SelectTrigger
                className="w-48 rounded-sm"
                data-testid="tone-chapter-select"
              >
                <SelectValue placeholder="Select chapter" />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.chapter_number}. {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Content to Analyze
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedChapter ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-sm">
                  <h3 className="font-medium mb-2">
                    Chapter {selectedChapter.chapter_number}:{" "}
                    {selectedChapter.title}
                  </h3>
                  <ScrollArea className="h-[200px]">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {stripHtml(selectedChapter.content) || "No content yet"}
                    </p>
                  </ScrollArea>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or enter custom text
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                No chapters in this project yet — paste any text below and I'll work with that.
              </p>
            )}

            <Textarea
              placeholder="Paste or type text here to analyze..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="min-h-[150px] rounded-sm resize-none"
              data-testid="tone-custom-text"
            />

            <Button
              onClick={handleAnalyzeTone}
              disabled={
                aiLoading || (!customText.trim() && !selectedChapter?.content)
              }
              className="w-full rounded-sm"
              data-testid="analyze-tone-btn"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Tone
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Palette className="h-5 w-5 text-accent" />
              Tone Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {aiResponse ? (
                <div
                  className="ai-response text-sm whitespace-pre-wrap"
                  data-testid="tone-ai-response"
                >
                  {aiResponse}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Palette className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm text-center">
                    Select a chapter or enter text, then click "Analyze Tone" to
                    get insights on voice, reading level, and pacing.
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
