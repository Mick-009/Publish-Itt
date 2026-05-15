import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import LoadingState from "@/components/LoadingState";
import { onboardingApi, thadApi } from "@/lib/api";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Palette,
  GraduationCap,
  Lightbulb,
  Check,
  BookOpen,
  Compass,
  PenLine,
  ScrollText,
} from "lucide-react";

// Icon + accent color per genre. The IDs must match the JSON file's genre.id.
const GENRE_VISUALS = {
  literary: {
    icon: BookOpen,
    accent: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  genre: {
    icon: Compass,
    accent: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  mg_ya: {
    icon: PenLine,
    accent: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  memoir_nonfiction: {
    icon: ScrollText,
    accent: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
};

const FALLBACK_VISUAL = GENRE_VISUALS.literary;

// Beats — each one is a screen. The order is fixed.
const BEATS = {
  WELCOME: "welcome",
  GENRE: "genre",
  EXCERPT: "excerpt",
  READING: "reading",
  ANALYSIS: "analysis",
  NOTE: "note",
  FINISH: "finish",
};

// How long the "Reading closely." beat sits before revealing the analysis.
// Long enough to feel like real attention, short enough that no one
// gets bored. Tuned by feel — adjust if it tests wrong.
const READING_DELAY_MS = 2200;

export default function OnboardingFlow({ onFinish }) {
  const navigate = useNavigate();

  const [samples, setSamples] = useState(null);
  const [samplesError, setSamplesError] = useState(null);
  const [beat, setBeat] = useState(BEATS.WELCOME);
  const [chosenGenreId, setChosenGenreId] = useState(null);
  const [styleNoteText, setStyleNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pull the samples on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await onboardingApi.getSamples();
        if (!cancelled) setSamples(res.data);
      } catch (err) {
        console.error("Couldn't load onboarding samples:", err);
        if (!cancelled) {
          setSamplesError(
            "Couldn't load the demo just now. You can skip ahead.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reading beat: auto-advance to analysis after the delay.
  useEffect(() => {
    if (beat !== BEATS.READING) return;
    const t = setTimeout(() => setBeat(BEATS.ANALYSIS), READING_DELAY_MS);
    return () => clearTimeout(t);
  }, [beat]);

  const ui = samples?.ui_copy || {};
  const chosenGenre = samples?.genres?.find((g) => g.id === chosenGenreId);
  const visual = (chosenGenreId && GENRE_VISUALS[chosenGenreId]) || FALLBACK_VISUAL;

  // Mark onboarding complete and exit. Used by both finish flow and skip.
  const completeAndExit = useCallback(
    async ({ skipped = false } = {}) => {
      setSubmitting(true);
      try {
        await onboardingApi.complete({
          chosen_genre: chosenGenreId || null,
          skipped,
        });
        if (onFinish) {
          onFinish();
        } else {
          // Default: send them to project creation. The router gate will
          // see onboarding_complete=true and let them through.
          navigate("/projects/new");
        }
      } catch (err) {
        console.error("Couldn't mark onboarding complete:", err);
        toast.error("Couldn't save your progress. Try again?");
      } finally {
        setSubmitting(false);
      }
    },
    [chosenGenreId, navigate, onFinish],
  );

  // Skip button — same effect as completing, just flagged.
  const handleSkip = () => completeAndExit({ skipped: true });

  // Save the style note, then finish. Skipping the note skips the save
  // but still completes onboarding.
  const handleSaveNoteAndContinue = async () => {
    const note = styleNoteText.trim();
    if (!note) {
      // Empty note = same as skipping the note step. Still mark complete.
      setBeat(BEATS.FINISH);
      return;
    }
    setSubmitting(true);
    try {
      // No project yet, so we can't attach this note to a project here.
      // We'll defer the save until they create their first project.
      // Stash in localStorage so the post-project-create flow can save it.
      localStorage.setItem(
        "publishitt_pending_style_note",
        JSON.stringify({ note, genre: chosenGenreId }),
      );
      setBeat(BEATS.FINISH);
    } catch (err) {
      console.error("Couldn't stash style note:", err);
      // Non-fatal — just move on.
      setBeat(BEATS.FINISH);
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Render branches -----

  // Loading the samples — show a brief loader, then either render or error
  if (!samples && !samplesError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <LoadingState
          size="page"
          title="One moment."
          body="Setting things up."
          testId="loading-onboarding"
        />
      </div>
    );
  }

  if (samplesError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{samplesError}</p>
            <Button onClick={handleSkip} disabled={submitting}>
              Skip ahead
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Header that appears on every beat — small skip link, top-right
  const SkipLink = (
    <button
      type="button"
      onClick={handleSkip}
      disabled={submitting}
      className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      data-testid="onboarding-skip"
    >
      {ui.welcome_skip_label || "Skip for now"}
    </button>
  );

  // ----- Welcome -----
  if (beat === BEATS.WELCOME) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative"
        data-testid="onboarding-welcome"
      >
        {SkipLink}
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Thad
              </span>
            </div>
            <h1 className="text-2xl font-medium leading-tight">
              {ui.welcome_title}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {ui.welcome_body}
            </p>
            <div className="flex justify-end pt-2">
              <Button
                size="lg"
                onClick={() => setBeat(BEATS.GENRE)}
                data-testid="onboarding-welcome-continue"
              >
                {ui.welcome_continue_label || "Show me"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Genre picker -----
  if (beat === BEATS.GENRE) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative"
        data-testid="onboarding-genre"
      >
        {SkipLink}
        <div className="max-w-2xl w-full space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-medium leading-tight">
              {ui.genre_picker_title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {ui.genre_picker_body}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samples.genres.map((genre) => {
              const v = GENRE_VISUALS[genre.id] || FALLBACK_VISUAL;
              const Icon = v.icon;
              const isSelected = chosenGenreId === genre.id;
              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => setChosenGenreId(genre.id)}
                  className={cn(
                    "text-left p-4 rounded-md border transition-all",
                    "hover:border-foreground/30",
                    isSelected
                      ? `${v.border} ${v.bg} ring-2 ring-offset-2 ring-offset-background ${v.accent.replace("text-", "ring-")}`
                      : "border-border bg-card",
                  )}
                  data-testid={`onboarding-genre-${genre.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-md", v.bg)}>
                      <Icon className={cn("h-5 w-5", v.accent)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-1">
                        {genre.label}
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {genre.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setBeat(BEATS.WELCOME)}
              disabled={submitting}
              data-testid="onboarding-genre-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              size="lg"
              onClick={() => setBeat(BEATS.EXCERPT)}
              disabled={!chosenGenreId}
              data-testid="onboarding-genre-continue"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Excerpt (the passage they're about to have read) -----
  if (beat === BEATS.EXCERPT && chosenGenre) {
    const excerpt = chosenGenre.excerpt;
    const headerText = (ui.excerpt_title_template || "From {title}, {author} ({year}).")
      .replace("{title}", excerpt.title)
      .replace("{author}", excerpt.author)
      .replace("{year}", excerpt.year);

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative"
        data-testid="onboarding-excerpt"
      >
        {SkipLink}
        <Card className="max-w-2xl w-full">
          <CardContent className="p-8 space-y-6">
            <div className="space-y-1">
              <Badge variant="secondary" className="text-[10px]">
                {headerText}
              </Badge>
              <p className="text-sm text-muted-foreground pt-2">
                {ui.excerpt_body}
              </p>
            </div>

            <Separator />

            {/* The excerpt itself — serif font for readability, preserved paragraph breaks */}
            <div
              className="prose prose-sm max-w-none text-base leading-relaxed font-serif text-foreground space-y-3"
              data-testid="onboarding-excerpt-text"
            >
              {excerpt.text.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <Separator />

            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setBeat(BEATS.GENRE)}
                disabled={submitting}
                data-testid="onboarding-excerpt-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Different one
              </Button>
              <Button
                size="lg"
                onClick={() => setBeat(BEATS.READING)}
                data-testid="onboarding-excerpt-continue"
              >
                {ui.excerpt_continue_label || "Read it for me"}
                <Sparkles className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Reading beat — delay, then auto-advance to ANALYSIS -----
  if (beat === BEATS.READING) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative"
        data-testid="onboarding-reading"
      >
        <LoadingState
          size="page"
          title={ui.reading_title || "Reading closely."}
          body={ui.reading_body || "Looking at tone, voice, and the shape of the sentences."}
          testId="loading-onboarding-reading"
        />
      </div>
    );
  }

  // ----- Analysis — the wow moment -----
  if (beat === BEATS.ANALYSIS && chosenGenre) {
    const read = chosenGenre.thad_read;
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative"
        data-testid="onboarding-analysis"
      >
        {SkipLink}
        <div className="max-w-2xl w-full space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Thad's read
            </span>
          </div>

          {/* Tone card */}
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Tone</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {read.tone_analysis}
              </p>
            </CardContent>
          </Card>

          {/* Style card */}
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Style</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {read.style_analysis}
              </p>
            </CardContent>
          </Card>

          {/* Reading level */}
          {read.reading_level && (
            <div className="flex items-center gap-2 px-1">
              <GraduationCap className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">
                Reading level:
              </span>
              <Badge variant="secondary" className="text-xs">
                {read.reading_level}
              </Badge>
            </div>
          )}

          {/* Suggestions */}
          {read.suggestions?.length > 0 && (
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">A few suggestions</span>
                </div>
                <div className="space-y-2">
                  {read.suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm"
                      data-testid={`onboarding-suggestion-${i}`}
                    >
                      <span className="text-green-500 font-medium shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-muted-foreground leading-relaxed">
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              onClick={() => setBeat(BEATS.NOTE)}
              data-testid="onboarding-analysis-continue"
            >
              {ui.analysis_continue_label || "One more thing"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Style note prompt — write something, save it -----
  if (beat === BEATS.NOTE) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative"
        data-testid="onboarding-note"
      >
        {SkipLink}
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Thad
                </span>
              </div>
              <h2 className="text-xl font-medium leading-tight">
                {ui.style_note_title || "Last thing."}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ui.style_note_body}
              </p>
            </div>

            <Textarea
              value={styleNoteText}
              onChange={(e) => setStyleNoteText(e.target.value)}
              placeholder={ui.style_note_placeholder || "What should I keep in mind?"}
              className="min-h-[100px] text-sm rounded-sm resize-none"
              data-testid="onboarding-note-textarea"
              autoFocus
            />

            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBeat(BEATS.FINISH)}
                disabled={submitting}
                data-testid="onboarding-note-skip"
              >
                {ui.style_note_skip_label || "Skip this"}
              </Button>
              <Button
                size="lg"
                onClick={handleSaveNoteAndContinue}
                disabled={submitting}
                data-testid="onboarding-note-save"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving.
                  </>
                ) : (
                  <>
                    {ui.style_note_save_label || "Save it"}
                    <Check className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Finish — handoff to project creation -----
  if (beat === BEATS.FINISH) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative"
        data-testid="onboarding-finish"
      >
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Ready
              </span>
            </div>
            <h2 className="text-2xl font-medium leading-tight">
              {ui.finish_title || "Now let's read yours."}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {ui.finish_body}
            </p>
            <div className="flex justify-end pt-2">
              <Button
                size="lg"
                onClick={() => completeAndExit()}
                disabled={submitting}
                data-testid="onboarding-finish-continue"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Just a moment.
                  </>
                ) : (
                  <>
                    {ui.finish_continue_label || "Start my project"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Defensive fallback — shouldn't be reachable but safer than rendering nothing
  return null;
}
