import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { aiApi } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import { 
  Sparkles, 
  ArrowRight, 
  LayoutDashboard,
  FileText,
  List,
  Bot,
  History,
  Upload,
  BookOpen,
  Users,
  Palette,
  X
} from "lucide-react";

const STEP_ICONS = {
  dashboard: LayoutDashboard,
  manuscript: FileText,
  chapters: List,
  ai_assistant: Bot,
  versions: History,
  import: Upload
};

export default function ThadTour({ 
  open, 
  onComplete, 
  userName = "Writer",
  bookTitle = null,
  ageGroup = null,
  theme = null 
}) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tourData, setTourData] = useState(null);

  const getDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  };

  const fetchTourStep = async (stepIndex) => {
    setLoading(true);
    try {
      const res = await aiApi.thadTour(
        userName,
        bookTitle,
        ageGroup,
        theme,
        getDeviceType(),
        stepIndex
      );
      setTourData(res.data);
    } catch (error) {
      console.error("Failed to get tour step:", error);
      // Fallback data
      setTourData({
        step_number: stepIndex + 1,
        total_steps: 6,
        area: "Feature",
        message: "Let me show you around Publish Itt!",
        is_final: stepIndex >= 5,
        final_actions: stepIndex >= 5 ? ["Start Writing", "Create a Character", "Set Up My Book Style"] : null
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTourStep(currentStep);
    }
  }, [open, currentStep]);

  const handleNext = () => {
    if (tourData?.is_final) {
      handleComplete("explore");
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("thad_tour_complete", "true");
    if (onComplete) {
      onComplete();
    }
  };

  const handleComplete = (action) => {
    localStorage.setItem("thad_tour_complete", "true");
    if (onComplete) {
      onComplete();
    }
    
    if (action === "start_writing") {
      navigate("/?action=new_project");
    } else if (action === "create_character") {
      navigate("/");
    } else if (action === "book_style") {
      navigate("/settings");
    }
  };

  const StepIcon = tourData?.area ? STEP_ICONS[
    Object.keys(STEP_ICONS).find(key => 
      tourData.area.toLowerCase().includes(key.replace('_', ' '))
    ) || 'dashboard'
  ] : Sparkles;

  const progressPercent = tourData ? (tourData.step_number / tourData.total_steps) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <div className="py-2">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                Step {tourData?.step_number || 1} of {tourData?.total_steps || 6}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleSkip}
                data-testid="tour-skip"
              >
                <X className="h-3 w-3 mr-1" />
                Skip Tour
              </Button>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          {loading ? (
            <LoadingState
              size="inline"
              title="One moment."
              testId="loading-tour-step"
            />
          ) : tourData && (
            <>
              {/* Step Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-base">{tourData.area}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Thad's Tour
                  </p>
                </div>
              </div>

              {/* Message Box */}
              <div className="bg-muted/30 border rounded-lg p-4 mb-6">
                <p className="text-sm text-foreground leading-relaxed break-words">
                  {tourData.message}
                </p>
              </div>

              {/* Actions */}
              {tourData.is_final ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-center text-muted-foreground mb-3">
                    Ready to create? Choose your starting point:
                  </p>
                  <div className="grid gap-2">
                    <Button
                      className="w-full rounded-sm justify-start h-auto py-3"
                      onClick={() => handleComplete("start_writing")}
                      data-testid="tour-start-writing"
                    >
                      <BookOpen className="h-4 w-4 mr-3 shrink-0" />
                      <span>Start Writing</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-sm justify-start h-auto py-3"
                      onClick={() => handleComplete("create_character")}
                      data-testid="tour-create-character"
                    >
                      <Users className="h-4 w-4 mr-3 shrink-0" />
                      <span>Create a Character</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-sm justify-start h-auto py-3"
                      onClick={() => handleComplete("book_style")}
                      data-testid="tour-book-style"
                    >
                      <Palette className="h-4 w-4 mr-3 shrink-0" />
                      <span>Set Up My Book Style</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button
                    onClick={handleNext}
                    className="rounded-sm"
                    data-testid="tour-next"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
