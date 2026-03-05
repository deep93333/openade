import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  ChevronDownIcon,
  CopyIcon,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FolderIcon,
  RotateIcon,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
import { cn } from "@/lib/cn";

const LOG_SOURCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Agent", label: "Agent" },
] as const;

type LogSourceFilter = (typeof LOG_SOURCE_OPTIONS)[number]["value"];

type AgentLogDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function filterLogLines(content: string, source: LogSourceFilter): string {
  if (!content.trim()) return content;
  if (source === "all") return content;
  const tag = ` [${source}] `;
  return content
    .split("\n")
    .filter((line) => line.includes(tag))
    .join("\n");
}

export const AgentLogDrawer = ({ open, onOpenChange }: AgentLogDrawerProps) => {
  const [content, setContent] = useState("");
  const [logPath, setLogPath] = useState("");
  const [filter, setFilter] = useState<LogSourceFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  const scrollToBottom = useCallback(() => {
    preRef.current?.scrollTo({ top: preRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const fetchLog = useCallback(async () => {
    const api = getElectronAPI();
    if (!api?.agentLog) {
      setError("Agent log API not available");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pathRes, readRes] = await Promise.all([
        api.agentLog.getPath(),
        api.agentLog.read(),
      ]);
      if (pathRes.success && pathRes.data) setLogPath(pathRes.data);
      if (readRes.success) setContent(readRes.data ?? "");
      else setError(readRes.error ?? "Failed to read log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void fetchLog();
  }, [open, fetchLog]);

  const filteredContent = useMemo(
    () => filterLogLines(content, filter),
    [content, filter]
  );

  useEffect(() => {
    if (open && filteredContent && !loading) {
      const id = setTimeout(() => scrollToBottom(), 50);
      return () => clearTimeout(id);
    }
  }, [open, filteredContent, loading, scrollToBottom]);

  const handleCopy = useCallback(() => {
    if (!filteredContent) return;
    void navigator.clipboard.writeText(filteredContent);
  }, [filteredContent]);

  const handleOpenFolder = useCallback(async () => {
    const api = getElectronAPI();
    if (!api?.agentLog?.openFolder) return;
    await api.agentLog.openFolder();
  }, []);

  const currentFilterLabel = LOG_SOURCE_OPTIONS.find((o) => o.value === filter)?.label ?? "All";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} defaultWidth={720} defaultHeight={600} resizable swipeDirection="right">
      <DrawerContent className="max-w-4xl">
        <DrawerHeader className="border-b border-foreground/10 shrink-0">
          <DrawerTitle className="text-base font-semibold">Agent Log</DrawerTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="xs">
                  {currentFilterLabel}
                  <ChevronDownIcon className="size-3.5 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {LOG_SOURCE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => setFilter(opt.value)}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="xs" onClick={() => void fetchLog()} disabled={loading}>
              <RotateIcon className={cn("size-3.5", loading && "animate-spin")} />
              <span className="ml-1.5">Refresh</span>
            </Button>
            <Button variant="ghost" size="xs" onClick={handleCopy} disabled={!filteredContent}>
              <CopyIcon className="size-3.5" />
              <span className="ml-1.5">Copy</span>
            </Button>
            <Button variant="ghost" size="xs" onClick={() => void handleOpenFolder()}>
              <FolderIcon className="size-3.5" />
              <span className="ml-1.5">Open folder</span>
            </Button>
            <Button variant="ghost" size="xs" onClick={scrollToBottom} disabled={!filteredContent} title="Scroll to latest logs">
              <ChevronDownIcon className="size-3.5 rotate-180" />
              <span className="ml-1.5">Latest</span>
            </Button>
            {logPath && (
              <span className="text-xs text-muted-foreground truncate max-w-[240px]" title={logPath}>
                {logPath}
              </span>
            )}
            <DrawerClose className="ml-auto" />
          </div>
        </DrawerHeader>
        <DrawerBody className="min-h-0 flex flex-col p-0">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border-b border-foreground/10">
              {error}
            </div>
          )}
          <pre
            ref={preRef}
            className={cn(
              "flex-1 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap break-all",
              "bg-muted/30 text-foreground"
            )}
          >
            {filteredContent
              ? filteredContent.split("\n").map((line, i) => {
                  const isError = line.includes("[ERROR]");
                  return (
                    <span
                      key={i}
                      className={isError ? "text-destructive" : undefined}
                    >
                      {line}
                      {"\n"}
                    </span>
                  );
                })
              : loading
                ? "Loading…"
                : "(empty)"}
          </pre>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};
