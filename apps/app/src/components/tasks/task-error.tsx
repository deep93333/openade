import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Button,
} from "@openade/ui";
import { IconAlertCircle } from "@tabler/icons-react";

type TaskErrorTone = "compact" | "panel";

type TaskErrorDetails = {
  title: string;
  summary: string;
  suggestion?: string;
};

function normalizeError(error: string): string {
  return error.replace(/\s+/g, " ").trim();
}

export function getTaskErrorDetails(error: string): TaskErrorDetails {
  const raw = error.trim();
  const normalized = normalizeError(raw).toLowerCase();

  if (
    normalized.includes("incorrect api key") ||
    normalized.includes("invalid api key") ||
    normalized.includes("authentication") ||
    normalized.includes("unauthorized") ||
    normalized.includes("401") ||
    normalized.includes("api key")
  ) {
    return {
      title: "Authentication issue",
      summary: "The agent could not authenticate with the model provider.",
      suggestion: "Check the selected provider and update its API key or login session in settings.",
    };
  }

  if (
    normalized.includes("insufficient balance") ||
    normalized.includes("credit balance is too low") ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("payment") ||
    normalized.includes("402")
  ) {
    return {
      title: "Billing or quota issue",
      summary: "The provider rejected the request because credits, quota, or billing are not available.",
      suggestion: "Add credits, review billing, or switch to another provider/model and try again.",
    };
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("429")
  ) {
    return {
      title: "Rate limit reached",
      summary: "The provider is temporarily rejecting requests because too many were sent.",
      suggestion: "Wait a moment and retry, or switch to a different provider/model.",
    };
  }

  if (
    normalized.includes("context overflow") ||
    normalized.includes("context length") ||
    normalized.includes("maximum context") ||
    normalized.includes("token limit")
  ) {
    return {
      title: "Context limit reached",
      summary: "This task exceeded the model's available context window.",
      suggestion: "Trim the task input, reduce attached context, or continue with a larger-context model.",
    };
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound")
  ) {
    return {
      title: "Connection issue",
      summary: "The agent could not reach the provider or lost connection while running.",
      suggestion: "Check your internet connection and retry the task.",
    };
  }

  if (normalized.includes("process exited with code 1")) {
    return {
      title: "Agent process failed",
      summary: "The agent stopped before it could finish this task.",
      suggestion: "Open the raw details or agent log to inspect the underlying CLI or tool failure.",
    };
  }

  return {
    title: "Task run failed",
    summary: raw.split("\n")[0] || "The agent hit an unexpected error.",
    suggestion: "Retry the task. If it keeps failing, inspect the raw error details.",
  };
}

export function TaskErrorNotice({
  error,
  tone = "compact",
  actions,
}: {
  error: string;
  tone?: TaskErrorTone;
  actions?: ReactNode;
}) {
  const details = getTaskErrorDetails(error);

  return (
    <Alert className="border-none p-0 bg-tertiary rounded-lg">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="details" className="border-none">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <AccordionTrigger className="flex-1 min-w-0 py-0 hover:no-underline">
              <span className="truncate text-xs font-medium flex items-center gap-2">
                <IconAlertCircle className="size-3.5 text-foreground" />
                {details.title}</span>
            </AccordionTrigger>
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          </div>
          <AccordionContent className="px-2 pb-2 pt-0">
            <AlertDescription className="text-xs text-muted-foreground mb-2">
              {details.summary}
            </AlertDescription>
            <pre className="max-h-40 overflow-auto rounded bg-quaternary p-2 text-[11px] whitespace-pre-wrap break-words text-foreground">
              {error}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Alert>
  );
}

export function TaskErrorActions({
  error,
  onCopy,
}: {
  error: string;
  onCopy?: () => void;
}) {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(error);
        onCopy?.();
      }}
      aria-label="Copy raw error"
      title="Copy raw error"
    >
      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    </Button>
  );
}
