import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { versionsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import VersionCompareDialog from "./VersionCompareDialog";
import EmptyState from "@/components/EmptyState";
import { VersionTimelineArt } from "@/components/EmptyStateArt";
import {
  Plus,
  History,
  Eye,
  Trash2,
  Loader2,
  GitBranch,
  Clock,
  RotateCcw,
  GitCompare,
} from "lucide-react";

export default function VersionsPanel({
  parentType,
  parentId,
  refreshTrigger = 0,
  getCurrentContent,
  onRestoreVersion,
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  const loadVersions = useCallback(async () => {
    if (!parentId) return;
    setLoading(true);
    try {
      const res = await versionsApi.getByParent(parentType, parentId);
      // Sort DESCENDING by created_at (newest first) - THADDAEUS rule
      const sortedVersions = [...res.data].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      setVersions(sortedVersions);
    } catch (error) {
      console.error("Failed to load versions:", error);
    } finally {
      setLoading(false);
    }
  }, [parentId, parentType]);

  useEffect(() => {
    if (parentId) {
      loadVersions();
    }
  }, [parentId, refreshTrigger, loadVersions]);

  // Reset compare selection when compare mode changes
  useEffect(() => {
    if (!compareMode) {
      setSelectedForCompare([]);
    }
  }, [compareMode]);

  const toggleVersionForCompare = (version) => {
    setSelectedForCompare((prev) => {
      const isSelected = prev.some((v) => v.id === version.id);
      if (isSelected) {
        return prev.filter((v) => v.id !== version.id);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  const handleCompareVersions = () => {
    if (selectedForCompare.length === 2) {
      setCompareDialogOpen(true);
    }
  };

  const handleCreateVersion = async () => {
    setCreating(true);
    try {
      await versionsApi.create({
        parent_type: parentType,
        parent_id: parentId,
        content_snapshot: getCurrentContent?.() || "",
        label: buildManualVersionLabel(),
        created_by: "author",
      });
      toast.success("Version snapshot saved");
      setCreateDialogOpen(false);
      setNewVersionLabel("");
      loadVersions();
    } catch (error) {
      toast.error("Failed to create version");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!selectedVersion) return;

    try {
      await versionsApi.delete(selectedVersion.id);
      toast.success("Version deleted");
      setDeleteDialogOpen(false);
      setSelectedVersion(null);
      loadVersions();
    } catch (error) {
      toast.error("Failed to delete version");
    }
  };

  const handleRestoreVersion = () => {
    if (selectedVersion && onRestoreVersion) {
      onRestoreVersion(selectedVersion.content_snapshot);
      setViewDialogOpen(false);
      toast.success("Version restored to editor");
    }
  };

  const handleCompareWithCurrent = (version = selectedVersion) => {
    if (!version) return;

    setSelectedForCompare([
      version,
      {
        id: "current-draft",
        label: "Current Draft",
        content_snapshot: getCurrentContent?.() || "",
        created_at: new Date().toISOString(),
        created_by: "current",
        isCurrentDraft: true,
      },
    ]);
    setViewDialogOpen(false);
    setCompareDialogOpen(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getVersionLabel = (version, fallbackIndex) => {
    if (version?.isCurrentDraft) {
      return "Current Draft";
    }

    if (version?.label?.trim()) {
      return version.label.trim();
    }

    if (version?.created_by === "auto") {
      return `Auto snapshot - ${formatDate(version.created_at)}`;
    }

    return `Saved version ${fallbackIndex}`;
  };

  const getVersionSourceLabel = (version) => {
    if (version?.isCurrentDraft) return "Current";
    if (version?.created_by === "auto") return "Auto";
    if (version?.created_by === "ai") return "AI";
    if (version?.label?.startsWith("AI Snapshot")) return "AI";
    return "Manual";
  };

  const buildManualVersionLabel = () => {
    if (newVersionLabel.trim()) {
      return newVersionLabel.trim();
    }

    return `Manual snapshot - ${formatDate(new Date().toISOString())}`;
  };

  if (!parentId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <History className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Select a chapter to view versions</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full min-w-0 flex-col"
      data-testid="versions-panel"
    >
      <div className="mt-auto space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">Version History</span>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {versions.length}
            </Badge>
          </div>

          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="w-full justify-center rounded-sm"
            data-testid="create-version-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>

        {/* Compare Mode Toggle */}
        {versions.length >= 2 && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-sm">
            <div className="flex shrink-0 items-center gap-2">
              <Checkbox
                id="compareMode"
                checked={compareMode}
                onCheckedChange={setCompareMode}
                data-testid="compare-mode-toggle"
              />
              <label
                htmlFor="compareMode"
                className="text-xs font-medium cursor-pointer flex items-center gap-1"
              >
                <GitCompare className="h-3.5 w-3.5" />
                Compare Mode
              </label>
            </div>
            {compareMode && (
              <Button
                size="sm"
                variant={
                  selectedForCompare.length === 2 ? "default" : "outline"
                }
                onClick={handleCompareVersions}
                disabled={selectedForCompare.length !== 2}
                className="h-7 text-xs rounded-sm"
                data-testid="compare-versions-btn"
              >
                <GitCompare className="h-3 w-3 mr-1" />
                Compare ({selectedForCompare.length}/2)
              </Button>
            )}
          </div>
        )}

        {/* Versions List */}
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <EmptyState
            size="panel"
            art={<VersionTimelineArt size={72} />}
            title="No history to walk back to."
            body="Save a snapshot whenever you want a way back to today's draft."
            primaryAction={{
              label: "Save a version",
              icon: Plus,
              onClick: () => setCreateDialogOpen(true),
              testId: "empty-versions-save-btn",
            }}
            testId="empty-versions-panel"
          />
        ) : (
          <ScrollArea className="h-[320px] w-full">
            <div className="min-w-0 space-y-2 px-1 pb-1">
              {versions.map((version, index) => {
                const isSelectedForCompare = selectedForCompare.some(
                  (v) => v.id === version.id,
                );
                const selectionIndex = selectedForCompare.findIndex(
                  (v) => v.id === version.id,
                );

                return (
                  <Card
                    key={version.id}
                    className={cn(
                      "w-full min-w-0 card-hover cursor-pointer transition-all",
                      compareMode &&
                        isSelectedForCompare &&
                        "ring-2 ring-accent border-accent",
                    )}
                    onClick={() => {
                      if (compareMode) {
                        toggleVersionForCompare(version);
                      } else {
                        setSelectedVersion(version);
                        setViewDialogOpen(true);
                      }
                    }}
                    data-testid={`version-item-${version.id}`}
                  >
                    <CardContent className="p-2 pr-1.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            {compareMode && (
                              <div
                                className={cn(
                                  "flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0",
                                  isSelectedForCompare
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {isSelectedForCompare ? selectionIndex + 1 : ""}
                              </div>
                            )}

                            <p className="min-w-0 truncate font-medium text-sm">
                              {getVersionLabel(
                                version,
                                versions.length - index,
                              )}
                            </p>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="min-w-0 truncate">
                              {formatDate(version.created_at)}
                            </span>
                            <Badge
                              variant="outline"
                              className="shrink-0 px-1.5 py-0 text-[10px]"
                            >
                              {getVersionSourceLabel(version)}
                            </Badge>
                          </div>
                        </div>

                        {!compareMode ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="mt-0.5 h-6 w-6 shrink-0 self-start"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVersion(version);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`delete-version-${version.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        ) : (
                          <div className="w-6" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Create Version Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent data-testid="create-version-dialog">
            <DialogHeader>
              <DialogTitle className="font-serif">
                Save Version Snapshot
              </DialogTitle>
              <DialogDescription>
                Create a snapshot of the current content to track your changes.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="versionLabel">Version Label</Label>
              <Input
                id="versionLabel"
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder="Optional: First draft, After review..."
                className="mt-2 rounded-sm"
                data-testid="version-label-input"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Leave blank to use a timestamped manual snapshot label.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                className="rounded-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateVersion}
                disabled={creating}
                className="rounded-sm"
                data-testid="save-version-submit"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Version"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Version Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent
            className="sm:max-w-2xl"
            data-testid="view-version-dialog"
          >
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {getVersionLabel(selectedVersion, versions.length)}
              </DialogTitle>
              <DialogDescription>
                {selectedVersion && formatDate(selectedVersion.created_at)}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <ScrollArea className="h-[300px] border rounded-sm p-4">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: selectedVersion?.content_snapshot || "",
                  }}
                />
              </ScrollArea>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setViewDialogOpen(false)}
                className="rounded-sm"
              >
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCompareWithCurrent()}
                className="rounded-sm"
                data-testid="compare-current-version-btn"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare With Current
              </Button>
              <Button
                onClick={handleRestoreVersion}
                className="rounded-sm"
                data-testid="restore-version-btn"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore This Version
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent data-testid="delete-version-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this version?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the version "
                {selectedVersion?.label}
                ". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-sm">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteVersion}
                className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="confirm-delete-version-btn"
              >
                Delete Version
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Version Compare Dialog */}
        <VersionCompareDialog
          open={compareDialogOpen}
          onOpenChange={(open) => {
            setCompareDialogOpen(open);
            if (!open) {
              setCompareMode(false);
            }
          }}
          version1={selectedForCompare[0]}
          version2={selectedForCompare[1]}
        />
      </div>
    </div>
  );
}
