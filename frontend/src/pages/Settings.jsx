import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { stylePresetApi, userApi, onboardingApi } from "@/lib/api";
import { AVATAR_COMPONENTS, AVATAR_OPTIONS } from "@/components/avatars";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  Palette,
  Loader2,
  Settings as SettingsIcon,
  Sun,
  TreePine,
  Lamp,
  Cloud,
  Flame,
  Check,
  Map,
  Sparkles,
  Target,
  X,
  User,
} from "lucide-react";
import ThadTour from "@/components/ThadTour";
import LoadingState from "@/components/LoadingState";

const THEME_ICONS = {
  default: Sun,
  evergreen: TreePine,
  lantern: Lamp,
  misty: Cloud,
  campfire: Flame,
};

const THEME_COLORS = {
  default: "bg-amber-500",
  evergreen: "bg-emerald-600",
  lantern: "bg-yellow-500",
  misty: "bg-slate-400",
  campfire: "bg-orange-500",
};

function FieldWithClear({ label, value, onChange, placeholder }) {
  const inputId = `profile-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-sm pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-sm"
            aria-label={`Clear ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, themes } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visual_style: "",
    mood: "",
    color_palette: "",
  });
  const [saving, setSaving] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Daily writing goal
  const [goalDraft, setGoalDraft] = useState(user?.daily_word_goal ?? 500);
  const [savingGoal, setSavingGoal] = useState(false);

  // Profile fields
  const [profileDraft, setProfileDraft] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    pen_name: (user?.pen_name || "").trim(),
    use_pen_name: user?.use_pen_name || false,
    avatar: user?.avatar || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Account deletion modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Keep drafts in sync when user loads / changes
  useEffect(() => {
    if (user?.daily_word_goal != null) setGoalDraft(user.daily_word_goal);
  }, [user?.daily_word_goal]);

  useEffect(() => {
    setProfileDraft({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      pen_name: (user?.pen_name || "").trim(),
      use_pen_name: user?.use_pen_name || false,
      avatar: user?.avatar || "",
    });
  }, [user?.first_name, user?.last_name, user?.pen_name, user?.use_pen_name, user?.avatar]);

  const goalDirty = goalDraft !== (user?.daily_word_goal ?? 500);

  const profileDirty =
    profileDraft.first_name !== (user?.first_name || "") ||
    profileDraft.last_name !== (user?.last_name || "") ||
    profileDraft.pen_name !== (user?.pen_name || "") ||
    profileDraft.use_pen_name !== (user?.use_pen_name || false) ||
    profileDraft.avatar !== (user?.avatar || "");

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await userApi.updatePreferences({
        first_name: profileDraft.first_name,
        last_name: profileDraft.last_name,
        pen_name: profileDraft.pen_name,
        use_pen_name: profileDraft.use_pen_name,
        avatar: profileDraft.avatar,
      });
      updateUser({
        first_name: res.data.first_name,
        last_name: res.data.last_name,
        pen_name: res.data.pen_name,
        use_pen_name: res.data.use_pen_name,
        avatar: res.data.avatar,
      });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Couldn't save that. Try again?",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveGoal = async () => {
    if (goalDraft < 0 || goalDraft > 100000) {
      toast.error("Pick a number between 0 and 100,000.");
      return;
    }
    setSavingGoal(true);
    try {
      const res = await userApi.updatePreferences({
        daily_word_goal: goalDraft,
      });
      updateUser({ daily_word_goal: res.data.daily_word_goal });
      toast.success(
        goalDraft === 0
          ? "Goal turned off."
          : `${goalDraft.toLocaleString()} words a day.`,
      );
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Couldn't save that. Try again?",
      );
    } finally {
      setSavingGoal(false);
    }
  };

  // User name for ThadTour — pulled from the user record (set during onboarding).
  // Falls back to the email-local-part if no display name is set, matching the
  // dashboard greeting's behaviour.
  const userName =
    user?.display_name || user?.email?.split("@")[0] || "Writer";

  const handleStartTour = () => {
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    toast.success("That's the tour. Now go write something.");
  };

  const handleReplayIntro = async () => {
    try {
      await onboardingApi.reset();
      navigate("/onboarding");
    } catch (err) {
      toast.error("Couldn't reset that. Try again?");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;
    setDeleting(true);
    try {
      await userApi.deleteAccount(deleteConfirmation);
      // Order matters: toast → logout → navigate. The toast needs a frame to
      // render before the auth context tears down the surrounding layout.
      toast.success("Account gone. Take care.");
      logout();
      navigate("/");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Couldn't delete the account. Try again?",
      );
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const res = await stylePresetApi.getAll();
      setPresets(res.data);
    } catch (error) {
      toast.error("Couldn't pull up the style presets. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (preset = null) => {
    if (preset) {
      setEditingPreset(preset);
      setFormData({
        name: preset.name,
        description: preset.description,
        visual_style: preset.visual_style,
        mood: preset.mood,
        color_palette: preset.color_palette || "",
      });
    } else {
      setEditingPreset(null);
      setFormData({
        name: "",
        description: "",
        visual_style: "",
        mood: "",
        color_palette: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error("Name and description are needed.");
      return;
    }

    setSaving(true);
    try {
      if (editingPreset) {
        await stylePresetApi.update(editingPreset.id, formData);
        setPresets(
          presets.map((p) =>
            p.id === editingPreset.id ? { ...p, ...formData } : p,
          ),
        );
        toast.success("Updated.");
      } else {
        const res = await stylePresetApi.create(formData);
        setPresets([...presets, res.data]);
        toast.success("Preset saved.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error("Couldn't save that preset. Try again?");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (presetId) => {
    if (!window.confirm("Delete this style preset?")) return;

    try {
      await stylePresetApi.delete(presetId);
      setPresets(presets.filter((p) => p.id !== presetId));
      toast.success("Deleted.");
    } catch (error) {
      toast.error("Couldn't delete that. Try again?");
    }
  };

  if (loading) {
    return (
      <LoadingState
        size="page"
        eyebrow="Settings"
        title="Pulling your preferences together."
        body="One moment — themes, presets, and the way you like things just so."
        testId="loading-settings"
      />
    );
  }

  return (
    <div
      className="px-8 pt-8 pb-4 lg:px-12 lg:pt-12 lg:pb-6 max-w-4xl mx-auto animate-fade-in"
      data-testid="settings-page"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Themes, presets, and the way you like things.
          </p>
        </div>
      </div>

      {/* General Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-accent" />
            General
          </CardTitle>
          <CardDescription>
            App preferences and helpful features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Guided Tour Button */}
            <div className="flex items-center justify-between p-4 border border-border rounded-sm hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-sm bg-accent/10">
                  <Map className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Take the tour</h4>
                  <p className="text-xs text-muted-foreground">
                    A quick walkthrough of the workshop with Thad.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartTour}
                className="rounded-sm"
                data-testid="start-guided-tour-btn"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Start tour
              </Button>
            </div>

            {/* Replay Wow-Moment Onboarding */}
            <div className="flex items-center justify-between p-4 border border-border rounded-sm hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-sm bg-accent/10">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Replay the intro</h4>
                  <p className="text-xs text-muted-foreground">
                    Let Thad read you a passage again. Takes about a minute.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReplayIntro}
                className="rounded-sm"
                data-testid="replay-intro-btn"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Replay
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            Profile
          </CardTitle>
          <CardDescription>
            How you're known here, and how you're known to readers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* First / Last name row */}
          <div className="grid grid-cols-2 gap-4">
            <FieldWithClear
              label="First name"
              value={profileDraft.first_name}
              onChange={(v) =>
                setProfileDraft({ ...profileDraft, first_name: v })
              }
            />
            <FieldWithClear
              label="Last name"
              value={profileDraft.last_name}
              onChange={(v) =>
                setProfileDraft({ ...profileDraft, last_name: v })
              }
            />
          </div>

          {/* Pen name + toggle */}
          <FieldWithClear
            label="Pen name"
            placeholder="The name readers know you by"
            value={profileDraft.pen_name}
            onChange={(v) =>
              setProfileDraft({ ...profileDraft, pen_name: v })
            }
          />
          <div className="flex items-center gap-3 ml-1">
            <Switch
              checked={profileDraft.use_pen_name}
              onCheckedChange={(v) =>
                setProfileDraft({ ...profileDraft, use_pen_name: v })
              }
              disabled={!profileDraft.pen_name.trim()}
            />
            <span className="text-sm text-muted-foreground">
              Use my pen name on shared chapters and exports
            </span>
          </div>

          {/* Avatar picker */}
          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_OPTIONS.map((opt) => {
                const Avatar = AVATAR_COMPONENTS[opt.key];
                const selected = profileDraft.avatar === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      setProfileDraft({
                        ...profileDraft,
                        avatar: selected ? "" : opt.key,
                      })
                    }
                    className={cn(
                      "rounded-md border-2 p-3 flex items-center justify-center transition-colors",
                      selected
                        ? "border-accent text-accent bg-accent/5"
                        : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground",
                    )}
                    aria-label={opt.label}
                    title={opt.label}
                  >
                    <Avatar size={32} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={!profileDirty || savingProfile}
              className="rounded-sm"
            >
              {savingProfile && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily Writing Goal */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />A daily target
          </CardTitle>
          <CardDescription>
            How many words you'd like to write each day. Set to 0 to turn it
            off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* Preset chips */}
            <div className="flex flex-wrap gap-2">
              {[250, 500, 1000, 2000].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoalDraft(g)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-sm border transition-colors",
                    goalDraft === g
                      ? "bg-accent text-accent-foreground border-accent"
                      : "border-border hover:border-accent/50 hover:bg-accent/5",
                  )}
                  data-testid={`daily-goal-preset-${g}`}
                >
                  {g.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setGoalDraft(0)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-sm border transition-colors",
                  goalDraft === 0
                    ? "bg-muted text-muted-foreground border-border"
                    : "border-border hover:border-accent/50 hover:bg-accent/5",
                )}
                data-testid="daily-goal-preset-off"
              >
                Off
              </button>
            </div>

            {/* Custom input + save */}
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs space-y-1.5">
                <Label
                  htmlFor="daily-goal-input"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Custom amount
                </Label>
                <div className="relative">
                  <Input
                    id="daily-goal-input"
                    type="number"
                    min={0}
                    max={100000}
                    step={50}
                    value={goalDraft}
                    onChange={(e) =>
                      setGoalDraft(parseInt(e.target.value, 10) || 0)
                    }
                    className="pr-16"
                    data-testid="daily-goal-input"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    words
                  </span>
                </div>
              </div>
              <Button
                onClick={handleSaveGoal}
                disabled={!goalDirty || savingGoal}
                className="rounded-sm shrink-0"
                data-testid="save-daily-goal-btn"
              >
                {savingGoal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground italic">
              King writes around 2,000 a day. Hemingway aimed for 500. Pick
              something you can hold to.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Theme Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent" />
            Theme
          </CardTitle>
          <CardDescription>How the workshop looks.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(value) => {
              const main = document.querySelector('main');
              const previousScroll = main?.scrollTop || 0;
              setTheme(value);
              const themeName = themes.find((t) => t.id === value)?.name;
              toast.success(`Switched to ${themeName}.`);
              // Restore scroll on the next tick, after React has re-rendered the
              // theme-derived styles. requestAnimationFrame is the right hook —
              // setTimeout(..., 0) sometimes fires too early in development builds.
              requestAnimationFrame(() => {
                if (main) main.scrollTop = previousScroll;
              });
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            data-testid="theme-selector"
          >
            {themes.map((t) => {
              const Icon = THEME_ICONS[t.id] || Sun;
              const colorClass = THEME_COLORS[t.id] || "bg-accent";

              return (
                <Label
                  key={t.id}
                  htmlFor={`theme-${t.id}`}
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-sm cursor-pointer transition-all",
                    theme === t.id
                      ? "border-accent bg-accent/5 ring-1 ring-accent"
                      : "border-border hover:border-accent/50",
                  )}
                  data-testid={`theme-option-${t.id}`}
                >
                  <RadioGroupItem
                    value={t.id}
                    id={`theme-${t.id}`}
                    className="sr-only"
                  />
                  <div className={cn("p-2 rounded-sm", colorClass)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.description}
                    </p>
                  </div>
                  {theme === t.id && (
                    <Check className="h-4 w-4 text-accent shrink-0" />
                  )}
                </Label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Style Presets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent" />
            Style presets
          </CardTitle>
          <Button
            onClick={() => handleOpenDialog()}
            size="sm"
            className="rounded-sm"
            data-testid="add-preset-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            New preset
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Style presets shape the art prompts. Build one for each series,
            mood, or look you want to keep around.
          </p>

          {presets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Palette className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm text-center mb-4">
                  No presets yet. Make one to use over in the art studio.
                </p>
                <Button
                  onClick={() => handleOpenDialog()}
                  variant="outline"
                  className="rounded-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Build your first preset
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-4 border border-border rounded-sm hover:border-accent/50 transition-colors"
                    data-testid={`preset-${preset.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{preset.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {preset.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-muted rounded">
                            Style: {preset.visual_style}
                          </span>
                          <span className="text-xs px-2 py-1 bg-muted rounded">
                            Mood: {preset.mood}
                          </span>
                          {preset.color_palette && (
                            <span className="text-xs px-2 py-1 bg-muted rounded">
                              Colors: {preset.color_palette}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(preset)}
                          className="h-8 w-8"
                          data-testid={`edit-preset-${preset.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(preset.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          data-testid={`delete-preset-${preset.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Preset Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="preset-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingPreset ? "Edit preset" : "New preset"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Epic fantasy"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="rounded-sm"
                  data-testid="preset-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="What does this look and feel like?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="rounded-sm resize-none"
                  rows={2}
                  data-testid="preset-description-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visual_style">Visual style *</Label>
                <Input
                  id="visual_style"
                  placeholder="e.g., soft watercolor, storybook"
                  value={formData.visual_style}
                  onChange={(e) =>
                    setFormData({ ...formData, visual_style: e.target.value })
                  }
                  className="rounded-sm"
                  data-testid="preset-style-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mood">Mood *</Label>
                <Input
                  id="mood"
                  placeholder="e.g., warm, cozy, adventurous"
                  value={formData.mood}
                  onChange={(e) =>
                    setFormData({ ...formData, mood: e.target.value })
                  }
                  className="rounded-sm"
                  data-testid="preset-mood-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color_palette">Colors (optional)</Label>
                <Input
                  id="color_palette"
                  placeholder="e.g., earth tones, forest greens, warm browns"
                  value={formData.color_palette}
                  onChange={(e) =>
                    setFormData({ ...formData, color_palette: e.target.value })
                  }
                  className="rounded-sm"
                  data-testid="preset-colors-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-sm"
                data-testid="save-preset-btn"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving.
                  </>
                ) : editingPreset ? (
                  "Update"
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Danger Zone */}
      <div className="mt-8">
        <div className="border-t border-border mb-6" />
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Delete account</CardTitle>
            <CardDescription>
              Removes your account and everything you've written here —
              projects, chapters, notes, shares — for good. There's no undo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setDeleteModalOpen(true)}
              className="rounded-sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete my account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation modal */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setDeleteConfirmation("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete account?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Everything you've written here will be removed for good —
              projects, chapters, notes, shares, the work. There's no undo.
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type{" "}
                <span className="font-mono font-semibold">DELETE</span>{" "}
                to confirm.
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                autoFocus
                className="rounded-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmation("");
              }}
              disabled={deleting}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== "DELETE" || deleting}
              className="rounded-sm"
            >
              {deleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guided Tour */}
      <ThadTour
        open={showTour}
        onComplete={handleTourComplete}
        userName={userName}
      />
    </div>
  );
}
