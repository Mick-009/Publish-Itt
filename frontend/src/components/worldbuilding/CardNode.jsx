import { memo, useState, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// chart-1 (24 80% 44%) is identical to the default accent and very close to
// campfire accent (20 90% 48%) — use chart-5 for character to avoid collision.
const TYPE_COLORS = {
  character: "hsl(var(--chart-5))",  // 27 87% 67% — light peach/salmon
  place:     "hsl(var(--chart-2))",  // 173 58% 39% — teal
  note:      "hsl(var(--chart-4))",  // 43 74% 66%  — golden
};

const TYPE_LABELS = {
  character: "CHARACTER",
  place:     "PLACE",
  note:      "NOTE",
};

function ProvenanceMarker({ provenance }) {
  if (provenance === "manual") return null;
  const isEdited = provenance === "ai_edited";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "shrink-0 flex items-center",
            isEdited && "opacity-50",
          )}
        >
          <Sparkles className="h-3 w-3 text-accent" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        {isEdited
          ? "Thad brought this in — you've made it yours."
          : "Thad brought this in."}
      </TooltipContent>
    </Tooltip>
  );
}

function CardNode({ data, selected }) {
  const item = data.item;
  const { type, title, provenance } = item;

  // One-shot fade-in for cards that just arrived from a Thad extraction.
  // justArrived is set in node data at creation time; local state clears it
  // after the animation so it doesn't replay if the node re-renders.
  const [arrived, setArrived] = useState(data.justArrived ?? false);
  useEffect(() => {
    if (!arrived) return;
    const t = setTimeout(() => setArrived(false), 350);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cardData = item.data ?? {};
  const typeColor = TYPE_COLORS[type] ?? TYPE_COLORS.note;
  const typeLabel = TYPE_LABELS[type] ?? type.toUpperCase();

  const metaValue =
    type === "character"
      ? cardData.role
      : type === "place"
      ? cardData.kind
      : null;

  const bodyValue = cardData.body;

  // Handles: target on left, source on right — connections read left-to-right.
  // Sized at 8px, centered on the node edge (left/right: -4 corrects for RF's
  // default -3px offset which assumes the default 6px handle size).
  const handleStyle = {
    width: 8,
    height: 8,
    background: typeColor,
    border: "2px solid hsl(var(--card))",
  };

  return (
    <div
      className={cn(
        "w-60 bg-card border border-border rounded-md overflow-hidden select-none",
        "shadow-[var(--shadow-card)]",
        selected && "ring-2 ring-accent ring-offset-0",
        arrived && "animate-fade-in",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ ...handleStyle, left: -4 }}
        className="transition-transform duration-100 hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ ...handleStyle, right: -4 }}
        className="transition-transform duration-100 hover:scale-125"
      />

      {/* Type color strip */}
      <div style={{ height: 3, backgroundColor: typeColor }} />

      {/* Content */}
      <div className="px-3 pt-2 pb-3">
        {/* Type label + provenance marker */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none">
            {typeLabel}
          </span>
          <ProvenanceMarker provenance={provenance} />
        </div>

        {/* Title */}
        <p
          className={cn(
            "font-serif text-sm font-medium leading-snug",
            !title && "italic text-muted-foreground",
          )}
        >
          {title || "Untitled"}
        </p>

        {/* Meta line: role (character) or kind (place) */}
        {metaValue && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
            {metaValue}
          </p>
        )}

        {/* Body preview — hidden when empty */}
        {bodyValue && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
            {bodyValue}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(CardNode);
