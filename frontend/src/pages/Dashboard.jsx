import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { projectApi, uploadApi } from "@/lib/api";
import { GENRES, AGE_GROUPS, WRITING_STYLES, getGenresByCategory } from "@/lib/constants";
import { cn, statusColors, formatDate, formatWordCount, calculateProgress } from "@/lib/utils";
import { toast } from "sonner";
import ImportAnalysisDialog from "@/components/ImportAnalysisDialog";
import MomentumStrip from "@/components/MomentumStrip";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, FileText, GitBranch, Palette, ImageIcon, BookOpen, Loader2,
  Upload, FileUp, X, Sparkles, Pencil, MoreHorizontal, Trash2,
  Clock, BookMarked, ArrowRight, TrendingUp, Feather,
} from "lucide-react";
import { consumePendingStyleNote } from "@/lib/onboardingStash";

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_META = {
  concept:    { label: "Concept",    color: "bg-slate-100 text-slate-600 border-slate-200" },
  outline:    { label: "Outline",    color: "bg-blue-50 text-blue-600 border-blue-200" },
  draft:      { label: "Draft",      color: "bg-amber-50 text-amber-700 border-amber-200" },
  revisions:  { label: "Revisions",  color: "bg-orange-50 text-orange-700 border-orange-200" },
  editing:    { label: "Editing",    color: "bg-violet-50 text-violet-700 border-violet-200" },
  complete:   { label: "Complete",   color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  published:  { label: "Published",  color: "bg-green-50 text-green-700 border-green-200" },
};

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.concept;
}

// ── Skeleton card ─────────────────────────────────────────────────────────
function ProjectSkeleton() {
  return (
    <div className="rounded-sm border border-border bg-card p-5 space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="skeleton h-5 w-2/3 rounded" />
          <div className="skeleton h-3.5 w-1/3 rounded" />
        </div>
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-1.5 w-full rounded" />
      <div className="flex gap-2 pt-1">
        <div className="skeleton h-7 w-24 rounded" />
        <div className="skeleton h-7 w-20 rounded" />
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ onNew, onImport, uploading, isDragging, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      className={cn(
        "transition-all duration-200 rounded-sm border-2 border-dashed border-border",
        isDragging && "border-accent bg-accent/5 scale-[1.01]",
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        {isDragging ? (
          <>
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mb-5 animate-bounce">
              <FileUp className="h-8 w-8 text-accent" />
            </div>
            <h3 className="font-serif text-2xl mb-2 text-accent">Drop it here</h3>
            <p className="text-muted-foreground text-sm">.txt, .docx, .pdf, or .md</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <Feather className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-2xl font-medium mb-2">Where would you like to begin?</h3>
            <p className="text-muted-foreground text-sm mb-8 max-w-xs">
              Start something new, or bring in a manuscript you've been carrying around.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button onClick={onNew} className="rounded-sm px-6" size="lg">
                <Plus className="h-4 w-4 mr-2" />
                New project
              </Button>
              <Button variant="outline" onClick={onImport} disabled={uploading} className="rounded-sm px-6" size="lg">
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import a manuscript
              </Button>
            </div>
            <p className="mt-8 text-xs text-muted-foreground">
              Or drop a file right here — .txt, .docx, .pdf, or .md.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────
function ProjectCard({ project, index, onOpen, onEdit }) {
  const statusMeta = getStatusMeta(project.status);
  const progress = calculateProgress(project.status);

  return (
    <Card
      className="card-hover cursor-pointer animate-slide-in overflow-hidden group relative"
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={() => onOpen(project.id)}
      data-testid={`project-card-${project.id}`}
    >
      {/* Accent bar on hover */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-t" />

      <CardHeader className="pb-2 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-semibold leading-snug truncate group-hover:text-accent transition-colors duration-150">
              {project.title}
            </h3>
            {project.series_name && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{project.series_name}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge
              variant="outline"
              className={`text-xs font-medium capitalize border ${statusMeta.color}`}
            >
              {statusMeta.label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(e, project); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-5 space-y-4">
        {/* Summary */}
        {project.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {project.summary}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {project.genre && (
            <span className="capitalize">{project.genre.replace(/-/g, " ")}</span>
          )}
          {project.genre && project.word_count > 0 && (
            <span className="w-px h-3 bg-border" />
          )}
          {project.word_count > 0 && (
            <span className="font-mono">{formatWordCount(project.word_count)} words</span>
          )}
          {project.universe && (
            <>
              <span className="w-px h-3 bg-border" />
              <span className="truncate max-w-[120px]">{project.universe}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Quick actions */}
        <div
          className="flex items-center gap-1 pt-2 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { icon: FileText,  label: "Write",  path: `/manuscript/${project.id}` },
            { icon: GitBranch, label: "Stage",  path: `/workflow/${project.id}` },
            { icon: Palette,   label: "Style",  path: `/tone/${project.id}` },
            { icon: ImageIcon, label: "Art",    path: `/art/${project.id}` },
          ].map(({ icon: Icon, label, path }) => (
            <QuickAction key={label} icon={Icon} label={label} path={path} />
          ))}
          <div className="ml-auto">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(project.updated_at)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon: Icon, label, path }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => { e.stopPropagation(); navigate(path); }}
      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm gap-1"
    >
      <Icon className="h-3 w-3" />
      {label}
    </Button>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "", series_name: "", universe: "", type: "novel",
    genre: "", age_group: "", writing_style: "", voice_style: "",
    tone_style: "", target_audience: "", pacing_preference: "",
    style_notes: "", summary: "",
  });
  const [creating, setCreating] = useState(false);

  // Upload
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [importProjectTitle, setImportProjectTitle] = useState("");
  const [importChapterTitle, setImportChapterTitle] = useState("");

  // Edit project
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState(null);
  const [editFields, setEditFields] = useState({
    title: "", summary: "", voice_style: "", tone_style: "",
    target_audience: "", pacing_preference: "", style_notes: "",
  });

  // Import analysis
  const [importAnalysisOpen, setImportAnalysisOpen] = useState(false);
  const [importedContent, setImportedContent] = useState("");
  const [importedFilename, setImportedFilename] = useState("");
  const [newProjectId, setNewProjectId] = useState(null);

  useEffect(() => {
    loadProjects();

    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "new_project") { setDialogOpen(true); window.history.replaceState({}, "", window.location.pathname); }
    else if (action === "import") { fileInputRef.current?.click(); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  const loadProjects = async () => {
    try {
      const res = await projectApi.getAll();
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  };

  // Upload handlers
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) await handleFileSelect(f);
  };
  const handleFileInputChange = async (e) => {
    const f = e.target.files?.[0];
    if (f) await handleFileSelect(f);
  };
  const handleFileSelect = async (file) => {
    const allowed = [".txt", ".docx", ".pdf", ".md"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) { toast.error("That file type doesn't work here. Try .txt, .docx, .pdf, or .md."); return; }
    setUploadedFile(file);
    const base = file.name.replace(/\.[^/.]+$/, "");
    setImportProjectTitle(base); setImportChapterTitle(base); setUploading(true);
    try {
      const res = await uploadApi.previewManuscript(file);
      setUploadPreview(res.data); setUploadDialogOpen(true);
    } catch (err) {
      toast.error("Couldn't read that file: " + (err.response?.data?.detail || err.message));
      setUploadedFile(null);
    } finally { setUploading(false); }
  };

  const handleUploadConfirm = async () => {
    if (!uploadedFile || !importProjectTitle.trim()) { toast.error("The project needs a title."); return; }
    setUploading(true);
    try {
      const projRes = await projectApi.create({ title: importProjectTitle, type: "novel", status: "draft", summary: `Imported from ${uploadedFile.name}` });
      const projId = projRes.data.id;
      setNewProjectId(projId);
      // Consume any stashed onboarding style note now that there's a real project to attach it to
      await consumePendingStyleNote(projId);
      const upRes = await uploadApi.uploadManuscript(uploadedFile, projId, importChapterTitle || importProjectTitle);
      await loadProjects();
      toast.success(`Imported "${importChapterTitle}" (${upRes.data.word_count?.toLocaleString()} words)`);
      setImportedContent(uploadPreview?.full_content || upRes.data.content);
      setImportedFilename(uploadedFile.name);
      handleUploadClose(); setImportAnalysisOpen(true);
    } catch (err) {
      toast.error("Couldn't bring that in: " + (err.response?.data?.detail || err.message));
    } finally { setUploading(false); }
  };

  const handleUploadClose = () => {
    setUploadDialogOpen(false); setUploadedFile(null); setUploadPreview(null);
    setImportProjectTitle(""); setImportChapterTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateProject = async (e) => {
    e?.preventDefault();
    if (!newProject.title.trim()) { toast.error("The book needs a title to start."); return; }
    setCreating(true);
    try {
      const res = await projectApi.create(newProject);
      // Consume any stashed onboarding style note now that there's a real project to attach it to
      await consumePendingStyleNote(res.data.id);
      setProjects([...projects, res.data]);
      setDialogOpen(false);
      resetNewProject();
      toast.success("Project started.");
      navigate(`/manuscript/${res.data.id}`);
    } catch { toast.error("Couldn't start that project. Try again?"); }
    finally { setCreating(false); }
  };

  const resetNewProject = () => setNewProject({
    title: "", series_name: "", universe: "", type: "novel",
    genre: "", age_group: "", writing_style: "", voice_style: "",
    tone_style: "", target_audience: "", pacing_preference: "",
    style_notes: "", summary: "",
  });

  const handleOpenEdit = (e, project) => {
    e.stopPropagation();
    setProjectToRename(project);
    setEditFields({
      title: project.title, summary: project.summary || "",
      voice_style: project.voice_style || "", tone_style: project.tone_style || "",
      target_audience: project.target_audience || "", pacing_preference: project.pacing_preference || "",
      style_notes: project.style_notes || "",
    });
    setRenameDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editFields.title.trim()) { toast.error("Title can't be blank."); return; }
    try {
      await projectApi.update(projectToRename.id, editFields);
      setProjects(projects.map((p) => p.id === projectToRename.id ? { ...p, ...editFields } : p));
      setRenameDialogOpen(false); setProjectToRename(null);
      toast.success("Updated.");
    } catch { toast.error("Couldn't save those changes. Try again?"); }
  };

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const displayName = user?.display_name || user?.email?.split("@")[0] || "Writer";

  return (
    <div
      className="p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in"
      data-testid="dashboard"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.docx,.pdf,.md"
        onChange={handleFileInputChange}
        className="hidden"
        data-testid="dashboard-file-input"
      />

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-10 gap-4">
        <div>
          <p className="text-sm font-medium text-accent mb-1 tracking-widest uppercase">
            {greeting}, {displayName}
          </p>
          <h1 className="text-4xl md:text-5xl font-serif font-semibold tracking-tight">
            Your projects
          </h1>
          {!loading && (
            <p className="mt-2 text-muted-foreground">
              {projects.length === 0
                ? "Start something below."
                : `${projects.length} ${projects.length === 1 ? "project" : "projects"} on the bench`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-sm hidden sm:flex"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="rounded-sm shadow-sm" size="default" data-testid="new-project-btn">
            <Plus className="h-4 w-4 mr-2" />
            New project
          </Button>
        </div>
      </div>

      {/* ── Momentum strip ── */}
      <MomentumStrip />

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => <ProjectSkeleton key={n} />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          onNew={() => setDialogOpen(true)}
          onImport={() => fileInputRef.current?.click()}
          uploading={uploading}
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={i}
              onOpen={(id) => navigate(`/manuscript/${id}`)}
              onEdit={handleOpenEdit}
            />
          ))}
          {/* "New project" tile */}
          <button
            onClick={() => setDialogOpen(true)}
            className="animate-slide-in rounded-sm border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground hover:text-accent group min-h-[180px]"
            style={{ animationDelay: `${projects.length * 0.06}s` }}
          >
            <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">New project</span>
          </button>
        </div>
      )}

      {/* ── New Project Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]" data-testid="new-project-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Start a new book
            </DialogTitle>
            <DialogDescription>Begin from scratch, or bring in something you've already started.</DialogDescription>
          </DialogHeader>

          {/* Import strip */}
          <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-accent/10">
                  <Upload className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Import a manuscript</h4>
                  <p className="text-xs text-muted-foreground">.txt, .docx, .pdf, or .md</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => { fileInputRef.current?.click(); setDialogOpen(false); }} disabled={uploading} className="rounded-sm" data-testid="import-manuscript-btn">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileUp className="h-4 w-4 mr-2" />Browse</>}
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or start fresh</span>
            </div>
          </div>

          <ScrollArea className="max-h-[50vh] pr-4">
            <form onSubmit={handleCreateProject}>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" placeholder="What's it called?" value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} className="rounded-sm" data-testid="new-project-title" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="series">Series name</Label>
                    <Input id="series" placeholder="e.g., The Dragon Chronicles" value={newProject.series_name} onChange={(e) => setNewProject({ ...newProject, series_name: e.target.value })} className="rounded-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="universe">Universe</Label>
                    <Input id="universe" placeholder="e.g., Evergreen Forest" value={newProject.universe} onChange={(e) => setNewProject({ ...newProject, universe: e.target.value })} className="rounded-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newProject.type} onValueChange={(v) => setNewProject({ ...newProject, type: v })}>
                      <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["novel","novella","short-story","anthology","childrens","picture-book","non-fiction","memoir","poetry","screenplay"].map((t) => (
                          <SelectItem key={t} value={t}>{t.replace(/-/g," ").replace(/\b\w/g,(c)=>c.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Age group</Label>
                    <Select value={newProject.age_group} onValueChange={(v) => setNewProject({ ...newProject, age_group: v })}>
                      <SelectTrigger className="rounded-sm"><SelectValue placeholder="Pick one" /></SelectTrigger>
                      <SelectContent>
                        {AGE_GROUPS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={newProject.genre} onValueChange={(v) => setNewProject({ ...newProject, genre: v })}>
                    <SelectTrigger className="rounded-sm"><SelectValue placeholder="Pick a genre" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Object.entries(getGenresByCategory()).map(([cat, genres]) => (
                        <SelectGroup key={cat}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">{cat}</SelectLabel>
                          {genres.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Writing style</Label>
                  <Select value={newProject.writing_style} onValueChange={(v) => setNewProject({ ...newProject, writing_style: v })}>
                    <SelectTrigger className="rounded-sm"><SelectValue placeholder="Pick a style" /></SelectTrigger>
                    <SelectContent>
                      {WRITING_STYLES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <div className="flex flex-col"><span>{s.label}</span><span className="text-xs text-muted-foreground">{s.description}</span></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea id="summary" placeholder="A few sentences on what it's about." value={newProject.summary} onChange={(e) => setNewProject({ ...newProject, summary: e.target.value })} className="rounded-sm resize-none" rows={3} />
                </div>
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div>
                    <h4 className="text-sm font-medium">Voice & tone</h4>
                    <p className="text-xs text-muted-foreground mt-1">Optional. I'll keep these in mind when reading.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Voice style</Label><Input placeholder="e.g., lyrical" value={newProject.voice_style} onChange={(e) => setNewProject({ ...newProject, voice_style: e.target.value })} className="rounded-sm" /></div>
                    <div className="space-y-2"><Label>Tone</Label><Input placeholder="e.g., warm, adventurous" value={newProject.tone_style} onChange={(e) => setNewProject({ ...newProject, tone_style: e.target.value })} className="rounded-sm" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Audience</Label><Input placeholder="e.g., middle grade readers" value={newProject.target_audience} onChange={(e) => setNewProject({ ...newProject, target_audience: e.target.value })} className="rounded-sm" /></div>
                    <div className="space-y-2"><Label>Pacing</Label><Input placeholder="e.g., fast, reflective" value={newProject.pacing_preference} onChange={(e) => setNewProject({ ...newProject, pacing_preference: e.target.value })} className="rounded-sm" /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes on style</Label>
                    <Textarea placeholder="Anything specific to your voice." value={newProject.style_notes} onChange={(e) => setNewProject({ ...newProject, style_notes: e.target.value })} className="rounded-sm resize-none" rows={3} />
                  </div>
                </div>
              </div>
            </form>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetNewProject(); }} className="rounded-sm">Cancel</Button>
            <Button onClick={handleCreateProject} disabled={creating || !newProject.title} className="rounded-sm" data-testid="create-project-submit">
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting.</> : <><Plus className="h-4 w-4 mr-2" />Start it</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Preview Dialog ── */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleUploadClose}>
        <DialogContent className="sm:max-w-2xl" data-testid="import-project-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2 text-2xl">
              <FileUp className="h-6 w-6" />Bring in a manuscript
            </DialogTitle>
            <DialogDescription>Take a look. Make a project around it.</DialogDescription>
          </DialogHeader>
          {uploadPreview && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-sm">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{uploadPreview.filename}</p>
                    <p className="text-xs text-muted-foreground">{uploadPreview.file_type?.toUpperCase()} · {uploadPreview.word_count?.toLocaleString()} words</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleUploadClose} className="h-8 w-8"><X className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="importProjectTitle">Project title *</Label>
                <Input id="importProjectTitle" value={importProjectTitle} onChange={(e) => setImportProjectTitle(e.target.value)} placeholder="What's it called?" className="rounded-sm" data-testid="import-project-title-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="importChapterTitle">Chapter title</Label>
                <Input id="importChapterTitle" value={importChapterTitle} onChange={(e) => setImportChapterTitle(e.target.value)} placeholder="Chapter title" className="rounded-sm" data-testid="import-chapter-title-input" />
              </div>
              <div className="space-y-2">
                <Label>Preview</Label>
                <ScrollArea className="h-[150px] border border-border rounded-sm p-3">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{uploadPreview.preview}</p>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleUploadClose} className="rounded-sm">Cancel</Button>
            <Button onClick={handleUploadConfirm} disabled={uploading || !importProjectTitle.trim()} className="rounded-sm" data-testid="confirm-import-project-btn">
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Bringing it in.</> : <><Upload className="h-4 w-4 mr-2" />Bring it in</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Project Dialog ── */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="rename-project-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Pencil className="h-4 w-4 text-accent" />Edit project
            </DialogTitle>
            <DialogDescription>Update the details and the voice profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={editFields.title} onChange={(e) => setEditFields({ ...editFields, title: e.target.value })} className="rounded-sm" autoFocus onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); } }} />
            </div>
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea value={editFields.summary} onChange={(e) => setEditFields({ ...editFields, summary: e.target.value })} placeholder="A few sentences on what it's about." className="rounded-sm resize-none" rows={3} />
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <h4 className="text-sm font-medium">Voice & tone</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Voice style</Label><Input value={editFields.voice_style} onChange={(e) => setEditFields({ ...editFields, voice_style: e.target.value })} placeholder="e.g., lyrical" className="rounded-sm h-8 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Tone</Label><Input value={editFields.tone_style} onChange={(e) => setEditFields({ ...editFields, tone_style: e.target.value })} placeholder="e.g., warm" className="rounded-sm h-8 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Audience</Label><Input value={editFields.target_audience} onChange={(e) => setEditFields({ ...editFields, target_audience: e.target.value })} placeholder="e.g., MG readers" className="rounded-sm h-8 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Pacing</Label><Input value={editFields.pacing_preference} onChange={(e) => setEditFields({ ...editFields, pacing_preference: e.target.value })} placeholder="e.g., balanced" className="rounded-sm h-8 text-sm" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Notes on style</Label><Textarea value={editFields.style_notes} onChange={(e) => setEditFields({ ...editFields, style_notes: e.target.value })} placeholder="Anything specific to your voice." className="rounded-sm resize-none text-sm" rows={3} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameDialogOpen(false); setProjectToRename(null); }} className="rounded-sm">Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editFields.title.trim()} className="rounded-sm" data-testid="confirm-rename-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Analysis Dialog ── */}
      <ImportAnalysisDialog
        open={importAnalysisOpen}
        onOpenChange={setImportAnalysisOpen}
        content={importedContent}
        filename={importedFilename}
        projectId={newProjectId}
        onActionComplete={() => { if (newProjectId) navigate(`/manuscript/${newProjectId}`); }}
      />
    </div>
  );
}
