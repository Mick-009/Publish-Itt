/**
 * LoadingState — the shared loading-state primitive for Publish Itt.
 *
 * Mirrors EmptyState's API and voice rules. Used wherever we'd otherwise
 * drop a bare <Loader2 />: page gates, panel-level analysis runs, in-flight
 * AI work. The spinner is small and quiet — the type carries the voice.
 *
 * Three sizes:
 *   - "page":  takes a full route while initial data loads
 *   - "panel": fits inside a side panel or card during an action
 *   - "inline": tight one-liner for narrow lists or buttons-area
 *
 * Voice: warm, declarative, present-tense. Speaks like Thad would —
 * "Pulling your work off the shelves." Never "Loading…" alone.
 *
 * NOTE: For inline button spinners (loading state of a single Button),
 * keep using <Loader2 /> directly inside the button. This primitive is
 * for surfaces, not buttons.
 */

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoadingState({
  eyebrow,        // <string> — uppercase label above title (optional)
  title,          // <string> — the warm headline
  body,           // <string> — one sentence of context (optional)
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
      role="status"
      aria-live="polite"
    >
      <Loader2
        className={cn(
          "text-accent animate-spin",
          isPage   && "h-7 w-7 mb-5",
          size === "panel" && "h-5 w-5 mb-4",
          isInline && "h-4 w-4 mb-2",
        )}
        aria-hidden="true"
      />

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
            isPage   && "text-2xl md:text-3xl mb-2",
            size === "panel"  && "text-base mb-1",
            isInline && "text-sm",
          )}
        >
          {title}
        </h2>
      )}

      {body && (
        <p
          className={cn(
            "text-muted-foreground leading-relaxed",
            isPage   && "text-base max-w-sm",
            size === "panel"  && "text-xs max-w-[260px]",
            isInline && "text-xs",
          )}
        >
          {body}
        </p>
      )}
    </div>
  );
}
