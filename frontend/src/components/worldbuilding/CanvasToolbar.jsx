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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Sparkles,
  Loader2,
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

export default function CanvasToolbar({
  projectId,
  projects,
  onProjectChange,
  onCardCreated,
  isDragging,
  getCanvasCenter,
  thadWorking,
  onSummarize,
  onOutline,
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

  // Compute the current viewport center in flow coordinates and pass it to the
  // canvas so extracted cards land where the writer is looking.
  const getFlowCenter = useCallback(() => {
    const center = getCanvasCenter();
    return screenToFlowPosition(center);
  }, [getCanvasCenter, screenToFlowPosition]);

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
            disabled={thadWorking}
          >
            {thadWorking ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0" />
            )}
            Thad
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-[180px]">
          <DropdownMenuItem
            onSelect={() => onSummarize(getFlowCenter())}
            disabled={thadWorking}
          >
            Summarize a chapter
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onOutline(getFlowCenter())}
            disabled={thadWorking}
          >
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

      {projects?.length > 1 && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* ── Project switcher ───────────────────────────────────────────── */}
          <Select value={projectId ?? ""} onValueChange={onProjectChange}>
            <SelectTrigger
              className={cn(
                "h-8 rounded-sm border-0 bg-transparent shadow-none px-2",
                "text-xs text-muted-foreground hover:text-foreground",
                "focus:ring-0 focus:ring-offset-0",
                "w-[9rem] max-w-[9rem]",
              )}
            >
              <SelectValue placeholder="Switch world" />
            </SelectTrigger>
            <SelectContent side="top" align="end">
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-sm">
                  <span className="block truncate max-w-[16ch]">
                    {p.title || "Untitled"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}
