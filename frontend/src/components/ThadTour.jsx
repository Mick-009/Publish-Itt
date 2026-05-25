import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { buildTourSteps } from "@/lib/tourSteps";
import {
  Sparkles,
  ArrowRight,
  LayoutDashboard,
  FileText,
  MessageSquareWarning,
  Route,
  Send,
  Flame,
  BookOpen,
  Users,
  Palette,
  X,
} from "lucide-react";

// Per-step icon, keyed by the `icon` field on each tour step. The steps
// carry their own key (set in tourSteps.js), so there's no fragile
// string-matching on the title — a step says which icon it wants.
const STEP_ICONS = {
  welcome: Sparkles,
  dashboard: LayoutDashboard,
  manuscript: FileText,
  pushback: MessageSquareWarning,
  arc: Route,
  sharing: Send,
  momentum: Flame,
};

export default function ThadTour({
  open,
  onComplete,
  userName = "Writer",
  bookTitle = null,
  // ageGroup / theme are no longer used — the tour is hand-authored and
  // doesn't call the model. Kept in the signature so existing callers don't
  // break; safe to remove from the call site whenever convenient.
  ageGroup = null,
  theme = null,
}) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // The whole tour, built once per (name, title). No API, no loading.
  const steps = useMemo(
    () => buildTourSteps({ userName, bookTitle }),
    [userName, bookTitle],
  );

  const tourData = steps[currentStep] || steps[0];
  const StepIcon = STEP_ICONS[tourData.icon] || Sparkles;
  const progressPercent =
    (tourData.step_number / tourData.total_steps) * 100;

  const handleNext = () => {
    if (tourData.is_final) {
      handleComplete("explore");
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
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

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleSkip();
      }}
    >
      <DialogContent className="sm:max-w-md overflow-hidden">
        <div className="py-2">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                Step {tourData.step_number} of {tourData.total_steps}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleSkip}
                data-testid="tour-skip"
              >
                <X className="h-3 w-3 mr-1" />
                Skip
              </Button>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          {/* Step Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <StepIcon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-medium text-base">{tourData.area}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Thad
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
                Where would you like to start?
              </p>
              <div className="grid gap-2">
                <Button
                  className="w-full rounded-sm justify-start h-auto py-3"
                  onClick={() => handleComplete("start_writing")}
                  data-testid="tour-start-writing"
                >
                  <BookOpen className="h-4 w-4 mr-3 shrink-0" />
                  <span>Start writing</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-sm justify-start h-auto py-3"
                  onClick={() => handleComplete("create_character")}
                  data-testid="tour-create-character"
                >
                  <Users className="h-4 w-4 mr-3 shrink-0" />
                  <span>Make a character</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-sm justify-start h-auto py-3"
                  onClick={() => handleComplete("book_style")}
                  data-testid="tour-book-style"
                >
                  <Palette className="h-4 w-4 mr-3 shrink-0" />
                  <span>Set the look</span>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
