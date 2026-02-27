import {
  Circle,
  CheckCircle2,
  Table,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./tool-container";

type TodoItem = {
  content?: string;
  status?: string;
  activeForm?: string;
};

export const TodoWriteTool = ({ message, toolInput }: ToolComponentProps) => {
  const raw =
    toolInput.todos ??
    (Array.isArray(toolInput.value) ? toolInput.value : undefined) ??
    toolInput;
  const todos: TodoItem[] = Array.isArray(raw) ? raw : [raw].filter(Boolean);

  if (todos.length === 0) {
    return (
      <ToolContainer
        icon={<Table className="size-3.5" strokeWidth={1.5} />}
        title="TodoWrite"
        toolInput={toolInput}
      >
        <pre className="max-h-48 max-w-full overflow-auto rounded-md border border-border bg-secondary px-3 py-2 font-mono text-xs leading-relaxed text-foreground mx-2 mb-2">
          {JSON.stringify(toolInput, null, 2)}
        </pre>
      </ToolContainer>
    );
  }

  return (
    <ToolContainer
      icon={<Table className="size-3.5" strokeWidth={1.5} />}
      title="Todo"
      toolInput={toolInput}
    >
      <ul className="flex flex-col divide-y divide-foreground/10 gap-2">
        {todos.map((todo, i) => {
          const isCompleted = (todo.status ?? "pending") === "completed";
          return (
            <li
              key={i}
              className="flex flex-col gap-1 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                {isCompleted ? (
                  <CheckCircle2
                    className="size-5 shrink-0 text-emerald-700 "
                    strokeWidth={1.5}
                  />
                ) : (
                  <Circle
                    className="size-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                )}
                <span
                  className={cn(
                    "text-sm font-medium text-foreground",
                    isCompleted && "text-muted-foreground line-through"
                  )}
                >
                  {todo.content ?? todo.activeForm ?? "—"}
                </span>
              </div>
              {todo.activeForm && todo.activeForm !== todo.content && (
                <p className="text-xs pl-7 text-muted-foreground">
                  {todo.activeForm}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </ToolContainer>
  );
};
