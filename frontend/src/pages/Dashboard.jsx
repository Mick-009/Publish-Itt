import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { projectApi, uploadApi } from "@/lib/api";
import {
  GENRES,
  AGE_GROUPS,
  WRITING_STYLES,
  getGenresByCategory,
} from "@/lib/constants";
import {
  cn,
  statusColors,
  formatDate,
  formatWordCount,
  calculateProgress,
} from "@/lib/utils";
import { toast } from "sonner";
import ImportAnalysisDialog from "@/components/ImportAnalysisDialog";
import ThadOnboarding from "@/components/ThadOnboarding";
import {
  Plus,
  FileText,
  GitBranch,
  Palette,
  ImageIcon,
  BookOpen,
  Loader2,
  Upload,
  FileUp,
  X,
  Sparkles,
  Pencil,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    series_name: "",
    universe: "",
    type: "",
    genre: "",
    age_group: "",
    writing_style: "",
    summary: "",
  });
  const [creating, setCreating] = useState(false);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [importProjectTitle, setImportProjectTitle] = useState("");
  const [importChapterTitle, setImportChapterTitle] = useState("");

  // Rename state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState(null);
  const [newTitle, setNewTitle] = useState("");

  // Import Analysis state
  const [importAnalysisOpen, setImportAnalysisOpen] = useState(false);
  const [importedContent, setImportedContent] = useState("");
  const [importedFilename, setImportedFilename] = useState("");
  const [newProjectId, setNewProjectId] = useState(null);

  useEffect(() => {
    loadProjects();

    // Check if onboarding should be shown
    const onboardingComplete = localStorage.getItem("thad_onboarding_complete");
    if (!onboardingComplete) {
      setShowOnboarding(true);
    }

    // Handle URL action params (from onboarding)
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "new_project") {
      setDialogOpen(true);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (action === "import") {
      fileInputRef.current?.click();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const loadProjects = async () => {
    try {
      const res = await projectApi.getAll();
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to load projects", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Upload handlers
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
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    setImportProjectTitle(baseName);
    setImportChapterTitle(baseName);
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
    if (!uploadedFile || !importProjectTitle.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    setUploading(true);
    try {
      // First create a new project
      const projectRes = await projectApi.create({
        title: importProjectTitle,
        type: "novel",
        status: "draft",
        summary: `Imported from ${uploadedFile.name}`,
      });

      const projectId = projectRes.data.id;
      setNewProjectId(projectId);

      // Then upload the manuscript as a chapter
      const uploadRes = await uploadApi.uploadManuscript(
        uploadedFile,
        projectId,
        importChapterTitle || importProjectTitle,
      );

      // Reload projects
      await loadProjects();

      toast.success(
        `Created project and imported "${importChapterTitle}" (${uploadRes.data.word_count.toLocaleString()} words)`,
      );

      // Trigger Import Analysis
      setImportedContent(uploadPreview?.full_content || uploadRes.data.content);
      setImportedFilename(uploadedFile.name);
      handleUploadClose();
      setImportAnalysisOpen(true);
    } catch (error) {
      toast.error(
        "Failed to import: " + (error.response?.data?.detail || error.message),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClose = () => {
    setUploadDialogOpen(false);
    setUploadedFile(null);
    setUploadPreview(null);
    setImportProjectTitle("");
    setImportChapterTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportActionComplete = (actionId, result) => {
    // Navigate to the manuscript workspace after analysis
    if (newProjectId) {
      navigate(`/manuscript/${newProjectId}`);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setCreating(true);
    try {
      const res = await projectApi.create(newProject);
      setProjects([...projects, res.data]);
      setDialogOpen(false);
      setNewProject({
        title: "",
        series_name: "",
        universe: "",
        type: "novel",
        genre: "",
        age_group: "",
        writing_style: "",
        summary: "",
      });
      toast.success("Project created successfully!");
    } catch (error) {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRename = (e, project) => {
    e.stopPropagation();
    setProjectToRename(project);
    setNewTitle(project.title);
    setRenameDialogOpen(true);
  };

  const handleRenameProject = async () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!projectToRename) return;

    try {
      await projectApi.update(projectToRename.id, { title: newTitle.trim() });
      setProjects(
        projects.map((p) =>
          p.id === projectToRename.id ? { ...p, title: newTitle.trim() } : p,
        ),
      );
      setRenameDialogOpen(false);
      setProjectToRename(null);
      setNewTitle("");
      toast.success("Project renamed successfully!");
    } catch (error) {
      toast.error("Failed to rename project");
    }
  };

  const QuickAction = ({ icon: Icon, label, onClick }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground rounded-sm"
    >
      <Icon className="h-3.5 w-3.5 mr-1" />
      {label}
    </Button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div
      className="p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in"
      data-testid="dashboard"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-sm font-medium text-accent mb-1">PUBLISH ITT</p>
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
            Your Projects
          </h1>
          <p className="mt-2 text-muted-foreground">
            {projects.length === 0
              ? "Start your first project."
              : `${projects.length} ${projects.length === 1 ? "project" : "projects"} ready to continue`}
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="rounded-sm shadow-sm"
          size="lg"
          data-testid="new-project-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Start New Project
        </Button>
      </div>

      {/* Hidden file input - always rendered */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.docx,.pdf,.md"
        onChange={handleFileInputChange}
        className="hidden"
        data-testid="dashboard-file-input"
      />

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div
          className={cn("transition-colors", isDragging && "bg-accent/5")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Card
            className={cn(
              "border-dashed border-2",
              isDragging && "border-accent bg-accent/5",
            )}
          >
            <CardContent className="flex flex-col items-center justify-center py-16">
              {isDragging ? (
                <>
                  <FileUp className="h-16 w-16 text-accent mb-4 animate-bounce" />
                  <h3 className="font-serif text-xl mb-2 text-accent">
                    Drop your manuscript here
                  </h3>
                  <p className="text-muted-foreground">
                    Supported: .txt, .docx, .pdf, .md
                  </p>
                </>
              ) : (
                <>
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-serif text-xl mb-2">No projects yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start your first book to begin your writing journey
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                    <Button
                      onClick={() => setDialogOpen(true)}
                      className="rounded-sm"
                      data-testid="create-first-project-btn"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Project
                    </Button>
                    <span className="text-muted-foreground text-sm">or</span>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-sm"
                      data-testid="import-first-project-btn"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Import Existing Manuscript
                    </Button>
                  </div>

                  {/* Drag & Drop Zone */}
                  <div className="w-full max-w-md p-6 border-2 border-dashed border-border rounded-lg text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">
                      Drag & drop a manuscript file here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports .txt, .docx, .pdf, .md
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <Card
              key={project.id}
              className="card-hover cursor-pointer animate-slide-in overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => navigate(`/manuscript/${project.id}`)}
              data-testid={`project-card-${project.id}`}
            >
              {/* Project Card Content - All children contained within */}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 group">
                      <h3 className="font-serif text-xl font-medium truncate">
                        {project.title}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => handleOpenRename(e, project)}
                        data-testid={`rename-project-${project.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    {project.series_name && (
                      <p className="text-sm text-muted-foreground truncate">
                        {project.series_name}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`ml-2 shrink-0 capitalize text-xs ${statusColors[project.status] || statusColors.concept}`}
                  >
                    {project.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Project Info */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {project.universe || "No Story World Set Yet"}
                  </span>
                  <span className="font-mono text-xs">
                    {formatWordCount(project.word_count)} words
                  </span>
                </div>

                {/* Progress Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-mono">
                      {calculateProgress(project.status)}%
                    </span>
                  </div>
                  <Progress
                    value={calculateProgress(project.status)}
                    className="h-1.5"
                  />
                </div>

                {/* Quick Actions Panel - Child of Card, contained within bounds */}
                <div
                  className="flex flex-wrap items-center gap-1 pt-3 border-t border-border w-full"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`project-actions-${project.id}`}
                >
                  <QuickAction
                    icon={FileText}
                    label="Manuscript"
                    onClick={() => navigate(`/manuscript/${project.id}`)}
                  />
                  <QuickAction
                    icon={GitBranch}
                    label="Writing Stage"
                    onClick={() => navigate(`/workflow/${project.id}`)}
                  />
                  <QuickAction
                    icon={Palette}
                    label="Style"
                    onClick={() => navigate(`/tone/${project.id}`)}
                  />
                  <QuickAction
                    icon={ImageIcon}
                    label="Cover & Art"
                    onClick={() => navigate(`/art/${project.id}`)}
                  />
                </div>

                {/* Updated timestamp */}
                <p className="text-xs text-muted-foreground">
                  Updated {formatDate(project.updated_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh]"
          data-testid="new-project-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Start New Book
            </DialogTitle>
            <DialogDescription>
              Create a new project or import an existing manuscript
            </DialogDescription>
          </DialogHeader>

          {/* Import Manuscript Section */}
          <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-accent/10">
                  <Upload className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Import Manuscript</h4>
                  <p className="text-xs text-muted-foreground">
                    Upload .txt, .docx, .pdf, or .md file
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  fileInputRef.current?.click();
                  setDialogOpen(false);
                }}
                disabled={uploading}
                className="rounded-sm"
                data-testid="import-manuscript-btn"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <FileUp className="h-4 w-4 mr-2" />
                    Browse Files
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or create from scratch
              </span>
            </div>
          </div>

          <ScrollArea className="max-h-[50vh] pr-4">
            <form onSubmit={handleCreateProject}>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter book title"
                    value={newProject.title}
                    onChange={(e) =>
                      setNewProject({ ...newProject, title: e.target.value })
                    }
                    className="rounded-sm"
                    data-testid="new-project-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="series">Series Name</Label>
                    <Input
                      id="series"
                      placeholder="e.g., The Dragon Chronicles"
                      value={newProject.series_name}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          series_name: e.target.value,
                        })
                      }
                      className="rounded-sm"
                      data-testid="new-project-series"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="universe">Universe</Label>
                    <Input
                      id="universe"
                      placeholder="e.g., Evergreen Forest"
                      value={newProject.universe}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          universe: e.target.value,
                        })
                      }
                      className="rounded-sm"
                      data-testid="new-project-universe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={newProject.type}
                      onValueChange={(value) =>
                        setNewProject({ ...newProject, type: value })
                      }
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="new-project-type"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novel">Novel</SelectItem>
                        <SelectItem value="novella">Novella</SelectItem>
                        <SelectItem value="short-story">Short Story</SelectItem>
                        <SelectItem value="anthology">Anthology</SelectItem>
                        <SelectItem value="childrens">
                          Children's Book
                        </SelectItem>
                        <SelectItem value="picture-book">
                          Picture Book
                        </SelectItem>
                        <SelectItem value="non-fiction">Non-Fiction</SelectItem>
                        <SelectItem value="memoir">Memoir</SelectItem>
                        <SelectItem value="poetry">
                          Poetry Collection
                        </SelectItem>
                        <SelectItem value="screenplay">Screenplay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age_group">Target Age Group</Label>
                    <Select
                      value={newProject.age_group}
                      onValueChange={(value) =>
                        setNewProject({ ...newProject, age_group: value })
                      }
                    >
                      <SelectTrigger
                        className="rounded-sm"
                        data-testid="new-project-age-group"
                      >
                        <SelectValue placeholder="Select age group" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_GROUPS.map((age) => (
                          <SelectItem key={age.value} value={age.value}>
                            {age.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Select
                    value={newProject.genre}
                    onValueChange={(value) =>
                      setNewProject({ ...newProject, genre: value })
                    }
                  >
                    <SelectTrigger
                      className="rounded-sm"
                      data-testid="new-project-genre"
                    >
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Object.entries(getGenresByCategory()).map(
                        ([category, genres]) => (
                          <SelectGroup key={category}>
                            <SelectLabel className="text-xs font-semibold text-muted-foreground">
                              {category}
                            </SelectLabel>
                            {genres.map((genre) => (
                              <SelectItem key={genre.value} value={genre.value}>
                                {genre.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="writing_style">Writing Style</Label>
                  <Select
                    value={newProject.writing_style}
                    onValueChange={(value) =>
                      setNewProject({ ...newProject, writing_style: value })
                    }
                  >
                    <SelectTrigger
                      className="rounded-sm"
                      data-testid="new-project-style"
                    >
                      <SelectValue placeholder="Select writing style" />
                    </SelectTrigger>
                    <SelectContent>
                      {WRITING_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          <div className="flex flex-col">
                            <span>{style.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {style.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    placeholder="Brief description of your book..."
                    value={newProject.summary}
                    onChange={(e) =>
                      setNewProject({ ...newProject, summary: e.target.value })
                    }
                    className="rounded-sm resize-none"
                    rows={3}
                    data-testid="new-project-summary"
                  />
                </div>
              </div>
            </form>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={creating || !newProject.title}
              className="rounded-sm"
              data-testid="create-project-submit"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Manuscript Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleUploadClose}>
        <DialogContent
          className="sm:max-w-2xl"
          data-testid="import-project-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2 text-2xl">
              <FileUp className="h-6 w-6" />
              Import Manuscript
            </DialogTitle>
            <DialogDescription>
              Create a new project from your imported manuscript.
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

              {/* Project Title Input */}
              <div className="space-y-2">
                <Label htmlFor="importProjectTitle">Project Title *</Label>
                <Input
                  id="importProjectTitle"
                  value={importProjectTitle}
                  onChange={(e) => setImportProjectTitle(e.target.value)}
                  placeholder="Enter project title"
                  className="rounded-sm"
                  data-testid="import-project-title-input"
                />
              </div>

              {/* Chapter Title Input */}
              <div className="space-y-2">
                <Label htmlFor="importChapterTitle">Chapter Title</Label>
                <Input
                  id="importChapterTitle"
                  value={importChapterTitle}
                  onChange={(e) => setImportChapterTitle(e.target.value)}
                  placeholder="Enter chapter title"
                  className="rounded-sm"
                  data-testid="import-chapter-title-input"
                />
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Content Preview</Label>
                <ScrollArea className="h-[150px] border border-border rounded-sm p-3">
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
              disabled={uploading || !importProjectTitle.trim()}
              className="rounded-sm"
              data-testid="confirm-import-project-btn"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Create Project & Import
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
        projectId={newProjectId}
        onActionComplete={handleImportActionComplete}
      />

      {/* Rename Project Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-testid="rename-project-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Pencil className="h-4 w-4 text-accent" />
              Rename Project
            </DialogTitle>
            <DialogDescription>
              Enter a new title for your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newTitle">New Title</Label>
              <Input
                id="newTitle"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter new title"
                className="rounded-sm"
                data-testid="rename-project-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRenameProject();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameProject}
              disabled={!newTitle.trim()}
              className="rounded-sm"
              data-testid="confirm-rename-btn"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thad Onboarding */}
      <ThadOnboarding
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}
