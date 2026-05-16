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
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { stylePresetApi, userApi, onboardingApi } from "@/lib/api";
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

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, themes } = useTheme();
  const { user, updateUser } = useAuth();
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

  // Keep draft in sync when user loads / changes
  useEffect(() => {
    if (user?.daily_word_goal != null) setGoalDraft(user.daily_word_goal);
  }, [user?.daily_word_goal]);

  const goalDirty = goalDraft !== (user?.daily_word_goal ?? 500);

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
      className="p-8 lg:p-12 max-w-4xl mx-auto animate-fade-in"
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
              setTheme(value);
              const themeName = themes.find((t) => t.id === value)?.name;
              toast.success(`Switched to ${themeName}.`);
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

          <ScrollArea className="h-[400px]">
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
          </ScrollArea>
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

      {/* Guided Tour */}
      <ThadTour
        open={showTour}
        onComplete={handleTourComplete}
        userName={userName}
      />
    </div>
  );
}
