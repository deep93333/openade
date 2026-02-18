import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, ChatBubbleLineIcon, CircleXIcon } from "@agentide/ui";
import { useFileContextStore } from "@/store/file-context.store";
import { getElectronAPI } from "@/lib/electron";
import { highlightFileContent } from "@/lib/shiki-highlighter";

const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 640;

type FileViewerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string | null;
};

export const FileViewerDrawer = ({ open, onOpenChange, filePath }: FileViewerDrawerProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selection, setSelection] = useState<string>("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const codeContainerRef = useRef<HTMLElement>(null);
  const isResizing = useRef(false);
  const addContextToChat = useFileContextStore((s) => s.addContextToChat);

  const updateSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !codeContainerRef.current) {
      setSelection("");
      setSelectionRect(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (range.collapsed || !codeContainerRef.current.contains(range.commonAncestorContainer)) {
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
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection("");
    setSelectionRect(null);
  }, []);

  const getLineRange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !codeContainerRef.current) return null;
    const range = sel.getRangeAt(0);
    const lines = codeContainerRef.current.querySelectorAll(".line");
    let startLine = 1;
    let endLine = 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].contains(range.startContainer)) startLine = i + 1;
      if (lines[i].contains(range.endContainer)) { endLine = i + 1; break; }
    }
    return { startLine, endLine };
  }, []);

  const handleAddToChat = useCallback(() => {
    if (!selection.trim() || !filePath) return;
    const lineRange = getLineRange();
    addContextToChat({
      filePath,
      code: selection,
      startLine: lineRange?.startLine ?? 1,
      endLine: lineRange?.endLine ?? 1,
    });
    clearSelection();
    onOpenChange(false);
  }, [selection, filePath, addContextToChat, clearSelection, onOpenChange, getLineRange]);

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setWidth(next);
    },
    []
  );

  const stopResize = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleResize]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", stopResize);
    },
    [handleResize, stopResize]
  );

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        onOpenChange(false);
      }
    };
    if (open) document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onOpenChange, clearSelection]);

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
    if (!open || !filePath) {
      setContent(null);
      setHighlightedHtml(null);
      setError(null);
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

  useEffect(() => {
    if (!content || !filePath) {
      setHighlightedHtml(null);
      return;
    }

    let cancelled = false;
    highlightFileContent(content, filePath)
      .then((html) => {
        if (cancelled) return;
        setHighlightedHtml(html);
      })
      .catch(() => {
        if (!cancelled) setHighlightedHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [content, filePath]);

  const fileName = filePath ? filePath.split(/[/\\]/).pop() ?? filePath : "";

  if (!open) return null;

  const panel = (
    <>
      <div
        className="fixed inset-0 z-drawer bg-foreground/20"
        aria-hidden
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed right-2 top-2 z-drawer flex h-[calc(100%-16px)] flex-col overflow-hidden rounded-xl bg-background shadow-popover"
        style={{ width: `${width}px` }}
        role="dialog"
        aria-modal="true"
        aria-label="File viewer"
      >
        <div
          className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none border-l border-transparent hover:border-border hover:bg-secondary/50"
          onMouseDown={startResize}
          aria-hidden
        />
        <div className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border px-4 h-10">
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {fileName || "File"}
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <CircleXIcon className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-0">
          {loading && (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              Loading…
            </div>
          )}
          {error && (
            <div className="p-4 text-sm text-destructive">{error}</div>
          )}
          {!loading && !error && highlightedHtml && (
            <div
              ref={codeContainerRef as RefObject<HTMLDivElement>}
              className="shiki-file-viewer overflow-auto select-text"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              onMouseUp={updateSelection}
            />
          )}
          {!loading && !error && content !== null && !highlightedHtml && (
            <pre
              ref={codeContainerRef as RefObject<HTMLPreElement>}
              className="overflow-auto whitespace-pre p-4 font-mono text-sm text-foreground select-text"
              onMouseUp={updateSelection}
            >
              {content}
            </pre>
          )}
          {selection && selectionRect && (
            <div
              className="fixed z-[calc(var(--z-drawer)+1)] flex gap-1 rounded-lg bg-background p-1 shadow-popover"
              style={{
                top: selectionRect.top - 44,
                left: selectionRect.left,
              }}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddToChat}
              >
                <ChatBubbleLineIcon className="size-3.5" />
                Add to chat
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
};
