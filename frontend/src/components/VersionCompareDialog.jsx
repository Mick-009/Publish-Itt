import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { diffWords, diffLines } from "diff";
import { 
  GitCompare, 
  Clock,
  Plus,
  Minus,
  ArrowRight,
  Columns,
  AlignJustify
} from "lucide-react";

// Strip HTML tags for text comparison
function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

// Format date for display
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function VersionCompareDialog({ 
  open, 
  onOpenChange, 
  version1, 
  version2 
}) {
  const [viewMode, setViewMode] = useState("side-by-side"); // "side-by-side" or "unified"

  // Compute diff between versions
  const diff = useMemo(() => {
    if (!version1 || !version2) return [];
    
    const text1 = stripHtml(version1.content_snapshot);
    const text2 = stripHtml(version2.content_snapshot);
    
    // Use line-based diff for side-by-side, word-based for unified
    if (viewMode === "side-by-side") {
      return diffLines(text1, text2);
    }
    return diffWords(text1, text2);
  }, [version1, version2, viewMode]);

  // Calculate stats
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;
    
    diff.forEach(part => {
      const wordCount = part.value.split(/\s+/).filter(w => w).length;
      if (part.added) {
        additions += wordCount;
      } else if (part.removed) {
        deletions += wordCount;
      } else {
        unchanged += wordCount;
      }
    });
    
    return { additions, deletions, unchanged };
  }, [diff]);

  if (!version1 || !version2) return null;

  // Determine which version is older/newer
  const olderVersion = new Date(version1.created_at) < new Date(version2.created_at) ? version1 : version2;
  const newerVersion = version1 === olderVersion ? version2 : version1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh]" data-testid="version-compare-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Versions
          </DialogTitle>
          <DialogDescription>
            Viewing changes between version snapshots
          </DialogDescription>
        </DialogHeader>

        {/* Version Info Header */}
        <div className="flex items-center justify-between gap-4 p-3 bg-muted rounded-sm">
          <div className="flex-1 text-center">
            <Badge variant="outline" className="mb-1 bg-red-500/10 text-red-600 border-red-500/20">
              Older
            </Badge>
            <p className="font-medium text-sm truncate">{olderVersion.label || "Untitled"}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(olderVersion.created_at)}
            </p>
          </div>
          
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          
          <div className="flex-1 text-center">
            <Badge variant="outline" className="mb-1 bg-green-500/10 text-green-600 border-green-500/20">
              Newer
            </Badge>
            <p className="font-medium text-sm truncate">{newerVersion.label || "Untitled"}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(newerVersion.created_at)}
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-green-600">
              <Plus className="h-4 w-4" />
              {stats.additions} words added
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="h-4 w-4" />
              {stats.deletions} words removed
            </span>
            <span className="text-muted-foreground">
              {stats.unchanged} words unchanged
            </span>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border rounded-sm p-0.5">
            <Button
              variant={viewMode === "side-by-side" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 rounded-sm"
              onClick={() => setViewMode("side-by-side")}
              data-testid="side-by-side-view-btn"
            >
              <Columns className="h-3.5 w-3.5 mr-1" />
              Side by Side
            </Button>
            <Button
              variant={viewMode === "unified" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 rounded-sm"
              onClick={() => setViewMode("unified")}
              data-testid="unified-view-btn"
            >
              <AlignJustify className="h-3.5 w-3.5 mr-1" />
              Unified
            </Button>
          </div>
        </div>

        {/* Diff Content */}
        <ScrollArea className="h-[400px] border rounded-sm">
          {viewMode === "side-by-side" ? (
            <SideBySideView 
              olderVersion={olderVersion} 
              newerVersion={newerVersion} 
              diff={diff}
            />
          ) : (
            <UnifiedView diff={diff} />
          )}
        </ScrollArea>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30" />
            Removed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/30" />
            Added
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-muted" />
            Unchanged
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Side-by-side view component
function SideBySideView({ olderVersion, newerVersion, diff }) {
  // Build left (removed/unchanged) and right (added/unchanged) content
  const leftLines = [];
  const rightLines = [];
  
  diff.forEach((part, index) => {
    if (part.removed) {
      leftLines.push({ type: "removed", text: part.value, key: `left-${index}` });
    } else if (part.added) {
      rightLines.push({ type: "added", text: part.value, key: `right-${index}` });
    } else {
      leftLines.push({ type: "unchanged", text: part.value, key: `left-${index}` });
      rightLines.push({ type: "unchanged", text: part.value, key: `right-${index}` });
    }
  });

  return (
    <div className="grid grid-cols-2 divide-x divide-border" data-testid="side-by-side-diff">
      {/* Left Panel - Older Version */}
      <div className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
          {olderVersion.label || "Older Version"}
        </p>
        <div className="prose prose-sm max-w-none">
          {leftLines.map((line) => (
            <span
              key={line.key}
              className={cn(
                "whitespace-pre-wrap",
                line.type === "removed" && "bg-red-500/20 text-red-900 dark:text-red-200 px-0.5 rounded-sm"
              )}
            >
              {line.text}
            </span>
          ))}
        </div>
      </div>
      
      {/* Right Panel - Newer Version */}
      <div className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
          {newerVersion.label || "Newer Version"}
        </p>
        <div className="prose prose-sm max-w-none">
          {rightLines.map((line) => (
            <span
              key={line.key}
              className={cn(
                "whitespace-pre-wrap",
                line.type === "added" && "bg-green-500/20 text-green-900 dark:text-green-200 px-0.5 rounded-sm"
              )}
            >
              {line.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Unified diff view component
function UnifiedView({ diff }) {
  return (
    <div className="p-4 prose prose-sm max-w-none" data-testid="unified-diff">
      {diff.map((part, index) => (
        <span
          key={index}
          className={cn(
            "whitespace-pre-wrap",
            part.added && "bg-green-500/20 text-green-900 dark:text-green-200 px-0.5 rounded-sm",
            part.removed && "bg-red-500/20 text-red-900 dark:text-red-200 line-through px-0.5 rounded-sm"
          )}
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}
