import { useState } from "react";
import type { AgentMessage } from "@agentide/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@agentide/ui";
import { IconEye } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

type ContextCategory = {
  name: string;
  color: string;
  bgColor: string;
  tokens: number;
  count: number;
  messages: AgentMessage[];
};

type ContextFile = {
  type: string;
  path: string;
  originalSize: number;
};

type ContextInspectorProps = {
  messages: AgentMessage[];
  systemPrompt?: string;
  contextFiles?: ContextFile[];
  activeMemory?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessageTokens(msg: AgentMessage): number {
  let tokens = estimateTokens(msg.content);
  if (msg.toolInput) {
    tokens += estimateTokens(typeof msg.toolInput === "string" ? msg.toolInput : JSON.stringify(msg.toolInput));
  }
  if (msg.toolResult) {
    tokens += estimateTokens(typeof msg.toolResult === "string" ? msg.toolResult : JSON.stringify(msg.toolResult));
  }
  return tokens;
}

function categorizeMessages(
  messages: AgentMessage[],
  systemPrompt?: string,
): ContextCategory[] {
  const categories: Record<string, ContextCategory> = {
    system: {
      name: "System Instructions",
      color: "text-purple-400",
      bgColor: "bg-purple-500",
      tokens: systemPrompt ? estimateTokens(systemPrompt) : 0,
      count: systemPrompt ? 1 : 0,
      messages: [],
    },
    user: {
      name: "User Messages",
      color: "text-blue-400",
      bgColor: "bg-blue-500",
      tokens: 0,
      count: 0,
      messages: [],
    },
    assistant: {
      name: "Assistant Messages",
      color: "text-green-400",
      bgColor: "bg-green-500",
      tokens: 0,
      count: 0,
      messages: [],
    },
    tool: {
      name: "Tool Calls & Results",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500",
      tokens: 0,
      count: 0,
      messages: [],
    },
  };

  for (const msg of messages) {
    const role = msg.role === "tool" ? "tool" : msg.role;
    if (categories[role]) {
      categories[role].tokens += estimateMessageTokens(msg);
      categories[role].count += 1;
      categories[role].messages.push(msg);
    }
  }

  return Object.values(categories).filter((c) => c.count > 0 || c.tokens > 0);
}

function TokenBar({ categories, totalTokens }: { categories: ContextCategory[]; totalTokens: number }) {
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden bg-secondary">
        {categories.map((cat) => {
          const percentage = totalTokens > 0 ? (cat.tokens / totalTokens) * 100 : 0;
          if (percentage < 0.5) return null;
          return (
            <div
              key={cat.name}
              className={cn("h-full transition-all", cat.bgColor)}
              style={{ width: `${percentage}%` }}
              title={`${cat.name}: ${cat.tokens.toLocaleString()} tokens (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {categories.map((cat) => (
          <div key={cat.name} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-sm", cat.bgColor)} />
            <span className={cat.color}>{cat.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {(cat.tokens / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageItem({ message, index }: { message: AgentMessage; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const tokens = estimateMessageTokens(message);
  const content = message.content;
  const isLong = content.length > 300;

  const roleColors: Record<string, string> = {
    user: "text-blue-400 bg-blue-500/10",
    assistant: "text-green-400 bg-green-500/10",
    tool: "text-yellow-400 bg-yellow-500/10",
    system: "text-purple-400 bg-purple-500/10",
  };

  return (
    <div className="border-b border-foreground/5 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-foreground/5 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-muted-foreground/60 tabular-nums text-xs w-6">#{index + 1}</span>
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", roleColors[message.role])}>
          {message.role === "tool" ? message.toolName ?? "tool" : message.role}
        </span>
        <span className="flex-1 truncate text-xs text-muted-foreground">
          {content.slice(0, 100)}{content.length > 100 ? "…" : ""}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {tokens.toLocaleString()} tokens
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-14">
          <div className="rounded-md bg-secondary p-3 text-xs">
            {message.role === "tool" && !!message.toolInput && (
              <div className="mb-2">
                <div className="text-yellow-400 font-medium mb-1">Input:</div>
                <pre className="whitespace-pre-wrap text-muted-foreground font-mono text-[10px] max-h-40 overflow-y-auto">
                  {typeof message.toolInput === "string" 
                    ? message.toolInput 
                    : JSON.stringify(message.toolInput, null, 2)}
                </pre>
              </div>
            )}
            <div>
              {message.role === "tool" && <div className="text-yellow-400 font-medium mb-1">Result:</div>}
              <pre className={cn(
                "whitespace-pre-wrap text-muted-foreground font-mono text-[10px]",
                isLong && !expanded ? "max-h-20 overflow-hidden" : "max-h-96 overflow-y-auto"
              )}>
                {content}
              </pre>
            </div>
            {message.role === "tool" && !!message.toolResult && (
              <div className="mt-2 pt-2 border-t border-foreground/10">
                <div className="text-yellow-400 font-medium mb-1">Metadata:</div>
                <pre className="whitespace-pre-wrap text-muted-foreground font-mono text-[10px] max-h-40 overflow-y-auto">
                  {typeof message.toolResult === "string" 
                    ? message.toolResult 
                    : JSON.stringify(message.toolResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, startIndex }: { category: ContextCategory; startIndex: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-foreground/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-3 bg-foreground/5 hover:bg-foreground/10 transition-colors"
      >
        {expanded ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className={cn("w-2.5 h-2.5 rounded-sm", category.bgColor)} />
        <span className={cn("font-medium text-sm", category.color)}>{category.name}</span>
        <span className="text-xs text-muted-foreground">{category.count} items</span>
        <span className="flex-1" />
        <span className="text-sm font-medium tabular-nums">
          {(category.tokens / 1000).toFixed(1)}k tokens
        </span>
      </button>
      {expanded && category.messages.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          {category.messages.map((msg, idx) => (
            <MessageItem key={msg.id} message={msg} index={startIndex + idx} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContextInspector({
  messages,
  systemPrompt,
  contextFiles,
  activeMemory,
  open,
  onOpenChange,
}: ContextInspectorProps) {
  const categories = categorizeMessages(messages, systemPrompt);
  const totalTokens = categories.reduce((sum, cat) => sum + cat.tokens, 0);
  const contextLimit = 200000;
  const usagePercent = (totalTokens / contextLimit) * 100;

  let messageIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b border-foreground/10 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-medium">Context Inspector</DialogTitle>
            <div className="flex items-center gap-3">
              <div className="text-sm">
                <span className="font-semibold tabular-nums">{(totalTokens / 1000).toFixed(1)}k</span>
                <span className="text-muted-foreground"> / 200k tokens</span>
              </div>
              <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <TokenBar categories={categories} totalTokens={totalTokens} />

          {contextFiles && contextFiles.length > 0 && (
            <div className="rounded-md border border-foreground/10 overflow-hidden bg-cyan-500/10">
              <div className="px-3 py-2 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
                <span className="font-medium text-sm text-cyan-400">Context Files</span>
                <span className="text-xs text-muted-foreground">{contextFiles.length} files</span>
              </div>
              <div className="px-3 pb-2 space-y-1">
                {contextFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      file.type === "tool_output" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
                    )}>
                      {file.type === "tool_output" ? "TOOL" : "HISTORY"}
                    </span>
                    <code className="text-muted-foreground truncate flex-1">{file.path}</code>
                    <span className="text-muted-foreground tabular-nums">
                      {(file.originalSize / 1024).toFixed(1)}kb
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMemory && (
            <div className="rounded-md border border-foreground/10 overflow-hidden bg-orange-500/10">
              <div className="px-3 py-2 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                <span className="font-medium text-sm text-orange-400">Active Memory</span>
                <span className="text-xs text-muted-foreground">~{estimateTokens(activeMemory)} tokens</span>
              </div>
              <div className="px-3 pb-2">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {activeMemory}
                </pre>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categories.map((category) => {
              const section = (
                <CategorySection 
                  key={category.name} 
                  category={category} 
                  startIndex={messageIndex} 
                />
              );
              messageIndex += category.messages.length;
              return section;
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ContextInspectorButton({
  messages,
  systemPrompt,
  contextFiles,
  activeMemory,
}: Omit<ContextInspectorProps, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(false);
  const totalTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0) +
    (systemPrompt ? estimateTokens(systemPrompt) : 0);

  const hasContextManagement = contextFiles && contextFiles.length > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-xs gap-1.5"
      >
        <IconEye className="size-3.5" />
        <span className="tabular-nums">{(totalTokens / 1000).toFixed(1)}k</span>
        <span className="text-muted-foreground">tokens</span>
        {hasContextManagement && (
          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-500" title="Context files active" />
        )}
      </Button>
      <ContextInspector
        messages={messages}
        systemPrompt={systemPrompt}
        contextFiles={contextFiles}
        activeMemory={activeMemory}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
