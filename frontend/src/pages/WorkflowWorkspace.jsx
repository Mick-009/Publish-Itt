import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectApi, aiApi } from "@/lib/api";
import {
  cn,
  statusColors,
  workflowStages,
  calculateProgress,
} from "@/lib/utils";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  Circle,
  ArrowRight,
  Sparkles,
  GitBranch,
} from "lucide-react";

const stageDescriptions = {
  concept: "Initial idea and brainstorming",
  outline: "Chapter structure and plot planning",
  draft: "First draft writing",
  revisions: "Major structural changes",
  editing: "Line editing and polishing",
  layout: "Formatting and design",
  art: "Cover and illustrations",
  proofing: "Final proofreading",
  final: "Ready for publication",
  published: "Book is live!",
};

export default function WorkflowWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusDescription, setStatusDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setSelectedProject(project);
      }
    }
  }, [projectId, projects]);

  const loadProjects = async () => {
    try {
      const res = await projectApi.getAll();
      setProjects(res.data);
      if (!projectId && res.data.length > 0) {
        setSelectedProject(res.data[0]);
      }
    } catch (error) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (projId) => {
    const project = projects.find((p) => p.id === projId);
    setSelectedProject(project);
    navigate(`/workflow/${projId}`);
    setAiResponse("");
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedProject) return;
    setUpdating(true);
    try {
      await projectApi.update(selectedProject.id, { status: newStatus });
      setSelectedProject({ ...selectedProject, status: newStatus });
      setProjects(
        projects.map((p) =>
          p.id === selectedProject.id ? { ...p, status: newStatus } : p,
        ),
      );
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleAnalyzeWorkflow = async () => {
    if (!statusDescription.trim()) {
      toast.error("Please describe your current progress");
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiApi.analyzeWorkflow(statusDescription);
      setAiResponse(res.data.response);
    } catch (error) {
      toast.error("Failed to analyze workflow");
    } finally {
      setAiLoading(false);
    }
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
      <div className="flex flex-col items-center justify-center h-full p-8">
        <GitBranch className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="font-serif text-2xl mb-2">No Projects Yet</h2>
        <p className="text-muted-foreground mb-4">
          Create a project to track its workflow
        </p>
        <Button onClick={() => navigate("/")} className="rounded-sm">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const currentStageIndex = workflowStages.indexOf(
    selectedProject?.status || "concept",
  );

  return (
    <div
      className="p-8 lg:p-12 max-w-6xl mx-auto animate-fade-in"
      data-testid="workflow-workspace"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
            Writing Stage
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track your manuscript's journey to publication
          </p>
        </div>
        <Select value={selectedProject?.id} onValueChange={handleProjectChange}>
          <SelectTrigger
            className="w-64 rounded-sm"
            data-testid="workflow-project-select"
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

      {selectedProject && (
        <>
          {/* Pipeline Visualization */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="font-serif flex items-center justify-between">
                <span>{selectedProject.title}</span>
                <Badge
                  className={cn(
                    "capitalize",
                    statusColors[selectedProject.status],
                  )}
                >
                  {selectedProject.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-4">
                <div className="flex items-center gap-2 min-w-max">
                  {workflowStages.map((stage, index) => {
                    const isComplete = index < currentStageIndex;
                    const isCurrent = index === currentStageIndex;
                    const isFuture = index > currentStageIndex;

                    return (
                      <div key={stage} className="flex items-center">
                        <button
                          onClick={() => handleStatusChange(stage)}
                          disabled={updating}
                          className={cn(
                            "flex flex-col items-center p-3 rounded-sm transition-colors min-w-[100px]",
                            isComplete && "bg-green-50 text-green-700",
                            isCurrent &&
                              "bg-accent/10 text-accent ring-2 ring-accent",
                            isFuture &&
                              "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                          data-testid={`stage-${stage}`}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                              isComplete && "bg-green-500 text-white",
                              isCurrent && "bg-accent text-white",
                              isFuture && "bg-muted-foreground/20",
                            )}
                          >
                            {isComplete ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </div>
                          <span className="text-xs font-medium capitalize">
                            {stage}
                          </span>
                        </button>
                        {index < workflowStages.length - 1 && (
                          <ArrowRight
                            className={cn(
                              "h-4 w-4 mx-1",
                              isComplete
                                ? "text-green-500"
                                : "text-muted-foreground/30",
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 p-4 bg-muted rounded-sm">
                <p className="text-sm">
                  <span className="font-medium">Current Stage: </span>
                  {stageDescriptions[selectedProject.status]}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Progress: {calculateProgress(selectedProject.status)}%
                  complete
                </p>
              </div>
            </CardContent>
          </Card>

          {/* What's My Stage? */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  What's My Stage?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Describe where you are in your writing process, and Thad will
                  analyze your progress and suggest next steps.
                </p>
                <Textarea
                  placeholder="e.g., I've finished the first draft and made some initial revisions based on feedback. The plot is solid but some chapters need tightening..."
                  value={statusDescription}
                  onChange={(e) => setStatusDescription(e.target.value)}
                  className="min-h-[120px] rounded-sm resize-none"
                  data-testid="workflow-description-input"
                />
                <Button
                  onClick={handleAnalyzeWorkflow}
                  disabled={aiLoading || !statusDescription.trim()}
                  className="w-full rounded-sm"
                  data-testid="analyze-workflow-btn"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze My Progress
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-serif">AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  {aiResponse ? (
                    <div
                      className="ai-response text-sm whitespace-pre-wrap"
                      data-testid="workflow-ai-response"
                    >
                      {aiResponse}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <GitBranch className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-sm text-center">
                        Describe your progress and Thad will help identify your
                        current stage and next steps
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
