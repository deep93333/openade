import type { ToolApprovalRequest } from "@agentide/shared";
import { Button } from "@agentide/ui";
import { useEffect, useMemo, useState } from "react";
import { useAgentStore } from "@/store/agent.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { cn } from "@/lib/cn";

type ToolApprovalBarProps = {
  request: ToolApprovalRequest;
};

type AskQuestionOption = {
  label: string;
  description?: string;
};

type AskQuestionItem = {
  question: string;
  header?: string;
  options: AskQuestionOption[];
  multiSelect?: boolean;
};

type AskQuestionInput = {
  questions: AskQuestionItem[];
};

function threadLabel(thread: { messages: { role: string; content: string }[] }): string {
  const first = thread.messages.find((m) => m.role === "user");
  if (first?.content) {
    const text = first.content.trim().replace(/\s+/g, " ");
    return text.length > 16 ? `${text.slice(0, 16)}…` : text;
  }
  return "New chat";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAskQuestionInput(input: unknown): AskQuestionInput | null {
  if (!isRecord(input) || !Array.isArray(input.questions)) return null;
  const questions: AskQuestionItem[] = [];

  for (const item of input.questions) {
    if (!isRecord(item) || typeof item.question !== "string" || !Array.isArray(item.options)) {
      return null;
    }

    const options: AskQuestionOption[] = [];
    for (const option of item.options) {
      if (!isRecord(option) || typeof option.label !== "string") return null;
      options.push({
        label: option.label,
        description: typeof option.description === "string" ? option.description : undefined,
      });
    }

    questions.push({
      question: item.question,
      header: typeof item.header === "string" ? item.header : undefined,
      options,
      multiSelect: item.multiSelect === true,
    });
  }

  return { questions };
}

export const ToolApprovalBar = ({ request }: ToolApprovalBarProps) => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const approvalWorkspaceId = request.workspaceId ?? activeWorkspaceId;
  const respondToolApproval = useAgentStore((s) => s.respondToolApproval);
  const allowToolForSession = useAgentStore((s) => s.allowToolForSession);
  const workspaceState = useAgentStore((s) =>
    approvalWorkspaceId ? s.getWorkspaceState(approvalWorkspaceId) : null
  );
  const sessionToThread = workspaceState?.sessionToThread ?? {};
  const threads = workspaceState?.threads ?? [];
  const activeThreadId = workspaceState?.activeThreadId ?? "";

  const threadId = request.sessionId ? sessionToThread[request.sessionId] : null;
  const thread = threadId ? threads.find((t) => t.id === threadId) : null;
  const threadLabelText = thread ? threadLabel(thread) : null;
  const isActiveThread = threadId === activeThreadId;
  const askQuestionInput = useMemo(() => parseAskQuestionInput(request.input), [request.input]);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});

  useEffect(() => {
    setAnswers({});
  }, [request.requestId]);

  const inputDisplay =
    request.toolName === "Bash" && request.input && typeof request.input === "object" && "command" in request.input
      ? (request.input as { command: string }).command
      : typeof request.input === "string"
        ? request.input
        : JSON.stringify(request.input, null, 2);

  return (
    <div className="p-1.5 w-full">
      <div className="flex mb-3 items-center gap-2 pl-2">
        <span className="text-sm font-medium text-foreground/80">
          {threadLabelText && !isActiveThread ? (
            <>Thread &quot;{threadLabelText}&quot; wants to run </>
          ) : null}
          <span className="font-semibold text-foreground">{request.toolName}</span>
        </span>

        <div className="flex-1" />

        <div className="flex justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => approvalWorkspaceId && respondToolApproval(approvalWorkspaceId, false, "Denied by user")}
          >
            Deny
          </Button>
          {!askQuestionInput && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => approvalWorkspaceId && allowToolForSession(approvalWorkspaceId, request.toolName)}
            >
              Allow for Session
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="brand"
            disabled={
              !!askQuestionInput &&
              askQuestionInput.questions.some((question, index) => {
                const selected = answers[index] ?? [];
                return question.multiSelect ? selected.length === 0 : selected.length !== 1;
              })
            }
            onClick={() => {
              if (!approvalWorkspaceId) return;
              if (!askQuestionInput) {
                respondToolApproval(approvalWorkspaceId, true);
                return;
              }

              const updatedInput = {
                ...(isRecord(request.input) ? request.input : {}),
                responses: askQuestionInput.questions.map((question, index) => ({
                  header: question.header ?? `Question ${index + 1}`,
                  question: question.question,
                  answers: answers[index] ?? [],
                })),
              };
              respondToolApproval(approvalWorkspaceId, true, undefined, updatedInput);
            }}
          >
            Allow
          </Button>
        </div>
      </div>

      {askQuestionInput ? (
        <div
          className={cn(
            "max-h-40 overflow-auto rounded-lg ring-1 ring-foreground/10 bg-background/50 px-2 py-2",
            "scrollbar-thin scrollbar-thumb-foreground/20"
          )}
        >
          <div className="flex flex-col gap-2">
            {askQuestionInput.questions.map((question, questionIndex) => {
              const selected = answers[questionIndex] ?? [];
              return (
                <div key={`${question.question}-${questionIndex}`} className="rounded-md border border-foreground/10 bg-background/80">
                  <div className="px-3 py-2 border-b border-foreground/10">
                    <div className="text-xs font-semibold text-foreground/80">
                      {question.header ?? `Question ${questionIndex + 1}`}
                    </div>
                    <div className="text-xs text-foreground/70">{question.question}</div>
                  </div>
                  <div className="p-2 grid gap-1.5">
                    {question.options.map((option) => {
                      const isSelected = selected.includes(option.label);
                      return (
                        <button
                          key={option.label}
                          type="button"
                          className={cn(
                            "w-full rounded-md border px-2 py-1.5 text-left transition-colors",
                            isSelected
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-foreground/10 bg-background/70 text-foreground/80 hover:bg-background"
                          )}
                          onClick={() => {
                            setAnswers((prev) => {
                              const current = prev[questionIndex] ?? [];
                              const next = question.multiSelect
                                ? current.includes(option.label)
                                  ? current.filter((value) => value !== option.label)
                                  : [...current, option.label]
                                : [option.label];
                              return { ...prev, [questionIndex]: next };
                            });
                          }}
                        >
                          <div className="text-xs font-medium">{option.label}</div>
                          {option.description && (
                            <div className="text-[11px] text-foreground/60 mt-0.5">{option.description}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <pre
          className={cn(
            "max-h-32 overflow-auto rounded-lg ring-1 ring-foreground/10 bg-background/50 px-3 py-2 text-xs text-foreground/70",
            "scrollbar-thin scrollbar-thumb-foreground/20"
          )}
        >
          {inputDisplay}
        </pre>
      )}
    </div>
  );
};
