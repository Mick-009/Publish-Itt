import { useContext, useState, useEffect, useRef } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { EdgeActionsContext } from "./EdgeActionsContext";

// Unique marker id per edge so each arrow can change color independently
// (selected = accent, at-rest = muted-foreground / 0.6).
// CSS custom properties work in SVG inline styles in all modern browsers.
function Arrow({ markerId, color }) {
  return (
    <defs>
      <marker
        id={markerId}
        markerWidth="8"
        markerHeight="8"
        refX="8"
        refY="4"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M 0 0 L 8 4 L 0 8 Z" style={{ fill: color }} />
      </marker>
    </defs>
  );
}

export default function ConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) {
  const { editingEdgeId, startEdit, saveLabel, cancelEdit, deleteEdge } =
    useContext(EdgeActionsContext);

  const isEditing = editingEdgeId === id;
  const [inputValue, setInputValue] = useState(data?.label ?? "");
  const inputRef = useRef(null);

  // Sync input value when the editor opens for this edge
  useEffect(() => {
    if (isEditing) setInputValue(data?.label ?? "");
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // hsl(var(...) / alpha) is CSS Color Level 4 — valid in inline SVG style
  const strokeColor = selected
    ? "hsl(var(--accent))"
    : "hsl(var(--muted-foreground) / 0.6)";
  const strokeWidth = selected ? 2 : 1.5;
  const markerId = `wb-arrow-${id}`;

  const handleSave = () => {
    const trimmed = inputValue.trim() || null;
    saveLabel(id, trimmed);
    cancelEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
    // Stop Delete/Backspace from reaching the canvas keyboard handler while typing
    e.stopPropagation();
  };

  const handleRemove = (e) => {
    e.preventDefault(); // prevents input blur before the confirm
    deleteEdge(id);
  };

  return (
    <>
      <Arrow markerId={markerId} color={strokeColor} />

      <BaseEdge
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{ stroke: strokeColor, strokeWidth }}
      />

      <EdgeLabelRenderer>
        {isEditing ? (
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="absolute nodrag nopan"
          >
            <div className="flex items-center gap-0.5 bg-card border border-border rounded-sm shadow-md px-2 py-1">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                placeholder="Label this connection…"
                className="text-xs bg-transparent outline-none w-40 text-foreground placeholder:text-muted-foreground/50"
              />
              <button
                onMouseDown={handleRemove}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1 shrink-0"
                tabIndex={-1}
                aria-label="Remove connection"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="absolute nodrag nopan"
            onClick={() => startEdit(id)}
          >
            {data?.label ? (
              <span className="cursor-pointer text-xs bg-background border border-border px-1.5 py-0.5 rounded-sm text-foreground select-none hover:border-accent/50 transition-colors">
                {data.label}
              </span>
            ) : selected ? (
              <span className="cursor-pointer text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors px-1.5 py-0.5 select-none">
                + label
              </span>
            ) : null}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
