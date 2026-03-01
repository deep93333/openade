import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ChatBubbleLineIcon, CircleXIcon } from "@agentide/ui";
import { File } from "@pierre/diffs/react";
import { useFileContextStore } from "@/store/file-context.store";
import { getElectronAPI } from "@/lib/electron";

type FileViewerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string | null;
  className?: string;
};

type NativeSelection = {
  text: string;
  startLine: number;
  endLine: number;
  anchorY: number;
};

function getLineFromNode(node: Node): number | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return null;
  const row = el.closest("[data-line]") as HTMLElement | null;
  if (!row) return null;
  const n = parseInt(row.dataset.line ?? "", 10);
  return Number.isNaN(n) ? null : n;
}

function getShadowSelection(root: ShadowRoot | null | undefined): Selection | null {
  const fn = (root as ShadowRoot & { getSelection?: () => Selection })?.getSelection;
  if (typeof fn === "function") return fn.call(root);
  return document.getSelection();
}

function extractNativeSelection(
  container: HTMLElement,
  scrollParent: HTMLElement
): NativeSelection | null {
  const diffsEl = container.querySelector("diffs-container");
  const root = diffsEl?.shadowRoot;
  const sel = getShadowSelection(root);
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  const startLine = getLineFromNode(range.startContainer);
  const endLine = getLineFromNode(range.endContainer);
  if (startLine == null || endLine == null) return null;

  const text = sel.toString();
  if (!text.trim()) return null;

  const rangeRect = range.getBoundingClientRect();
  const parentRect = scrollParent.getBoundingClientRect();
  const anchorY = rangeRect.bottom - parentRect.top + scrollParent.scrollTop;

  return {
    text,
    startLine: Math.min(startLine, endLine),
    endLine: Math.max(startLine, endLine),
    anchorY,
  };
}

function extractLines(content: string, start: number, end: number): string {
  const lines = content.split("\n");
  const s = Math.max(0, start - 1);
  const e = Math.min(lines.length, end);
  return lines.slice(s, e).join("\n");
}

export const FileViewer = ({
  open,
  onOpenChange,
  filePath,
  className,
}: FileViewerProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<NativeSelection | null>(null);
  const [comment, setComment] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addContextToChat = useFileContextStore((s) => s.addContextToChat);

  const handleCommentChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setComment(event.target.value),
    []
  );

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const diffsEl = container.querySelector("diffs-container");
    const root = diffsEl?.shadowRoot;

    const checkAndLock = () => {
      const next = extractNativeSelection(container, container);
      if (next) {
        setSelection(next);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    };

    const onCodePointerDown = () => {
      setSelection(null);
      setComment("");
    };

    const onCodePointerUp = () => setTimeout(checkAndLock, 10);

    if (root) {
      root.addEventListener("pointerdown", onCodePointerDown);
      root.addEventListener("pointerup", onCodePointerUp);
    }

    return () => {
      if (root) {
        root.removeEventListener("pointerdown", onCodePointerDown);
        root.removeEventListener("pointerup", onCodePointerUp);
      }
    };
  }, [open, content]);

  const fileOptions = useMemo(
    () => ({
      theme: { dark: "agentide-dark" as const, light: "agentide-dark" as const },
      disableFileHeader: true,
    }),
    []
  );

  const handleAddToChat = useCallback(() => {
    if (!selection || !filePath || content === null) return;
    const code = extractLines(content, selection.startLine, selection.endLine);
    if (!code.trim()) return;
    addContextToChat({
      filePath,
      code,
      startLine: selection.startLine,
      endLine: selection.endLine,
      comment: comment.trim() || undefined,
    });
    setSelection(null);
    setComment("");
    onOpenChange(false);
  }, [selection, filePath, content, comment, addContextToChat, onOpenChange]);

  const handleClearSelection = useCallback(() => {
    setSelection(null);
    setComment("");
    const container = containerRef.current;
    if (!container) return;
    const diffsEl = container.querySelector("diffs-container");
    getShadowSelection(diffsEl?.shadowRoot)?.removeAllRanges();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAddToChat();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClearSelection();
      }
    },
    [handleAddToChat, handleClearSelection]
  );

  useEffect(() => {
    if (!open || !filePath) {
      setContent(null);
      setError(null);
      setSelection(null);
      setComment("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const api = getElectronAPI();
    if (!api) {
      setError("Electron API not available");
      setLoading(false);
      return;
    }

    api.filesystem
      .readFile(filePath)
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (!res.success || res.data === undefined) {
          setError(res.error ?? "Failed to read file");
          return;
        }
        setContent(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to read file");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, filePath]);

  const fileName = filePath ? filePath.split(/[/\\]/).pop() ?? filePath : "";

  if (!open) return null;

  const rangeLabel = selection
    ? selection.startLine === selection.endLine
      ? `Line ${selection.startLine}`
      : `Lines ${selection.startLine}–${selection.endLine}`
    : "";

  return (
    <div className={className}>
      <div className="flex h-10 flex-row items-center justify-between gap-2 border-b border-foreground/5 px-3">
        <span className="truncate font-mono text-sm font-medium text-foreground">
          {fileName || "File"}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          <CircleXIcon className="size-4" />
        </Button>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {loading && (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {error && <div className="p-4 text-sm text-destructive">{error}</div>}
        {!loading && !error && content !== null && (
          <div
            ref={containerRef}
            className="pierre-file-viewer relative min-h-0 flex-1 overflow-auto bg-secondary"
          >
            <File
              file={{ name: fileName || "File", contents: content }}
              options={fileOptions}
            />
            {selection && (
              <div
                className="absolute left-0 right-0 z-50 px-6"
                style={{ top: selection.anchorY + 4 }}
              >
                <div className="rounded-lg shadow-popover bg-secondary/95 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ChatBubbleLineIcon className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        {rangeLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleClearSelection}
                      >
                        Esc
                      </Button>
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={handleAddToChat}
                      >
                        Add to chat
                      </Button>
                    </div>
                  </div>
                  <div className="px-3 pb-2.5">
                    <textarea
                      ref={textareaRef}
                      value={comment}
                      onChange={handleCommentChange}
                      onKeyDown={handleKeyDown}
                      rows={3}
                      placeholder="Add a comment… (⌘↵ to send)"
                      className="w-full resize-none rounded-md bg-transparent px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-accent/50 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
