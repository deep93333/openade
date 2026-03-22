import { useState } from "react";
import { motion } from "framer-motion";
import type { AgentMessage } from "@openade/shared";
import {
  File,
  Folder,
  Search,
  Terminal,
  Table,
  MessageSquareMore,
  CheckCircle,
  GitBranch,
  FileText,
  ChevronRightIcon,
  type LucideIcon,
} from "lucide-react";
import { InlineToolRow } from "./inline";
import { getToolTitleParts, getToolGroupKey, normalizeToolName } from "./labels";
import { getToolComponent } from "./registry";
import { GenericTool } from "./generic";

const toolIconMap: Record<string, LucideIcon> = {
  read: File,
  write: FileText,
  edit: File,
  multiedit: File,
  delete: File,
  glob: Search,
  grep: Search,
  search: Search,
  ripgrep: Search,
  websearch: Search,
  webfetch: Search,
  bash: Terminal,
  ls: Folder,
  listdir: Folder,
  todowrite: Table,
  todo_write: Table,
  ask_question: MessageSquareMore,
  readlints: CheckCircle,
  lints: CheckCircle,
  str_replace_editor: FileText,
  texteditor: FileText,
  text_editor: FileText,
  diff: GitBranch,
  applydiff: GitBranch,
  applypatch: GitBranch,
  "file.read": File,
  "file.edit": File,
  "file.glob": Search,
};

const getToolIcon = (toolName: string) => {
  const name = normalizeToolName(toolName);
  const Icon = toolIconMap[name] ?? File;
  return <Icon className="size-4" strokeWidth={1.5} />;
};

const parseToolInput = (input: unknown): Record<string, unknown> => {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object") return parsed;
    } catch { /* not json */ }
    return { command: input };
  }
  return { value: input };
};

function parseToolResult(result: unknown, content?: string): unknown {
  const parsed = (() => {
    if (result === undefined || result === null) return undefined;
    if (typeof result === "object" && !Array.isArray(result)) return result;
    if (typeof result === "string") {
      try { return JSON.parse(result); } catch { return result; }
    }
    return result;
  })();

  const hasContent = typeof content === "string" && content.trim().length > 0;
  if (!hasContent) return parsed;

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return { ...(parsed as Record<string, unknown>), content };
  }
  return { content };
}

type ToolCallGroupProps = {
  messages: AgentMessage[];
};

const SingleToolCall = ({ message, index, total }: { message: AgentMessage; index: number; total: number }) => {
  const toolName = message.toolName ?? "";
  const toolInput = parseToolInput(message.toolInput);
  const content = typeof message.content === "string" ? message.content : "";
  const toolResult = parseToolResult(message.toolResult, content);
  const isActive = message.toolStatus === "running" || message.toolStatus === "pending";
  const { label, target } = getToolTitleParts(toolName, toolInput, isActive);

  const ToolDetail = getToolComponent(toolName) ?? GenericTool;
  const hasContent = content.trim().length > 0;
  const hasResult = message.toolResult !== undefined && message.toolResult !== null;
  const hasInput = Object.keys(toolInput).length > 0;
  const hasDetails = hasContent || hasResult || hasInput;

  const normName = normalizeToolName(toolName);
  const isEditOrMultiedit = normName === "edit" || normName === "multiedit";
  const alwaysShowBody =
    normName === "edit" ||
    normName === "multiedit" ||
    normName === "write" ||
    normName === "diff" ||
    normName === "applydiff" ||
    normName === "applypatch";
  const showRawContent = hasContent && !isEditOrMultiedit;
  const detailContent = showRawContent ? (
    <pre className="max-h-64 overflow-auto rounded border border-border bg-secondary px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
      {content}
    </pre>
  ) : (
    <ToolDetail message={message} toolInput={toolInput} toolResult={toolResult} />
  );

  const isCompleted =
    message.toolStatus === "completed" ||
    (message.toolResult !== undefined && message.toolResult !== null) ||
    content.trim().length > 0;

  const labelText = target ? `${label} ${target}` : label;

  return (
    <InlineToolRow
      icon={<></>}
      label={
        <span className="truncate text-sm">
          <span className="font-medium text-muted-foreground">{label}</span>
          {target && (
            <span className="ml-1 font-medium text-foreground">{target}</span>
          )}
        </span>
      }
      labelText={labelText}
      hasDetails={hasDetails}
      alwaysShowBody={alwaysShowBody}
      isCompleted={isCompleted}
      isRunning={isActive}
      isFirst={index === 0}
      isLast={index === total - 1}
    >
      {detailContent}
    </InlineToolRow>
  );
};

export const ToolCallGroup = ({ messages }: ToolCallGroupProps) => {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  if (messages.length === 1) {
    return (
      <motion.div
        className="px-4 py-0.5"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <SingleToolCall message={messages[0]} index={0} total={1} />
      </motion.div>
    );
  }

  const groupKey = getToolGroupKey(messages[0].toolName);
  const allCompleted = messages.every(
    (m) => m.toolStatus === "completed" || m.toolResult !== undefined,
  );
  const runningCount = messages.filter(
    (m) => m.toolStatus === "running" || (m.toolStatus === "pending" && m.toolResult === undefined),
  ).length;

  const groupLabel = getGroupSummary(groupKey, messages, allCompleted, runningCount);

  if (!allCompleted || expanded) {
    return (
      <motion.div
        className="px-4 py-0.5 flex flex-col gap-2 my-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {allCompleted && (
          <motion.button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
          >
            <span className="text-sm font-medium">{groupLabel}</span>
            <ChevronRightIcon className="size-3 rotate-90 text-muted-foreground/50" />
          </motion.button>
        )}
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.2, ease: "easeOut" }}
          >
            <SingleToolCall message={msg} index={idx} total={messages.length} />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="px-4 py-0.5 my-2"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-sm font-medium">{groupLabel}</span>
        <ChevronRightIcon className="size-3 text-muted-foreground/50" />
      </button>
    </motion.div>
  );
};

function getGroupSummary(
  groupKey: string,
  messages: AgentMessage[],
  allCompleted: boolean,
  runningCount: number,
): string {
  const count = messages.length;
  const verb = allCompleted ? "past" : "present";

  switch (groupKey) {
    case "file-read":
      return verb === "past" ? `Read ${count} files` : `Reading ${count - runningCount}/${count} files`;
    case "file-write":
      return verb === "past" ? `Wrote ${count} files` : `Writing files...`;
    case "file-edit":
      return verb === "past" ? `Edited ${count} files` : `Editing files...`;
    case "search":
      return verb === "past" ? `${count} searches` : `Searching...`;
    case "bash":
      return verb === "past" ? `Ran ${count} commands` : `Running commands...`;
    case "todo":
      return verb === "past" ? `Updated todos` : `Updating todos...`;
    case "lint":
      return verb === "past" ? `Checked lints` : `Checking lints...`;
    default:
      return verb === "past" ? `${count} tool calls` : `Running ${count} tools...`;
  }
}
