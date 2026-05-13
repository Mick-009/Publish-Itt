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
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { WorkflowEmptyArt } from "@/components/EmptyStateArt";
import {
  Loader2,
  Check,
  Circle,
  ArrowRight,
  Sparkles,
  GitBranch,
  Plus,
  Upload,
} from "lucide-react";

const stageDescriptions = {
  concept: "An idea, taking shape.",
  outline: "Chapters mapped, plot sketched.",
  draft: "Words on the page, end to end.",
  revisions: "The big moves — structure, arc.",
  editing: "Line by line, sentence by sentence.",
  layout: "Format, design, the way it sits.",
  art: "Cover, illustrations, what readers see first.",
  proofing: "The last read, hunting for what slipped past.",
  final: "Ready to send.",
  published: "Out in the world.",
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
      toast.error("Couldn't pull up your projects. Try again?");
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
      toast.success(`Moved to ${newStatus}.`);
    } catch (error) {
      toast.error("Couldn't change the stage. Try again?");
    } finally {
      setUpdating(false);
    }
  };

  const handleAnalyzeWorkflow = async () => {
    if (!statusDescription.trim()) {
      toast.error("Tell me where you are first.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiApi.analyzeWorkflow(statusDescription);
      setAiResponse(res.data.response);
    } catch (error) {
      toast.error("Couldn't read that. Try again?");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        size="page"
        eyebrow="The pipeline"
        title="Walking the line."
        body="One moment — checking where each manuscript stands."
        testId="loading-workflow-workspace"
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        size="page"
        art={<WorkflowEmptyArt size={96} />}
        eyebrow="The pipeline is clear"
        title="No manuscript on the rails yet."
        body="Once a project exists, this is where we'll watch it move — concept to outline to draft to bound book. Pick something to start."
        primaryAction={{
          label: "Start a new project",
          icon: Plus,
          onClick: () => navigate("/?action=new_project"),
          showArrow: true,
          testId: "empty-workflow-new-project",
        }}
        secondaryAction={{
          label: "Import a manuscript",
          icon: Upload,
          onClick: () => navigate("/?action=import"),
          testId: "empty-workflow-import",
        }}
        testId="empty-workflow-no-projects"
      />
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
            Where you are
          </h1>
          <p className="mt-2 text-muted-foreground">
            The arc from idea to published — and where this one sits.
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
                  <span className="font-medium">Right now: </span>
                  {stageDescriptions[selectedProject.status]}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {calculateProgress(selectedProject.status)}% of the way through.
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
                  Tell me where you are
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Describe what you've got and what you're stuck on. I'll tell you what stage that sounds like — and what comes next.
                </p>
                <Textarea
                  placeholder="e.g. Finished the first draft, did one revision pass on feedback. The plot holds, but the middle three chapters drag."
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
                      Reading.
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Read where I am
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-serif">What I think</CardTitle>
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
                        Tell me where you are. I'll point at the stage and the next step.
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
