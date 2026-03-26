import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { aiApi } from "@/lib/api";
import { AGE_GROUPS } from "@/lib/constants";
import { 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  BookOpen, 
  Wand2,
  User,
  Palette,
  Map
} from "lucide-react";
import ThadTour from "./ThadTour";

const THEMES = [
  { value: "adventure", label: "Adventure & Discovery" },
  { value: "friendship", label: "Friendship & Belonging" },
  { value: "courage", label: "Courage & Bravery" },
  { value: "mystery", label: "Mystery & Secrets" },
  { value: "fantasy", label: "Fantasy & Magic" },
  { value: "nature", label: "Nature & Animals" },
  { value: "family", label: "Family & Love" },
  { value: "humor", label: "Humor & Fun" },
  { value: "learning", label: "Learning & Growth" },
  { value: "other", label: "Something Else" },
];

export default function ThadOnboarding({ open, onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);
  const [showTour, setShowTour] = useState(false);
  
  // User context
  const [userName, setUserName] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [theme, setTheme] = useState("");

  // Detect device type
  const getDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  };

  const handleGetStarted = () => {
    setStep(2);
  };

  const handleContextSubmit = async () => {
    setLoading(true);
    setStep(3);
    
    try {
      const res = await aiApi.thadWelcome(
        userName || "Writer",
        bookTitle || null,
        ageGroup || null,
        theme || null,
        getDeviceType()
      );
      
      setWelcomeData(res.data);
    } catch (error) {
      console.error("Failed to get Thad welcome:", error);
      // Set fallback data
      setWelcomeData({
        message: `Welcome, ${userName || "friend"}! I'm Thad, your creative companion here at Publish Itt. I'm thrilled to have you here. Whether you're starting a brand new adventure or picking up where you left off, I'll be right beside you, ready to help whenever you need a spark of inspiration or a guiding hand.`,
        next_steps: [
          "Start writing your first chapter",
          "Import an existing manuscript",
          "Explore the dashboard"
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = (action) => {
    // Mark onboarding as complete
    localStorage.setItem("thad_onboarding_complete", "true");
    localStorage.setItem("thad_user_name", userName);
    
    // Navigate based on action
    if (action === "take_tour") {
      // Show the guided tour
      setShowTour(true);
    } else if (action === "start_writing") {
      if (onComplete) onComplete();
      navigate("/?action=new_project");
    } else if (action === "import") {
      if (onComplete) onComplete();
      navigate("/?action=import");
    } else {
      if (onComplete) onComplete();
      navigate("/");
    }
  };

  const handleTourComplete = () => {
    setShowTour(false);
    if (onComplete) {
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem("thad_onboarding_complete", "true");
    if (onComplete) {
      onComplete();
    }
  };

  // If showing tour, render tour instead
  if (showTour) {
    return (
      <ThadTour
        open={true}
        onComplete={handleTourComplete}
        userName={userName}
        bookTitle={bookTitle}
        ageGroup={ageGroup}
        theme={theme}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg max-h-[90vh] overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        {/* Step 1: Introduction */}
        {step === 1 && (
          <div className="flex flex-col items-center text-center py-6 px-4">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-accent" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <Wand2 className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <h2 className="font-serif text-2xl font-medium mb-3">
              Welcome to Publish Itt
            </h2>
            
            <p className="text-muted-foreground mb-6 max-w-sm">
              I'm <span className="text-accent font-medium">Thad</span>, your creative companion. 
              I'm here to help you bring your stories to life — one chapter at a time.
            </p>
            
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button 
                onClick={handleGetStarted}
                className="rounded-sm w-full"
                size="lg"
                data-testid="onboarding-get-started"
              >
                Let's Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground text-sm"
                data-testid="onboarding-skip"
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Collect Context */}
        {step === 2 && (
          <div className="py-4">
            <DialogHeader className="mb-6">
              <DialogTitle className="font-serif text-xl flex items-center gap-2">
                <User className="h-5 w-5 text-accent" />
                Tell me about yourself
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                This helps me personalize your experience
              </p>
            </DialogHeader>
            
            <ScrollArea className="max-h-[50vh] pr-2">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="userName">What should I call you?</Label>
                  <Input
                    id="userName"
                    placeholder="Your name or pen name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="rounded-sm"
                    data-testid="onboarding-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bookTitle">
                    Working on something? <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="bookTitle"
                    placeholder="Your book's title or idea"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className="rounded-sm"
                    data-testid="onboarding-book-title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Who are you writing for?</Label>
                  <Select value={ageGroup} onValueChange={setAgeGroup}>
                    <SelectTrigger className="rounded-sm" data-testid="onboarding-age-group">
                      <SelectValue placeholder="Select age group" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_GROUPS.map((group) => (
                        <SelectItem key={group.value} value={group.value}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>What themes inspire you?</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="rounded-sm" data-testid="onboarding-theme">
                      <SelectValue placeholder="Select a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      {THEMES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="rounded-sm"
              >
                Back
              </Button>
              <Button 
                onClick={handleContextSubmit}
                className="flex-1 rounded-sm"
                data-testid="onboarding-continue"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Thad's Welcome */}
        {step === 3 && (
          <div className="py-4 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
                    <Sparkles className="h-8 w-8 text-accent" />
                  </div>
                </div>
                <p className="text-muted-foreground mt-4 text-sm">
                  Thad is preparing your welcome...
                </p>
              </div>
            ) : welcomeData && (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Thad Avatar Header */}
                <div className="flex items-start gap-3 mb-4 shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-medium">Thad</h3>
                    <p className="text-xs text-muted-foreground">Your Creative Companion</p>
                  </div>
                </div>
                
                {/* Message Container */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea className="h-full max-h-[45vh]">
                    {/* Welcome Message Box */}
                    <div className="bg-muted/30 border rounded-lg p-4 mb-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words">
                        {welcomeData.message}
                      </p>
                    </div>
                    
                    {/* Next Steps */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Ready to begin? Here's what you can do:
                      </p>
                      
                      <div className="grid gap-2">
                        {welcomeData.next_steps.map((step, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            className="justify-start h-auto py-3 px-4 rounded-sm text-left w-full"
                            onClick={() => {
                              if (step.toLowerCase().includes("write") || step.toLowerCase().includes("chapter")) {
                                handleNextStep("start_writing");
                              } else if (step.toLowerCase().includes("import")) {
                                handleNextStep("import");
                              } else {
                                handleNextStep("explore");
                              }
                            }}
                            data-testid={`onboarding-action-${index}`}
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className="shrink-0 mt-0.5">
                                {step.toLowerCase().includes("write") || step.toLowerCase().includes("chapter") ? (
                                  <BookOpen className="h-4 w-4 text-accent" />
                                ) : step.toLowerCase().includes("import") ? (
                                  <Wand2 className="h-4 w-4 text-accent" />
                                ) : (
                                  <Palette className="h-4 w-4 text-accent" />
                                )}
                              </div>
                              <span className="text-sm break-words whitespace-normal">{step}</span>
                            </div>
                          </Button>
                        ))}
                        
                        {/* Take a Tour Button */}
                        <Button
                          variant="outline"
                          className="justify-start h-auto py-3 px-4 rounded-sm text-left w-full border-accent/30 bg-accent/5"
                          onClick={() => handleNextStep("take_tour")}
                          data-testid="onboarding-take-tour"
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className="shrink-0 mt-0.5">
                              <Map className="h-4 w-4 text-accent" />
                            </div>
                            <span className="text-sm">Take a quick tour of Publish Itt</span>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
                
                {/* Footer */}
                <div className="mt-4 pt-4 border-t shrink-0">
                  <Button
                    variant="ghost"
                    onClick={() => handleNextStep("explore")}
                    className="w-full text-muted-foreground text-sm"
                    data-testid="onboarding-explore"
                  >
                    I'll explore on my own
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
