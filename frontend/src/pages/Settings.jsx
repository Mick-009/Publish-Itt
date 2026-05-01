import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { stylePresetApi, userApi } from "@/lib/api";
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
  RotateCcw,
  Target
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
    color_palette: ""
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
      toast.error("Please enter a number between 0 and 100,000");
      return;
    }
    setSavingGoal(true);
    try {
      const res = await userApi.updatePreferences({ daily_word_goal: goalDraft });
      updateUser({ daily_word_goal: res.data.daily_word_goal });
      toast.success(
        goalDraft === 0
          ? "Daily goal turned off"
          : `Daily goal set to ${goalDraft.toLocaleString()} words`,
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not update goal");
    } finally {
      setSavingGoal(false);
    }
  };

  // Get user context from localStorage (set during onboarding)
  const userName = localStorage.getItem("thad_user_name") || "Writer";

  const handleStartTour = () => {
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    toast.success("Tour completed! You're ready to create.");
  };

  const handleResetOnboarding = () => {
    // Clear all onboarding-related localStorage keys
    localStorage.removeItem("thad_onboarding_complete");
    localStorage.removeItem("thad_user_name");
    localStorage.removeItem("thad_tour_complete");
    
    toast.success("Onboarding reset! Redirecting to welcome experience...");
    
    // Navigate to Dashboard which will trigger the onboarding flow
    setTimeout(() => {
      navigate("/");
      // Force page reload to ensure fresh state
      window.location.reload();
    }, 500);
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const res = await stylePresetApi.getAll();
      setPresets(res.data);
    } catch (error) {
      toast.error("Failed to load style presets");
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
        color_palette: preset.color_palette || ""
      });
    } else {
      setEditingPreset(null);
      setFormData({
        name: "",
        description: "",
        visual_style: "",
        mood: "",
        color_palette: ""
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error("Name and description are required");
      return;
    }

    setSaving(true);
    try {
      if (editingPreset) {
        await stylePresetApi.update(editingPreset.id, formData);
        setPresets(presets.map(p => 
          p.id === editingPreset.id ? { ...p, ...formData } : p
        ));
        toast.success("Preset updated!");
      } else {
        const res = await stylePresetApi.create(formData);
        setPresets([...presets, res.data]);
        toast.success("Preset created!");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save preset");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (presetId) => {
    if (!window.confirm("Are you sure you want to delete this style preset?")) return;
    
    try {
      await stylePresetApi.delete(presetId);
      setPresets(presets.filter(p => p.id !== presetId));
      toast.success("Preset deleted");
    } catch (error) {
      toast.error("Failed to delete preset");
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
    <div className="p-8 lg:p-12 max-w-4xl mx-auto animate-fade-in" data-testid="settings-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage your themes, style presets, and preferences
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
            App preferences and helpful features
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
                  <h4 className="font-medium text-sm">Guided Tour</h4>
                  <p className="text-xs text-muted-foreground">
                    Take a quick tour of Publish Itt's features with Thad
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
                Start Tour
              </Button>
            </div>
            
            {/* Reset Onboarding Button */}
            <div className="flex items-center justify-between p-4 border border-border rounded-sm hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-sm bg-orange-500/10">
                  <RotateCcw className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Reset Onboarding</h4>
                  <p className="text-xs text-muted-foreground">
                    Start fresh with the welcome experience from the beginning
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetOnboarding}
                className="rounded-sm border-orange-500/30 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600"
                data-testid="reset-onboarding-btn"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Writing Goal */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Daily Writing Goal
          </CardTitle>
          <CardDescription>
            A daily word target shown on your dashboard. Set to 0 to turn it off.
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
                <Label htmlFor="daily-goal-input" className="text-xs uppercase tracking-wider text-muted-foreground">
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
                    onChange={(e) => setGoalDraft(parseInt(e.target.value, 10) || 0)}
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
                {savingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground italic">
              Stephen King writes ~2,000 words a day. Hemingway aimed for 500. Pick something sustainable.
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
          <CardDescription>
            Choose a color theme for THADDAEUS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(value) => {
              setTheme(value);
              toast.success(`Theme changed to ${themes.find(t => t.id === value)?.name}`);
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
                      : "border-border hover:border-accent/50"
                  )}
                  data-testid={`theme-option-${t.id}`}
                >
                  <RadioGroupItem value={t.id} id={`theme-${t.id}`} className="sr-only" />
                  <div className={cn("p-2 rounded-sm", colorClass)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
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
            Style Presets
          </CardTitle>
          <Button
            onClick={() => handleOpenDialog()}
            size="sm"
            className="rounded-sm"
            data-testid="add-preset-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Preset
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Style presets define the visual direction for your art prompts. Create presets for different series, moods, or artistic styles.
          </p>
          
          <ScrollArea className="h-[400px]">
            {presets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Palette className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm text-center mb-4">
                  No style presets yet. Create one to use in the Art Studio.
                </p>
                <Button onClick={() => handleOpenDialog()} variant="outline" className="rounded-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Preset
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
              {editingPreset ? "Edit Style Preset" : "Create Style Preset"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Epic Fantasy"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-sm"
                  data-testid="preset-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this visual style..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-sm resize-none"
                  rows={2}
                  data-testid="preset-description-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visual_style">Visual Style *</Label>
                <Input
                  id="visual_style"
                  placeholder="e.g., Soft watercolor, storybook illustration"
                  value={formData.visual_style}
                  onChange={(e) => setFormData({ ...formData, visual_style: e.target.value })}
                  className="rounded-sm"
                  data-testid="preset-style-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mood">Mood *</Label>
                <Input
                  id="mood"
                  placeholder="e.g., Warm, cozy, adventurous"
                  value={formData.mood}
                  onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                  className="rounded-sm"
                  data-testid="preset-mood-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color_palette">Color Palette (optional)</Label>
                <Input
                  id="color_palette"
                  placeholder="e.g., Earth tones, forest greens, warm browns"
                  value={formData.color_palette}
                  onChange={(e) => setFormData({ ...formData, color_palette: e.target.value })}
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
                    Saving...
                  </>
                ) : (
                  editingPreset ? "Update Preset" : "Create Preset"
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
