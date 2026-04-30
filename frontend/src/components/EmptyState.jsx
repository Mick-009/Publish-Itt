/**
 * EmptyState — the shared empty-state primitive for Publish Itt.
 *
 * Every "nothing here yet" surface in the app routes through this component
 * so the voice, spacing, typography, and animation stay consistent.
 *
 * Three sizes:
 *   - "page":  takes a full route — used for "No Projects Yet" workspace gates
 *   - "panel": fits inside a side panel (Notes, Versions, Insight)
 *   - "inline": a tight one-liner for narrow lists
 *
 * Voice: warm, editorial, never apologetic. Speaks to the writer like Thad would —
 * one sentence, specific, never "Oops! Nothing here yet."
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export default function EmptyState({
  art,            // <ReactNode> — small typographic illustration
  eyebrow,        // <string>    — uppercase label above title (optional)
  title,          // <string>    — the warm headline, e.g. "An empty page is a beginning."
  body,           // <string>    — one sentence of context, never two
  primaryAction,  // {label, onClick, icon, testId}
  secondaryAction,// {label, onClick, icon, testId}
  size = "panel", // "page" | "panel" | "inline"
  className,
  testId,
}) {
  const isPage   = size === "page";
  const isInline = size === "inline";

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center animate-fade-in",
        isPage   && "justify-center h-full px-8 py-12 max-w-md mx-auto",
        size === "panel" && "justify-center px-6 py-10",
        isInline && "px-4 py-6",
        className,
      )}
      data-testid={testId}
    >
      {art && (
        <div
          className={cn(
            "mb-5 text-muted-foreground/60",
            isPage   && "mb-7",
            isInline && "mb-3",
          )}
        >
          {art}
        </div>
      )}

      {eyebrow && (
        <p
          className={cn(
            "uppercase tracking-[0.18em] font-semibold text-accent mb-2",
            isPage ? "text-[11px]" : "text-[10px]",
          )}
        >
          {eyebrow}
        </p>
      )}

      {title && (
        <h2
          className={cn(
            "font-serif tracking-tight leading-tight text-foreground",
            isPage   && "text-3xl md:text-4xl mb-3",
            size === "panel"  && "text-lg mb-2",
            isInline && "text-sm mb-1",
          )}
        >
          {title}
        </h2>
      )}

      {body && (
        <p
          className={cn(
            "text-muted-foreground leading-relaxed",
            isPage   && "text-base mb-7 max-w-sm",
            size === "panel"  && "text-xs mb-5 max-w-[260px]",
            isInline && "text-xs",
          )}
        >
          {body}
        </p>
      )}

      {(primaryAction || secondaryAction) && (
        <div
          className={cn(
            "flex flex-col items-center gap-2",
            isPage && "sm:flex-row sm:gap-3",
          )}
        >
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              size={isPage ? "default" : "sm"}
              className="rounded-sm"
              data-testid={primaryAction.testId}
            >
              {primaryAction.icon && (
                <primaryAction.icon className="h-4 w-4 mr-2" />
              )}
              {primaryAction.label}
              {primaryAction.showArrow && (
                <ArrowRight className="h-4 w-4 ml-2" />
              )}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              size={isPage ? "default" : "sm"}
              className="rounded-sm text-muted-foreground hover:text-foreground"
              data-testid={secondaryAction.testId}
            >
              {secondaryAction.icon && (
                <secondaryAction.icon className="h-4 w-4 mr-2" />
              )}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
