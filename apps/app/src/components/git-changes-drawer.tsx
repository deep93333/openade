import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { GitUnstagedChange, IpcResult } from "@agentide/shared";
import { MultiFileDiff } from "@pierre/diffs/react";
import { ChatBubbleLineIcon, CircleXIcon, FileIcon, Button, RotateIcon } from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
import { cn } from "@/lib/cn";
import { getFileTypeIcon } from "@/components/file-tree/file-icons";
import { useFileContextStore } from "@/store/file-context.store";

const getFileName = (path: string) => path.split(/[/\\]/).pop() ?? path;
const getDirectory = (path: string) => {
  const parts = path.split(/[/\\]/);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
};

const containsNode = (container: Element | null, node: Node | null) => {
  if (!container || !node) return false;
  if (container.contains(node)) return true;
  const root = node.getRootNode();
  if (root instanceof ShadowRoot) {
    return container.contains(root.host);
  }
  return false;
};

const findLineRangeInContent = (
  content: string | undefined,
  selection: string
): { startLine: number; endLine: number } | null => {
  if (!content || !selection) return null;
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const normalizedSelection = selection.replace(/\r\n/g, "\n").trim();
  if (!normalizedSelection) return null;
  const index = normalizedContent.indexOf(normalizedSelection);
  if (index === -1) return null;
  const startLine = normalizedContent.slice(0, index).split("\n").length;
  const lineCount = Math.max(normalizedSelection.split("\n").length, 1);
  return { startLine, endLine: startLine + lineCount - 1 };
};

const DIFF_OPTIONS = {
  theme: { dark: "agentide-dark", light: "agentide-dark" },
  diffStyle: "split" as const,
  diffIndicators: "bars" as const,
  disableFileHeader: true,
};

const FILE_LIST_WIDTH = 280;

type GitChangesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  workspaceId: string | null;
  changes: GitUnstagedChange[];
  onRevert?: () => void;
  scrollToPath?: string | null;
};

type FileDiffState = {
  oldContent: string;
  newContent: string;
  loading: boolean;
  error: string | null;
};

export const GitChangesDrawer = ({
  open,
  onOpenChange,
  workspaceId,
  changes,
  onRevert,
  scrollToPath,
  className,
}: GitChangesDrawerProps) => {
  const [diffCache, setDiffCache] = useState<Record<string, FileDiffState>>({});
  const [revertingPath, setRevertingPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [selection, setSelection] = useState("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [comment, setComment] = useState("");
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const tooltipInteractingRef = useRef(false);
  const selectionIgnoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addContextToChat = useFileContextStore((s) => s.addContextToChat);
  const selectedDiffState = selectedPath ? diffCache[selectedPath] : undefined;

  const scheduleTooltipInteractionIgnore = useCallback(() => {
    tooltipInteractingRef.current = true;
    if (selectionIgnoreTimeoutRef.current) {
      clearTimeout(selectionIgnoreTimeoutRef.current);
    }
    selectionIgnoreTimeoutRef.current = setTimeout(() => {
      tooltipInteractingRef.current = false;
      selectionIgnoreTimeoutRef.current = null;
    }, 0);
  }, []);

  const handleContainerMouseDown = useCallback(() => {
    tooltipInteractingRef.current = false;
    setSelection("");
    setSelectionRect(null);
    setComment("");
  }, []);

  const handleCommentChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setComment(event.target.value);
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection("");
    setSelectionRect(null);
    setComment("");
    tooltipInteractingRef.current = false;
    if (selectionIgnoreTimeoutRef.current) {
      clearTimeout(selectionIgnoreTimeoutRef.current);
      selectionIgnoreTimeoutRef.current = null;
    }
  }, []);

  const updateSelection = useCallback(() => {
    if (tooltipInteractingRef.current) {
      return;
    }
    const sel = window.getSelection();
    if (!sel?.rangeCount || !codeContainerRef.current) {
      setSelection("");
      setSelectionRect(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (range.collapsed || !containsNode(codeContainerRef.current, range.commonAncestorContainer)) {
      setSelection("");
      setSelectionRect(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      setSelection("");
      setSelectionRect(null);
      return;
    }
    setSelection(text);
    setSelectionRect(range.getBoundingClientRect());
  }, [codeContainerRef]);

  const computeLineRange = useCallback(() => {
    const range =
      findLineRangeInContent(selectedDiffState?.newContent, selection) ??
      findLineRangeInContent(selectedDiffState?.oldContent, selection);
    return range ?? { startLine: 1, endLine: 1 };
  }, [selection, selectedDiffState]);

  const handleAddToChat = useCallback(() => {
    if (!selection || !selectedPath) return;
    const lineRange = computeLineRange();
    const trimmedComment = comment.trim();
    addContextToChat({
      filePath: selectedPath,
      code: selection,
      startLine: lineRange.startLine,
      endLine: lineRange.endLine,
      comment: trimmedComment || undefined,
    });
    clearSelection();
  }, [selection, selectedPath, computeLineRange, comment, addContextToChat, clearSelection]);

  const fetchDiff = useCallback(
    async (path: string) => {
      const api = getElectronAPI();
      if (!api?.workspace?.getFileDiffContent || !workspaceId) return;
      setDiffCache((prev) => ({
        ...prev,
        [path]: { oldContent: "", newContent: "", loading: true, error: null },
      }));
      const result = await api.workspace.getFileDiffContent(workspaceId, path);
      setDiffCache((prev) => ({
        ...prev,
        [path]: result.success && result.data
          ? {
              oldContent: result.data.oldContent,
              newContent: result.data.newContent,
              loading: false,
              error: null,
            }
          : {
              oldContent: "",
              newContent: "",
              loading: false,
              error: result.error ?? "Failed to load diff",
            },
      }));
    },
    [workspaceId]
  );

  const handleFileClick = useCallback((path: string) => {
    setSelectedPath(path);
    fetchDiff(path);
  }, [fetchDiff]);

  const handleRevert = useCallback(
    async (path: string) => {
      const api = getElectronAPI();
      const revert = (api?.workspace as { revertFileChange?: (w: string, p: string) => Promise<IpcResult> } | undefined)?.revertFileChange;
      if (!revert || !workspaceId) return;
      setRevertingPath(path);
      const result = await revert(workspaceId, path);
      setRevertingPath(null);
      if (result.success) {
        setDiffCache((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
        if (selectedPath === path) {
          const remaining = changes.filter((c) => c.path !== path);
          setSelectedPath(remaining.length > 0 ? remaining[0].path : null);
        }
        onRevert?.();
      }
    },
    [workspaceId, onRevert, selectedPath, changes]
  );

  useEffect(() => {
    if (!open) {
      setDiffCache({});
      setSelectedPath(null);
    } else if (changes.length > 0 && !selectedPath) {
      const initialPath = scrollToPath && changes.some((c) => c.path === scrollToPath)
        ? scrollToPath
        : changes[0].path;
      setSelectedPath(initialPath);
      fetchDiff(initialPath);
    }
  }, [open, changes, selectedPath, scrollToPath, fetchDiff]);

  useEffect(() => {
    if (!open || !scrollToPath || !changes.some((c) => c.path === scrollToPath)) return;
    setSelectedPath(scrollToPath);
    fetchDiff(scrollToPath);
    requestAnimationFrame(() => {
      itemRefs.current[scrollToPath]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [open, scrollToPath, changes, fetchDiff]);

  useEffect(() => {
    if (!open) return;
    const onSelectionChange = () => updateSelection();
    document.addEventListener("mouseup", onSelectionChange);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("mouseup", onSelectionChange);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [open, updateSelection]);

  useEffect(() => {
    clearSelection();
  }, [open, selectedPath, selectedDiffState?.newContent, selectedDiffState?.oldContent, clearSelection]);

  const totalAdded = changes.reduce((sum, c) => sum + c.added, 0);
  const totalDeleted = changes.reduce((sum, c) => sum + c.deleted, 0);

  if (!open) return null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-medium text-foreground">Git changes</span>
        <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
          <CircleXIcon className="size-5" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {changes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            No changes
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
              {/* Left: Diff view */}
              <div
                ref={codeContainerRef}
                className="flex flex-1 flex-col overflow-hidden bg-background select-text"
                onMouseDown={handleContainerMouseDown}
                onTouchStart={handleContainerMouseDown}
              >
                {selectedPath ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-foreground/5 shrink-0">
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium flex-1">{selectedPath}</span>
                      <div className="flex items-center gap-1 text-xs">
                        {(() => {
                          const change = changes.find((c) => c.path === selectedPath);
                          return change ? (
                            <>
                              {change.added > 0 && (
                                <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                                  +{change.added}
                                </span>
                              )}
                              {change.deleted > 0 && (
                                <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                                  -{change.deleted}
                                </span>
                              )}
                            </>
                          ) : null;
                        })()}
                      </div>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="shrink-0 text-xs gap-1"
                        disabled={revertingPath === selectedPath}
                        onClick={() => handleRevert(selectedPath)}
                      >
                        <RotateIcon className="size-3" />
                        {revertingPath === selectedPath ? "Reverting…" : "Revert"}
                      </Button>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <FileDiffContent
                        path={selectedPath}
                        state={selectedDiffState}
                        onOpen={() => fetchDiff(selectedPath)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Select a file to view changes
                  </div>
                )}
              </div>

              {selection && selectionRect && (
                <div
                  className="fixed z-[calc(var(--z-drawer)+1)] rounded-xl bg-background/95 p-3 shadow-popover backdrop-blur-xl"
                  style={{
                    top: Math.max(8, selectionRect.top - 112),
                    left: Math.max(
                      8,
                      Math.min(
                        selectionRect.left,
                        (typeof window === "undefined" ? selectionRect.left : Math.max(window.innerWidth - 344, 8))
                      )
                    ),
                    width: "min(320px, calc(100vw - 32px))",
                  }}
                  onMouseDown={scheduleTooltipInteractionIgnore}
                  onTouchStart={scheduleTooltipInteractionIgnore}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ChatBubbleLineIcon className="size-3.5 text-foreground" />
                      <span className="text-xs font-semibold text-foreground">Add selection</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddToChat}
                      className="rounded-md border border-border/40 px-2 py-1 text-[11px] font-semibold text-foreground transition hover:border-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      Add to chat
                    </button>
                  </div>
                  <textarea
                    value={comment}
                    onChange={handleCommentChange}
                    onFocus={scheduleTooltipInteractionIgnore}
                    rows={2}
                    placeholder="Add a note (optional)"
                    className="mt-2 w-full resize-none rounded-md border border-border/40 bg-background/80 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              {/* Right: File list */}
              <div
                className="flex flex-col border-l border-foreground/5 bg-background"
                style={{ width: FILE_LIST_WIDTH, minWidth: FILE_LIST_WIDTH }}
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-foreground/5 bg-background">
                  <span className="text-sm font-medium text-foreground">Changes</span>
                  <span className="text-xs text-muted-foreground">({changes.length})</span>
                  {(totalAdded > 0 || totalDeleted > 0) && (
                    <div className="flex items-center gap-1 text-xs">
                      {totalAdded > 0 && (
                        <span className="text-green-600 dark:text-green-400">+{totalAdded}</span>
                      )}
                      {totalDeleted > 0 && (
                        <span className="text-red-600 dark:text-red-400">-{totalDeleted}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                  {changes.map((change) => {
                    const isSelected = selectedPath === change.path;
                    const fileName = getFileName(change.path);
                    return (
                      <Button
                        key={change.path}
                        ref={(el) => { itemRefs.current[change.path] = el; }}
                        type="button"
                        onClick={() => handleFileClick(change.path)}
                        className="w-full justify-start gap-2"
                        variant={isSelected ? "secondary" : "ghost"}
                      >
                        <span className="size-3.5 flex items-center justify-center shrink-0 text-muted-foreground">
                          {getFileTypeIcon(fileName)}
                        </span>
                          <span className="truncate text-xs font-medium">{fileName}</span>
                          {/* <span className="truncate text-[10px] text-muted-foreground">
                            {getDirectory(change.path) || "."}
                          </span> */}
                      
                        <div className="flex items-center gap-0.5 shrink-0">
                          {change.added > 0 && (
                            <span className="rounded bg-green-500/15 px-1 py-0.5 text-[9px] font-medium text-green-700 dark:text-green-400">
                              +{change.added}
                            </span>
                          )}
                          {change.deleted > 0 && (
                            <span className="rounded bg-red-500/15 px-1 py-0.5 text-[9px] font-medium text-red-700 dark:text-red-400">
                              -{change.deleted}
                            </span>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

type FileDiffContentProps = {
  path: string;
  state: FileDiffState | undefined;
  onOpen: () => void;
};

function FileDiffContent({ path, state, onOpen }: FileDiffContentProps) {
  const name = path.replace(/^.*[/\\]/, "");

  useEffect(() => {
    if (state === undefined) onOpen();
  }, [path, state, onOpen]);

  if (state === undefined || state.loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="px-4 py-4 text-sm text-destructive">
        {state.error}
      </div>
    );
  }

  const hasContent = state.oldContent !== "" || state.newContent !== "";
  if (!hasContent) {
    return (
      <div className="px-4 py-4 text-sm text-muted-foreground">
        No diff (binary or empty)
      </div>
    );
  }

  return (
    <MultiFileDiff
      oldFile={{ name, contents: state.oldContent }}
      newFile={{ name, contents: state.newContent }}
      options={DIFF_OPTIONS}
    />
  );
}
