import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { diffLines, diffWords } from "diff";
import {
  AlignJustify,
  ArrowRight,
  Clock,
  Columns,
  GitCompare,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);

function htmlToReadableText(html) {
  if (!html) return "";

  const root = document.createElement("div");
  root.innerHTML = html;
  const blocks = [];

  const readInlineText = (node) => {
    if (!node) return "";

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.replace(/\u00a0/g, " ") || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tagName = node.tagName.toLowerCase();

    if (tagName === "br") {
      return "\n";
    }

    if (tagName === "li") {
      return `• ${Array.from(node.childNodes).map(readInlineText).join("")}`;
    }

    return Array.from(node.childNodes).map(readInlineText).join("");
  };

  const collectBlocks = (node) => {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        blocks.push(text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const tagName = node.tagName.toLowerCase();

    if (BLOCK_TAGS.has(tagName)) {
      const text = readInlineText(node)
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

      if (text) {
        blocks.push(text);
      }
      return;
    }

    Array.from(node.childNodes).forEach(collectBlocks);
  };

  Array.from(root.childNodes).forEach(collectBlocks);

  return blocks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitIntoBlocks(text) {
  return (text || "")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .trim(),
    )
    .filter(Boolean);
}

function createSideBySideRows(lineDiff) {
  const rows = [];

  for (let index = 0; index < lineDiff.length; index += 1) {
    const part = lineDiff[index];

    if (part.removed && lineDiff[index + 1]?.added) {
      const removedBlocks = splitIntoBlocks(part.value);
      const addedBlocks = splitIntoBlocks(lineDiff[index + 1].value);
      const rowCount = Math.max(removedBlocks.length, addedBlocks.length);

      for (let blockIndex = 0; blockIndex < rowCount; blockIndex += 1) {
        rows.push({
          key: `changed-${index}-${blockIndex}`,
          type: "changed",
          left: removedBlocks[blockIndex] || "",
          right: addedBlocks[blockIndex] || "",
        });
      }

      index += 1;
      continue;
    }

    if (part.removed) {
      splitIntoBlocks(part.value).forEach((block, blockIndex) => {
        rows.push({
          key: `removed-${index}-${blockIndex}`,
          type: "removed",
          left: block,
          right: "",
        });
      });
      continue;
    }

    if (part.added) {
      splitIntoBlocks(part.value).forEach((block, blockIndex) => {
        rows.push({
          key: `added-${index}-${blockIndex}`,
          type: "added",
          left: "",
          right: block,
        });
      });
      continue;
    }

    splitIntoBlocks(part.value).forEach((block, blockIndex) => {
      rows.push({
        key: `unchanged-${index}-${blockIndex}`,
        type: "unchanged",
        left: block,
        right: block,
      });
    });
  }

  return rows;
}

function createUnifiedBlocks(wordDiff) {
  const blocks = [];
  let currentBlock = [];

  const flushBlock = () => {
    const hasContent = currentBlock.some((part) => part.value.trim());
    if (hasContent) {
      blocks.push(currentBlock);
    }
    currentBlock = [];
  };

  wordDiff.forEach((part, index) => {
    const segments = part.value.split(/(\n{2,})/);

    segments.forEach((segment, segmentIndex) => {
      if (!segment) return;

      if (/^\n{2,}$/.test(segment)) {
        flushBlock();
        return;
      }

      currentBlock.push({
        ...part,
        value: segment,
        key: `${index}-${segmentIndex}`,
      });
    });
  });

  flushBlock();
  return blocks;
}

function getVersionRole(version, isEarlier) {
  if (version?.isCurrentDraft) {
    return "Current Draft";
  }

  return isEarlier ? "Earlier Version" : "Later Version";
}

function getVersionTitle(version) {
  return version?.label?.trim() || "Untitled Version";
}

function renderParagraphs(text) {
  return splitIntoBlocks(text).map((paragraph, index) => (
    <p
      key={`paragraph-${index}`}
      className={cn("whitespace-pre-wrap break-words", index > 0 && "mt-4")}
    >
      {paragraph}
    </p>
  ));
}

export default function VersionCompareDialog({
  open,
  onOpenChange,
  version1,
  version2,
}) {
  const getIsWideLayout = () => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1280;
  };

  const [isWideLayout, setIsWideLayout] = useState(getIsWideLayout);
  const [viewMode, setViewMode] = useState(
    getIsWideLayout() ? "side-by-side" : "unified",
  );

  useEffect(() => {
    const handleResize = () => {
      const wide = getIsWideLayout();
      setIsWideLayout(wide);
      setViewMode(wide ? "side-by-side" : "unified");
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const compareText = useMemo(() => {
    if (!version1 || !version2) {
      return { text1: "", text2: "" };
    }

    return {
      text1: htmlToReadableText(version1.content_snapshot),
      text2: htmlToReadableText(version2.content_snapshot),
    };
  }, [version1, version2]);

  const lineDiff = useMemo(
    () => diffLines(compareText.text1, compareText.text2),
    [compareText],
  );

  const wordDiff = useMemo(
    () => diffWords(compareText.text1, compareText.text2),
    [compareText],
  );

  const sideBySideRows = useMemo(
    () => createSideBySideRows(lineDiff),
    [lineDiff],
  );

  const unifiedBlocks = useMemo(
    () => createUnifiedBlocks(wordDiff),
    [wordDiff],
  );

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    wordDiff.forEach((part) => {
      const words = countWords(part.value);

      if (part.added) {
        additions += words;
        return;
      }

      if (part.removed) {
        deletions += words;
        return;
      }

      unchanged += words;
    });

    const changedSections = sideBySideRows.filter(
      (row) => row.type !== "unchanged",
    ).length;

    return { additions, deletions, unchanged, changedSections };
  }, [sideBySideRows, wordDiff]);

  if (!version1 || !version2) return null;

  const earlierVersion =
    new Date(version1.created_at) < new Date(version2.created_at)
      ? version1
      : version2;
  const laterVersion = version1 === earlierVersion ? version2 : version1;
  const isCurrentDraftCompare =
    version1?.isCurrentDraft || version2?.isCurrentDraft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-[96vw] lg:max-w-6xl max-h-[92vh] gap-4 overflow-hidden p-4 sm:p-5 lg:p-6"
        data-testid="version-compare-dialog"
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="font-serif flex items-center gap-2 text-xl">
            <GitCompare className="h-5 w-5" />
            Compare Versions
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {isCurrentDraftCompare
              ? "Review how the current draft differs from the saved version."
              : "Review what changed between these two saved versions."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <VersionCard
            version={earlierVersion}
            role={getVersionRole(earlierVersion, true)}
            tone="removed"
          />
          <div className="hidden xl:flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <VersionCard
            version={laterVersion}
            role={getVersionRole(laterVersion, false)}
            tone="added"
          />
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid min-w-0 gap-2 sm:grid-cols-3 xl:w-full xl:max-w-2xl">
            <SummaryCard
              icon={Plus}
              label="Words Added"
              value={stats.additions}
              tone="added"
            />
            <SummaryCard
              icon={Minus}
              label="Words Removed"
              value={stats.deletions}
              tone="removed"
            />
            <SummaryCard
              icon={Sparkles}
              label="Changed Sections"
              value={stats.changedSections}
              helper={`${stats.unchanged} unchanged words`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1 self-start">
            <Button
              variant={viewMode === "side-by-side" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 rounded-md px-3"
              onClick={() => setViewMode("side-by-side")}
              disabled={!isWideLayout}
              data-testid="side-by-side-view-btn"
            >
              <Columns className="h-3.5 w-3.5 mr-1.5" />
              Side by Side
            </Button>
            <Button
              variant={viewMode === "unified" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 rounded-md px-3"
              onClick={() => setViewMode("unified")}
              data-testid="unified-view-btn"
            >
              <AlignJustify className="h-3.5 w-3.5 mr-1.5" />
              Unified
            </Button>
          </div>
        </div>

        <ScrollArea
          key={`${viewMode}-${version1?.id}-${version2?.id}`}
          className="h-[50vh] min-h-[320px] max-h-[560px] overflow-hidden rounded-xl border bg-muted/20"
        >
          {viewMode === "side-by-side" ? (
            <SideBySideView
              earlierVersion={earlierVersion}
              laterVersion={laterVersion}
              rows={sideBySideRows}
            />
          ) : (
            <UnifiedView blocks={unifiedBlocks} />
          )}
        </ScrollArea>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <LegendSwatch label="Removed" tone="removed" />
          <LegendSwatch label="Added" tone="added" />
          <LegendSwatch label="Unchanged" tone="unchanged" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionCard({ version, role, tone }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-4 py-3",
        tone === "added" && "border-emerald-200 bg-emerald-50/60",
        tone === "removed" && "border-rose-200 bg-rose-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge
            variant="outline"
            className={cn(
              "mb-2",
              tone === "added" &&
                "border-emerald-300 bg-emerald-100 text-emerald-800",
              tone === "removed" && "border-rose-300 bg-rose-100 text-rose-800",
            )}
          >
            {role}
          </Badge>
          <p className="truncate font-medium text-sm text-foreground">
            {getVersionTitle(version)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(version.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, helper, tone }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-background px-3 py-3",
        tone === "added" && "border-emerald-200",
        tone === "removed" && "border-rose-200",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "added" && "text-emerald-600",
            tone === "removed" && "text-rose-600",
          )}
        />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
      {helper ? (
        <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
      ) : null}
    </div>
  );
}

function LegendSwatch({ label, tone }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "h-3 w-3 rounded-full border",
          tone === "added" && "border-emerald-300 bg-emerald-100",
          tone === "removed" && "border-rose-300 bg-rose-100",
          tone === "unchanged" && "border-slate-200 bg-slate-100",
        )}
      />
      {label}
    </span>
  );
}

function SideBySideView({ earlierVersion, laterVersion, rows }) {
  return (
    <div className="min-w-0 overflow-x-hidden" data-testid="side-by-side-diff">
      <div className="sticky top-0 z-10 hidden grid-cols-2 border-b bg-background/95 shadow-sm backdrop-blur xl:grid">
        <div className="border-r px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {getVersionRole(earlierVersion, true)}
          </p>
          <p className="mt-1 text-sm font-medium">
            {getVersionTitle(earlierVersion)}
          </p>
        </div>
        <div className="px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {getVersionRole(laterVersion, false)}
          </p>
          <p className="mt-1 text-sm font-medium">
            {getVersionTitle(laterVersion)}
          </p>
        </div>
      </div>

      <div className="grid min-w-0">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "grid min-w-0 grid-cols-1 border-b xl:grid-cols-2",
              row.type === "unchanged" ? "bg-background" : "bg-muted/10",
            )}
          >
            <DiffPane
              text={row.left}
              tone={row.type === "added" ? "empty" : row.type}
              side="left"
            />
            <DiffPane
              text={row.right}
              tone={row.type === "removed" ? "empty" : row.type}
              side="right"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffPane({ text, tone, side }) {
  const isEmpty = tone === "empty" || !text;

  return (
    <div
      className={cn(
        "min-w-0 px-3 py-3 sm:px-4 sm:py-4 xl:min-h-[88px] xl:px-5",
        side === "left" && "xl:border-r",
      )}
    >
      {isEmpty ? (
        <div className="h-full rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20" />
      ) : (
        <div
          className={cn(
            "min-w-0 overflow-hidden rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-[15px] leading-6 sm:leading-7",
            tone === "changed" &&
              side === "left" &&
              "border border-rose-200 bg-rose-50/85 text-rose-950",
            tone === "changed" &&
              side === "right" &&
              "border border-emerald-200 bg-emerald-50/85 text-emerald-950",
            tone === "removed" &&
              "border border-rose-200 bg-rose-50/85 text-rose-950",
            tone === "added" &&
              "border border-emerald-200 bg-emerald-50/85 text-emerald-950",
            tone === "unchanged" &&
              "border border-transparent bg-transparent text-foreground/65",
          )}
        >
          {renderParagraphs(text)}
        </div>
      )}
    </div>
  );
}

function UnifiedView({ blocks }) {
  return (
    <div
      className="min-w-0 space-y-3 overflow-x-hidden p-3 sm:p-4 lg:p-5"
      data-testid="unified-diff"
    >
      {blocks.map((block, blockIndex) => {
        const hasChanges = block.some((part) => part.added || part.removed);

        return (
          <div
            key={`block-${blockIndex}`}
            className={cn(
              "min-w-0 overflow-hidden rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-[15px] leading-6 sm:leading-7",
              hasChanges
                ? "border bg-background shadow-sm"
                : "border border-transparent bg-transparent text-foreground/65",
            )}
          >
            {block.map((part) => (
              <span
                key={part.key}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  part.added &&
                    "rounded-md bg-emerald-100/90 px-1 text-emerald-950",
                  part.removed &&
                    "rounded-md bg-rose-100/90 px-1 text-rose-950 line-through",
                )}
              >
                {part.value}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
