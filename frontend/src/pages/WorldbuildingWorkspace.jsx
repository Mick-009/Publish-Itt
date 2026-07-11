import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { projectApi } from "@/lib/api";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { WorldbuildingArt } from "@/components/EmptyStateArt";
import WorldbuildingCanvas from "@/components/worldbuilding/WorldbuildingCanvas";
import { Plus } from "lucide-react";

export default function WorldbuildingWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const project = projects.find((p) => p.id === projectId);
      if (project) setSelectedProject(project);
    }
  }, [projectId, projects]);

  const loadProjects = async () => {
    try {
      const res = await projectApi.getAll();
      setProjects(res.data);
      if (!projectId && res.data.length > 0) {
        setSelectedProject(res.data[0]);
      }
    } catch {
      toast.error("Couldn't pull up your projects. Try again?");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        size="page"
        eyebrow="THE CANVAS"
        title="Pulling your world off the shelves."
        testId="loading-worldbuilding-workspace"
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        size="page"
        art={<WorldbuildingArt size={96} />}
        eyebrow="THE WORLD WAITS"
        title="Every world starts with a book."
        body="Create a project first, then come back here to build the world around it."
        primaryAction={{
          label: "Start a new project",
          icon: Plus,
          onClick: () => navigate("/?action=new_project"),
          showArrow: true,
          testId: "empty-worldbuilding-new-project",
        }}
        testId="empty-worldbuilding-no-projects"
      />
    );
  }

  const activeProjectId = selectedProject?.id ?? projects[0]?.id;

  return (
    <div className="h-full overflow-hidden" data-testid="worldbuilding-page">
      <WorldbuildingCanvas projectId={activeProjectId} project={selectedProject ?? projects[0]} />
    </div>
  );
}
