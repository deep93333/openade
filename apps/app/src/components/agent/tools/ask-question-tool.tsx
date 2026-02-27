import { MessageSquareMore, Check } from "lucide-react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./tool-container";

type QuestionInput = {
  question: string;
  header?: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
};

type QuestionResponse = {
  question: string;
  header?: string;
  answers: string[];
};

function parseQuestions(input: Record<string, unknown>): QuestionInput[] {
  if (!Array.isArray(input.questions)) return [];
  return input.questions as QuestionInput[];
}

function parseResponses(result: unknown): QuestionResponse[] {
  if (!result || typeof result !== "object") return [];
  const meta = result as Record<string, unknown>;
  if (!Array.isArray(meta.responses)) return [];
  return meta.responses as QuestionResponse[];
}

export const AskQuestionTool = ({ toolInput, toolResult }: ToolComponentProps) => {
  const questions = parseQuestions(toolInput);
  const responses = parseResponses(toolResult);
  const denied = !!(toolResult && typeof toolResult === "object" && (toolResult as Record<string, unknown>).denied === true);

  return (
    <ToolContainer
      icon={<MessageSquareMore className="size-3.5" strokeWidth={1.5} />}
      title="Question"
      toolInput={toolInput}
    >
      <div className="mx-2 mb-2 flex flex-col gap-3">
        {questions.map((q, qi) => {
          const response = responses[qi];
          const selectedAnswers = new Set(response?.answers ?? []);

          return (
            <div key={qi} className="rounded-md border border-border bg-secondary overflow-hidden">
              {q.header && (
                <div className="border-b border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {q.header}
                </div>
              )}
              <div className="px-3 py-2 text-xs font-medium text-foreground">
                {q.question}
              </div>
              <div className="flex flex-col gap-0.5 px-2 pb-2">
                {q.options.map((opt, oi) => {
                  const isSelected = selectedAnswers.has(opt.label);
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                        isSelected
                          ? "bg-accent/10 text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isSelected && <Check className="size-3 shrink-0 text-accent" />}
                      {!isSelected && <div className="size-3 shrink-0" />}
                      <div>
                        <span className={isSelected ? "font-medium" : ""}>{opt.label}</span>
                        {opt.description && (
                          <span className="ml-1.5 text-muted-foreground">{opt.description}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {denied && (
          <div className="px-3 py-2 text-xs text-red-500">
            User declined to answer.
          </div>
        )}
      </div>
    </ToolContainer>
  );
};
