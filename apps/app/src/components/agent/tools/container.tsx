import { useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon, BracesIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type ToolContainerProps = {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  toolInput?: Record<string, unknown>;
};

const containerClass =
  "flex flex-col gap-1.5 rounded-lg bg-background ring-1 ring-foreground/5";
const headerClass =
  "flex w-full items-center gap-2 p-2 border-b border-foreground/5 pb-2 text-xs font-medium text-foreground";

export const ToolContainer = ({
  icon,
  title,
  children,
  className,
  toolInput,
}: ToolContainerProps) => {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className={cn(containerClass, className)}>
      <div className={cn(headerClass, "justify-between")}>
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {toolInput && (
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
              showJson
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            title={showJson ? "Hide JSON" : "Show JSON"}
          >
            <BracesIcon className="size-3" />
            <span>JSON</span>
            {showJson ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
          </button>
        )}
      </div>
      {showJson && toolInput && (
        <div className="mx-2 mb-2 overflow-hidden rounded-md border border-border bg-secondary">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            <span>Tool Input JSON</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(toolInput, null, 2));
              }}
              className="hover:text-foreground transition-colors"
            >
              Copy
            </button>
          </div>
          <pre className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-foreground">
            <JsonHighlight data={toolInput} />
          </pre>
        </div>
      )}
      {children}
    </div>
  );
};

const JsonHighlight = ({ data }: { data: unknown }) => {
  const renderValue = (value: unknown, depth: number = 0): ReactNode => {
    const indent = "  ".repeat(depth);
    const nextIndent = "  ".repeat(depth + 1);

    if (value === null) {
      return <span className="text-orange-500">null</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-purple-500">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-blue-500">{value}</span>;
    }

    if (typeof value === "string") {
      const truncated = value.length > 500 ? value.slice(0, 500) + "..." : value;
      const escaped = truncated
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
      return <span className="text-emerald-600 dark:text-emerald-400">"{escaped}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-foreground">[]</span>;
      }
      return (
        <>
          <span className="text-foreground">[</span>
          {"\n"}
          {value.map((item, i) => (
            <span key={i}>
              {nextIndent}
              {renderValue(item, depth + 1)}
              {i < value.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {indent}
          <span className="text-foreground">]</span>
        </>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-foreground">{"{}"}</span>;
      }
      return (
        <>
          <span className="text-foreground">{"{"}</span>
          {"\n"}
          {entries.map(([key, val], i) => (
            <span key={key}>
              {nextIndent}
              <span className="text-pink-500 dark:text-pink-400">"{key}"</span>
              <span className="text-foreground">: </span>
              {renderValue(val, depth + 1)}
              {i < entries.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {indent}
          <span className="text-foreground">{"}"}</span>
        </>
      );
    }

    return <span className="text-muted-foreground">{String(value)}</span>;
  };

  return <>{renderValue(data)}</>;
};
