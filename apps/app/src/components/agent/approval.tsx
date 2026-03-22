import type { ToolApprovalRequest } from "@openade/shared";
import { Button, Input } from "@openade/ui";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAgentStore } from "@/store/agent";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/cn";

type ToolApprovalBarProps = {
  request: ToolApprovalRequest;
};

type AskQuestionOption = {
  label: string;
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
      options.push({ label: option.label });
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
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setAnswers({});
    setCustomInputs({});
    setCurrentStep(0);
  }, [request.requestId]);

  const inputDisplay =
    request.toolName === "Bash" && request.input && typeof request.input === "object" && "command" in request.input
      ? (request.input as { command: string }).command
      : typeof request.input === "string"
        ? request.input
        : JSON.stringify(request.input, null, 2);

  const isAskQuestion = !!askQuestionInput;
  const questions = askQuestionInput?.questions ?? [];
  const totalSteps = questions.length;
  const isLastStep = currentStep === totalSteps - 1;

  const currentQuestion = questions[currentStep];
  const currentSelected = answers[currentStep] ?? [];
  const currentCustom = customInputs[currentStep]?.trim() ?? "";
  const currentStepHasAnswer = currentSelected.length > 0 || currentCustom.length > 0;

  const handleSubmit = () => {
    if (!approvalWorkspaceId || !askQuestionInput || !currentStepHasAnswer) return;
    const updatedInput = {
      ...(isRecord(request.input) ? request.input : {}),
      responses: questions.map((q, i) => {
        const selected = answers[i] ?? [];
        const custom = customInputs[i]?.trim() ?? "";
        const allAnswers = q.multiSelect
          ? [...selected, ...(custom ? [custom] : [])]
          : custom ? [custom] : selected;
        return { header: q.header ?? `Question ${i + 1}`, question: q.question, answers: allAnswers };
      }),
    };
    respondToolApproval(approvalWorkspaceId, true, undefined, updatedInput);
  };

  const handleNext = () => {
    if (!currentStepHasAnswer) return;
    if (isLastStep) handleSubmit();
    else setCurrentStep((s) => s + 1);
  };

  const handleOptionClick = (questionIndex: number, label: string, multiSelect: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionIndex] ?? [];
      const next = multiSelect
        ? current.includes(label) ? current.filter((v) => v !== label) : [...current, label]
        : [label];
      return { ...prev, [questionIndex]: next };
    });
    if (!multiSelect) {
      setCustomInputs((prev) => ({ ...prev, [questionIndex]: "" }));
      if (isLastStep) {
        setTimeout(() => {
          if (label.trim()) handleSubmit();
        }, 120);
      } else {
        setTimeout(() => {
          if (label.trim()) setCurrentStep((s) => s + 1);
        }, 120);
      }
    }
  };

  return (
    <div className="w-full">
      {isAskQuestion ? (
        <>
          <div className="rounded-md bg-background overflow-hidden mx-2 my-2">
            <div className="flex items-center px-4 pt-3 pb-0">
              <span className="text-[11px] font-medium text-muted-foreground leading-none">
                {currentQuestion.header ?? `Step ${currentStep + 1}`}
              </span>
              <div className="flex-1" />
              {totalSteps > 1 && (
                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                  <button
                    type="button"
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep((s) => s - 1)}
                    className="flex items-center justify-center size-6 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-[11px] tabular-nums text-muted-foreground min-w-10 text-center">
                    {currentStep + 1} / {totalSteps}
                  </span>
                  <button
                    type="button"
                    disabled={currentStep === totalSteps - 1}
                    onClick={() => setCurrentStep((s) => s + 1)}
                    className="flex items-center justify-center size-6 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 pb-3 pt-2 text-base font-medium text-foreground">
              {currentQuestion.question}
            </div>
            <div className="flex flex-col gap-0.5 px-2 pb-2">
              {currentQuestion.options.map((option) => {
                const isSelected = currentSelected.includes(option.label);
                return (
                  <button
                    key={option.label}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                      isSelected
                        ? "bg-foreground/5 text-foreground"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    )}
                    onClick={() => handleOptionClick(currentStep, option.label, !!currentQuestion.multiSelect)}
                  >
                    <span className={cn("text-base flex-1", isSelected && "font-medium")}>{option.label}</span>
                    {isSelected && <Check className="size-5 shrink-0 text-foreground/60" strokeWidth={2.5} />}
                  </button>
                );
              })}
              <Input
                placeholder="Or type a custom answer…"
                value={customInputs[currentStep] ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomInputs((prev) => ({ ...prev, [currentStep]: value }));
                  if (!currentQuestion.multiSelect && value) {
                    setAnswers((prev) => ({ ...prev, [currentStep]: [] }));
                  }
                }}
                className="text-sm bg-transparent placeholder:text-foreground/20 h-10 mt-1 ring-offset-background focus-visible:ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent-foreground/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5 border-t border-foreground/5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => approvalWorkspaceId && respondToolApproval(approvalWorkspaceId, false, "Denied by user")}
            >
              Skip
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              variant="brand"
              disabled={!currentStepHasAnswer}
              onClick={handleNext}
            >
              {isLastStep ? "Submit" : "Next"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <pre
            className={cn(
              "max-h-32 overflow-auto rounded-lg ring-1 ring-foreground/10 bg-background/50 px-3 py-2 mx-1.5 text-xs text-foreground/70",
              "scrollbar-thin scrollbar-thumb-foreground/20"
            )}
          >
            {inputDisplay}
          </pre>
          <div className="flex items-center gap-2 px-2 py-1.5 mt-1">
            {threadLabelText && !isActiveThread && (
              <span className="text-xs text-muted-foreground truncate">
                Thread &quot;{threadLabelText}&quot; · <span className="font-medium text-foreground">{request.toolName}</span>
              </span>
            )}
            {(!threadLabelText || isActiveThread) && (
              <span className="text-xs font-medium text-foreground">{request.toolName}</span>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => approvalWorkspaceId && respondToolApproval(approvalWorkspaceId, false, "Denied by user")}
            >
              Deny
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => approvalWorkspaceId && allowToolForSession(approvalWorkspaceId, request.toolName)}
            >
              Allow for Session
            </Button>
            <Button
              type="button"
              size="sm"
              variant="brand"
              onClick={() => approvalWorkspaceId && respondToolApproval(approvalWorkspaceId, true)}
            >
              Allow
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
