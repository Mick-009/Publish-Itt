import { useCallback } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  User,
  MapPin,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { worldbuildingApi } from "@/lib/api";
import { cn } from "@/lib/utils";

function stubAction() {
  toast("Coming in the next pass.");
}

export default function CanvasToolbar({
  projectId,
  onCardCreated,
  isDragging,
  getCanvasCenter,
}) {
  const { zoomIn, zoomOut, fitView, zoomTo, screenToFlowPosition } =
    useReactFlow();
  const { zoom } = useViewport();
  const zoomPercent = Math.round((zoom ?? 1) * 100);

  const createCard = useCallback(
    async (type) => {
      if (!projectId) return;
      const center = getCanvasCenter();
      const offset = {
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 40,
      };
      const position = screenToFlowPosition({
        x: center.x + offset.x,
        y: center.y + offset.y,
      });

      try {
        const res = await worldbuildingApi.createItem({
          projectId,
          type,
          position,
        });
        onCardCreated(res.data);
      } catch {
        toast.error("Couldn't add that card. Try again?");
      }
    },
    [projectId, getCanvasCenter, screenToFlowPosition, onCardCreated],
  );

  return (
    <div
      className={cn(
        "absolute bottom-6 left-1/2 -translate-x-1/2 z-10",
        "flex items-center gap-0.5 bg-card border border-border rounded-md shadow-md px-1.5 py-1",
        "transition-opacity duration-150",
        isDragging ? "opacity-40" : "opacity-100",
      )}
    >
      {/* ── Add group ──────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-sm h-8 px-2.5 text-sm font-normal"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-[140px]">
          <DropdownMenuItem onSelect={() => createCard("character")}>
            <User className="mr-2 h-4 w-4" />
            Character
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => createCard("place")}>
            <MapPin className="mr-2 h-4 w-4" />
            Place
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => createCard("note")}>
            <FileText className="mr-2 h-4 w-4" />
            Note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* ── Ask Thad group ─────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-sm h-8 px-2.5 text-sm font-normal"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            Ask Thad
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-[220px]">
          <DropdownMenuItem onSelect={stubAction}>
            Extract characters from a chapter
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={stubAction}>
            Summarize a chapter
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={stubAction}>
            Outline the book
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* ── View group ─────────────────────────────────────────────────────── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-sm h-8 px-2 text-xs tabular-nums text-muted-foreground hover:text-foreground min-w-[42px]"
            onClick={() => zoomTo(1, { duration: 200 })}
          >
            {zoomPercent}%
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Reset to 100%
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-sm h-8 w-8 p-0 flex items-center justify-center"
            onClick={() => zoomOut({ duration: 200 })}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Zoom out
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-sm h-8 w-8 p-0 flex items-center justify-center"
            onClick={() => zoomIn({ duration: 200 })}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Zoom in
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-sm h-8 w-8 p-0 flex items-center justify-center"
            onClick={() => fitView({ duration: 300, padding: 0.15 })}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Fit view
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
