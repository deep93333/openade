import { useMemo, useState } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Button,
  Badge,
  cn,
} from "@openade/ui";
import { File } from "@pierre/diffs/react";
import type { ChatThread } from "@openade/shared";
import { useAgentStore } from "@/store/agent";
import { useWorkspaceStore } from "@/store/workspace";

const FILE_OPTIONS = {
  theme: { dark: "openade-dark" as const, light: "openade-dark" as const },
  disableFileHeader: true,
  disableLineNumbers: true,
};

type InfoPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ROLE_COLORS = {
  user: "blue",
  assistant: "green",
  tool: "orange",
  system: "gray",
} as const;

const ROLE_BADGE: Record<string, "blue" | "green" | "orange" | "gray"> = {
  user: "blue",
  assistant: "green",
  tool: "orange",
  system: "gray",
};

const EMPTY_THREADS: ChatThread[] = [];

export const InfoPanel = ({ open, onOpenChange }: InfoPanelProps) => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId)
  );
  const threads = useAgentStore((s) =>
    s.workspaces[activeWorkspaceId ?? ""]?.threads ?? EMPTY_THREADS
  );
  const activeThreadId = useAgentStore((s) =>
    s.workspaces[activeWorkspaceId ?? ""]?.activeThreadId ?? ""
  );
  const runtime = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "")
  );
  const selectedModel = useAgentStore((s) => s.selectedModel);
  const selectedProvider = useAgentStore((s) => s.selectedProvider);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId),
    [threads, activeThreadId]
  );

  const stats = useMemo(() => {
    if (!activeThread) return null;
    const messages = activeThread.messages;
    return {
      userCount: messages.filter((m) => m.role === "user").length,
      assistantCount: messages.filter((m) => m.role === "assistant").length,
      toolCount: messages.filter((m) => m.role === "tool").length,
      systemCount: messages.filter((m) => m.role === "system").length,
      errorCount: messages.filter(
        (m) => m.role === "tool" && (m.toolStatus === "failed" || m.toolStatus === "cancelled")
      ).length,
      totalTools: messages.filter((m) => m.role === "tool" && m.toolName).length,
    };
  }, [activeThread]);

  const toolUsage = useMemo(() => {
    if (!activeThread) return {};
    const tools: Record<string, number> = {};
    activeThread.messages
      .filter((m) => m.role === "tool" && m.toolName)
      .forEach((m) => {
        tools[m.toolName!] = (tools[m.toolName!] || 0) + 1;
      });
    return Object.entries(tools).sort((a, b) => b[1] - a[1]);
  }, [activeThread]);

  const costEstimate = useMemo(() => {
    if (!activeThread) return { input: 0, output: 0, total: 0 };
    const inputTokens = activeThread.inputTokens ?? 0;
    const outputTokens = activeThread.outputTokens ?? 0;
    // Approximate pricing for Claude Sonnet (input: $3/M, output: $15/M)
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    return {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    };
  }, [activeThread]);

  const timestamps = useMemo(() => {
    if (!activeThread) return null;
    const messages = activeThread.messages;
    const createdAt = activeThread.createdAt;
    const lastMessage = messages.length > 0 ? messages[messages.length - 1].timestamp : createdAt;
    const duration = lastMessage - createdAt;
    return { createdAt, lastMessage, duration };
  }, [activeThread]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  if (!activeThread) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Thread Info</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="text-muted-foreground text-xs">No thread selected</div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="flex flex-row items-center justify-between">
          <DrawerTitle>Thread Info</DrawerTitle>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody className="text-xs">
          <div className="space-y-4">
            {/* Thread ID */}
            <section>
              <h3 className="text-muted-foreground mb-1">Thread ID</h3>
              <Badge variant="outline" size="sm" className="font-mono">
                {activeThread.id.slice(0, 8)}...
              </Badge>
            </section>

            {/* Model & Provider */}
            <section>
              <h3 className="text-muted-foreground mb-1">Model</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" size="sm">{selectedModel || "unknown"}</Badge>
                <Badge variant="gray" size="sm">{selectedProvider}</Badge>
              </div>
            </section>

            {/* Session ID */}
            {activeThread.sdkSessionId && (
              <section>
                <h3 className="text-muted-foreground mb-1">Session</h3>
                <Badge variant="outline" size="sm" className="font-mono">
                  {activeThread.sdkSessionId.slice(0, 8)}...
                </Badge>
              </section>
            )}

            {/* Branch */}
            {workspace?.branch && (
              <section>
                <h3 className="text-muted-foreground mb-1">Branch</h3>
                <Badge variant="outline" size="sm">{workspace.branch}</Badge>
              </section>
            )}

            {/* Timestamps */}
            {timestamps && (
              <section>
                <h3 className="text-muted-foreground mb-1">Time</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-muted-foreground">Created</div>
                  <div>{formatDate(timestamps.createdAt)}</div>
                  <div className="text-muted-foreground">Last message</div>
                  <div>{formatDate(timestamps.lastMessage)}</div>
                  <div className="text-muted-foreground">Duration</div>
                  <div>{formatDuration(timestamps.duration)}</div>
                </div>
              </section>
            )}

            {/* Token Usage */}
            {stats && (
              <section>
                <h3 className="text-muted-foreground mb-1">Tokens</h3>
                <div className="grid grid-cols-3 gap-px bg-border">
                  <div className="bg-card p-2">
                    <div className="text-muted-foreground">Input</div>
                    <div className="font-mono">{(activeThread.inputTokens ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-card p-2">
                    <div className="text-muted-foreground">Output</div>
                    <div className="font-mono">{(activeThread.outputTokens ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-card p-2">
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-mono">{(activeThread.inputTokens! + activeThread.outputTokens!).toLocaleString()}</div>
                  </div>
                </div>
              </section>
            )}

            {/* Cost Estimate */}
            <section>
              <h3 className="text-muted-foreground mb-1">Cost (est.)</h3>
              <div className="grid grid-cols-3 gap-px bg-border">
                <div className="bg-card p-2">
                  <div className="text-muted-foreground">Input</div>
                  <div className="font-mono">${costEstimate.input.toFixed(4)}</div>
                </div>
                <div className="bg-card p-2">
                  <div className="text-muted-foreground">Output</div>
                  <div className="font-mono">${costEstimate.output.toFixed(4)}</div>
                </div>
                <div className="bg-card p-2">
                  <div className="text-muted-foreground">Total</div>
                  <div className="font-mono">${costEstimate.total.toFixed(4)}</div>
                </div>
              </div>
            </section>

            {/* Message Counts */}
            {stats && (
              <section>
                <h3 className="text-muted-foreground mb-1">Messages</h3>
                <div className="grid grid-cols-4 gap-px bg-border">
                  <div className="bg-card p-2">
                    <Badge variant="blue" size="sm">U</Badge>
                    <div className="font-mono mt-1">{stats.userCount}</div>
                  </div>
                  <div className="bg-card p-2">
                    <Badge variant="green" size="sm">A</Badge>
                    <div className="font-mono mt-1">{stats.assistantCount}</div>
                  </div>
                  <div className="bg-card p-2">
                    <Badge variant="orange" size="sm">T</Badge>
                    <div className="font-mono mt-1">{stats.toolCount}</div>
                  </div>
                  <div className="bg-card p-2">
                    <Badge variant="gray" size="sm">S</Badge>
                    <div className="font-mono mt-1">{stats.systemCount}</div>
                  </div>
                </div>
              </section>
            )}

            {/* Tool Usage Stats */}
            {toolUsage.length > 0 && (
              <section>
                <h3 className="text-muted-foreground mb-1">Tools ({stats?.totalTools})</h3>
                <div className="space-y-1">
                  {toolUsage.slice(0, 10).map(([tool, count]) => (
                    <div key={tool} className="flex items-center justify-between bg-card p-2 rounded">
                      <Badge variant="outline" size="sm">{tool}</Badge>
                      <span className="font-mono text-muted-foreground">{count}</span>
                    </div>
                  ))}
                  {toolUsage.length > 10 && (
                    <div className="text-muted-foreground text-center">
                      +{toolUsage.length - 10} more
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Stream / Runtime Error */}
            {runtime.error && (
              <section>
                <h3 className="text-muted-foreground mb-1">Stream Error</h3>
                <div className="rounded border border-red-500/30 bg-red-500/5 p-2">
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-red-700 max-h-32 overflow-auto">
                    {runtime.error}
                  </pre>
                </div>
              </section>
            )}

            {/* Error Count */}
            {stats && stats.errorCount > 0 && (
              <section>
                <h3 className="text-muted-foreground mb-1">Tool Errors</h3>
                <Badge variant="red" size="sm">{stats.errorCount} failed/cancelled</Badge>
              </section>
            )}

            {/* Messages JSON */}
            <section>
              <h3 className="text-muted-foreground mb-1">Messages ({activeThread.messages.length})</h3>
              <div className="space-y-2">
                {activeThread.messages.map((message, index) => (
                  <MessageJsonCard
                    key={message.id}
                    message={message}
                    index={index}
                  />
                ))}
              </div>
            </section>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};

type MessageJsonCardProps = {
  message: {
    id: string;
    role: string;
    content: string;
    timestamp: number;
    toolName?: string;
    toolStatus?: string;
  };
  index: number;
};

const MessageJsonCard = ({ message, index }: MessageJsonCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const roleBadge = ROLE_BADGE[message.role] ?? "gray";
  const roleColor = ROLE_COLORS[message.role as keyof typeof ROLE_COLORS] ?? "gray";

  const jsonString = useMemo(() => JSON.stringify(message, null, 2), [message]);

  return (
    <div className="border border-border rounded p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground">#{index + 1}</span>
          <Badge variant={roleBadge} size="sm">{message.role}</Badge>
          {message.toolName && (
            <Badge variant="outline" size="sm">{message.toolName}</Badge>
          )}
          {message.toolStatus && (
            <Badge
              variant={message.toolStatus === "completed" ? "green" : message.toolStatus === "failed" ? "red" : "yellow"}
              size="sm"
            >
              {message.toolStatus}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide" : "View"}
        </Button>
      </div>
      <div className="font-mono text-muted-foreground truncate mt-1" title={message.id}>
        {message.id}
      </div>
      {expanded && (
        <div className="mt-2 overflow-hidden rounded border border-border/50">
          <File
            file={{ name: "message.json", contents: jsonString }}
            options={FILE_OPTIONS}
          />
        </div>
      )}
    </div>
  );
};
