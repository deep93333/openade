import { AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./container";

type Diagnostic = {
  file: string;
  line: number;
  col: number;
  severity: "error" | "warning";
  message: string;
  source?: string;
};

function parseDiagnostics(result: unknown): Diagnostic[] {
  if (!result || typeof result !== "object") return [];
  const meta = result as Record<string, unknown>;
  if (!Array.isArray(meta.diagnostics)) return [];
  return meta.diagnostics as Diagnostic[];
}

function getDiagnosticCounts(result: unknown): { errors: number; warnings: number; tools: string[] } {
  if (!result || typeof result !== "object") return { errors: 0, warnings: 0, tools: [] };
  const meta = result as Record<string, unknown>;
  return {
    errors: typeof meta.errors === "number" ? meta.errors : 0,
    warnings: typeof meta.warnings === "number" ? meta.warnings : 0,
    tools: Array.isArray(meta.tools) ? (meta.tools as string[]) : [],
  };
}

export const LintsTool = ({ toolInput, toolResult }: ToolComponentProps) => {
  const diagnostics = parseDiagnostics(toolResult);
  const counts = getDiagnosticCounts(toolResult);
  const paths = (toolInput.paths as string[] | undefined) ?? [];
  const hasIssues = counts.errors > 0 || counts.warnings > 0;

  const grouped = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = grouped.get(d.file) ?? [];
    list.push(d);
    grouped.set(d.file, list);
  }

  return (
    <ToolContainer
      icon={
        hasIssues ? (
          <XCircle className="size-3.5 text-red-500" strokeWidth={1.5} />
        ) : (
          <CheckCircle className="size-3.5 text-emerald-500" strokeWidth={1.5} />
        )
      }
      title={
        <span className="flex items-center gap-2">
          Lints
          {paths.length > 0 && (
            <span className="text-muted-foreground font-normal">
              ({paths.length} file{paths.length > 1 ? "s" : ""})
            </span>
          )}
          {hasIssues && (
            <span className="flex items-center gap-1.5 text-muted-foreground font-normal">
              {counts.errors > 0 && (
                <span className="flex items-center gap-0.5 text-red-500">
                  <XCircle className="size-3" />
                  {counts.errors}
                </span>
              )}
              {counts.warnings > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-500">
                  <AlertTriangle className="size-3" />
                  {counts.warnings}
                </span>
              )}
            </span>
          )}
        </span>
      }
      toolInput={toolInput}
    >
      {counts.tools.length > 0 && (
        <div className="mx-2 mb-1 flex flex-wrap gap-1 px-1">
          {counts.tools.map((t) => (
            <span
              key={t}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {diagnostics.length === 0 && !hasIssues && (
        <div className="px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 mx-2 mb-2">
          No errors or warnings found.
        </div>
      )}
      {diagnostics.length > 0 && (
        <div className="mx-2 mb-2 max-h-64 overflow-auto rounded-md border border-border bg-secondary">
          {[...grouped.entries()].map(([file, diags]) => (
            <div key={file}>
              <div className="sticky top-0 border-b border-border bg-secondary px-3 py-1 text-[10px] font-medium text-muted-foreground">
                {file}
              </div>
              {diags.map((d, i) => (
                <div
                  key={`${file}-${d.line}-${d.col}-${i}`}
                  className="flex items-start gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0"
                >
                  {d.severity === "error" ? (
                    <XCircle className="mt-0.5 size-3 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-yellow-500" />
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {d.line}:{d.col}
                  </span>
                  {d.source && (
                    <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">
                      {d.source}
                    </span>
                  )}
                  <span className="text-xs text-foreground">{d.message}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </ToolContainer>
  );
};
