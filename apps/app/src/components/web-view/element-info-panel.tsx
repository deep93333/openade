import { useCallback } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon, ClipboardIcon, XIcon } from "lucide-react";
import { useState } from "react";

export type ElementInfo = {
  tagName: string;
  id: string | null;
  classList: string[];
  selector: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes: Record<string, string>;
  styles: Record<string, string>;
  textContent: string | null;
  react: {
    component: string | null;
    props: string[] | null;
    source: {
      fileName: string;
      lineNumber: number;
      columnNumber?: number;
    } | null;
  };
};

type ElementInfoPanelProps = {
  element: ElementInfo | null;
  onClose: () => void;
  onAddToChat?: (info: ElementInfo) => void;
};

export const ElementInfoPanel = ({ element, onClose, onAddToChat }: ElementInfoPanelProps) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const generateMarkdownOutput = useCallback(() => {
    if (!element) return "";

    let output = `## Element Inspector Output\n\n`;
    output += `**Selector:** \`${element.selector}\`\n\n`;

    if (element.react.component) {
      output += `**React Component:** \`<${element.react.component} />\`\n`;
      if (element.react.source) {
        output += `**Source:** \`${element.react.source.fileName}:${element.react.source.lineNumber}\`\n`;
      }
      if (element.react.props && element.react.props.length > 0) {
        output += `**Props:** ${element.react.props.map(p => `\`${p}\``).join(", ")}\n`;
      }
      output += "\n";
    }

    output += `**Element:** \`<${element.tagName}>\`\n`;
    if (element.id) {
      output += `**ID:** \`#${element.id}\`\n`;
    }
    if (element.classList.length > 0) {
      output += `**Classes:** ${element.classList.map(c => `\`.${c}\``).join(" ")}\n`;
    }
    output += `**Dimensions:** ${element.rect.width}×${element.rect.height}px\n`;
    output += `**Position:** (${element.rect.x}, ${element.rect.y})\n`;

    if (element.textContent) {
      output += `\n**Text Content:**\n\`\`\`\n${element.textContent}\n\`\`\`\n`;
    }

    return output;
  }, [element]);

  if (!element) return null;

  const fileName = element.react.source?.fileName?.split(/[/\\]/).pop() ?? null;

  return (
    <div className="flex flex-col border-t border-border bg-background max-h-[300px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50">
        <span className="text-xs font-medium text-foreground truncate min-w-0">
          Element Inspector
          {fileName && (
            <span className="text-muted-foreground font-normal ml-1.5">
              • {fileName}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => copyToClipboard(generateMarkdownOutput(), "markdown")}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Copy as Markdown"
          >
            {copied === "markdown" ? (
              <CheckIcon className="size-3 text-green-500" />
            ) : (
              <ClipboardIcon className="size-3" />
            )}
            Copy
          </button>
          {onAddToChat && (
            <button
              type="button"
              onClick={() => onAddToChat(element)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add to Chat
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center size-6 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {element.react.component && (
          <Section title="React Component">
            <div className="space-y-1.5">
              <InfoRow
                label="Component"
                value={`<${element.react.component} />`}
                onCopy={() => copyToClipboard(element.react.component!, "component")}
                copied={copied === "component"}
                highlight
              />
              {element.react.source && (
                <InfoRow
                  label="Source"
                  value={`${element.react.source.fileName}:${element.react.source.lineNumber}`}
                  onCopy={() =>
                    copyToClipboard(
                      `${element.react.source!.fileName}:${element.react.source!.lineNumber}`,
                      "source"
                    )
                  }
                  copied={copied === "source"}
                />
              )}
              {element.react.props && element.react.props.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground shrink-0 w-16">Props</span>
                  <div className="flex flex-wrap gap-1">
                    {element.react.props.slice(0, 10).map((prop) => (
                      <span
                        key={prop}
                        className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono text-[10px]"
                      >
                        {prop}
                      </span>
                    ))}
                    {element.react.props.length > 10 && (
                      <span className="text-muted-foreground">
                        +{element.react.props.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        <Section title="Selector">
          <InfoRow
            label=""
            value={element.selector}
            onCopy={() => copyToClipboard(element.selector, "selector")}
            copied={copied === "selector"}
            mono
            fullWidth
          />
        </Section>

        <Section title="Element">
          <div className="space-y-1.5">
            <InfoRow label="Tag" value={`<${element.tagName}>`} mono />
            {element.id && (
              <InfoRow
                label="ID"
                value={`#${element.id}`}
                onCopy={() => copyToClipboard(`#${element.id}`, "id")}
                copied={copied === "id"}
                mono
              />
            )}
            {element.classList.length > 0 && (
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 w-16">Classes</span>
                <div className="flex flex-wrap gap-1">
                  {element.classList.slice(0, 8).map((cls) => (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => copyToClipboard(`.${cls}`, cls)}
                      className={cn(
                        "px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors cursor-pointer",
                        copied === cls
                          ? "bg-green-500/20 text-green-600"
                          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
                      )}
                    >
                      .{cls}
                    </button>
                  ))}
                  {element.classList.length > 8 && (
                    <span className="text-muted-foreground">+{element.classList.length - 8}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Dimensions">
          <div className="flex gap-4">
            <InfoRow label="Size" value={`${element.rect.width}×${element.rect.height}px`} />
            <InfoRow label="Position" value={`(${element.rect.x}, ${element.rect.y})`} />
          </div>
        </Section>

        {element.textContent && (
          <Section title="Text Content">
            <p className="text-foreground/80 line-clamp-2 font-mono text-[10px] bg-secondary/50 rounded p-2">
              {element.textContent}
            </p>
          </Section>
        )}

        {Object.keys(element.attributes).length > 0 && (
          <Section title="Attributes">
            <div className="space-y-1">
              {Object.entries(element.attributes)
                .filter(([key]) => key !== "class" && key !== "id" && key !== "style")
                .slice(0, 6)
                .map(([key, value]) => (
                  <div key={key} className="flex gap-2 font-mono text-[10px]">
                    <span className="text-pink-500">{key}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-amber-600 dark:text-amber-400 truncate">"{value}"</span>
                  </div>
                ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </h4>
    {children}
  </div>
);

type InfoRowProps = {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
  highlight?: boolean;
  fullWidth?: boolean;
};

const InfoRow = ({ label, value, onCopy, copied, mono, highlight, fullWidth }: InfoRowProps) => (
  <div className={cn("flex items-center gap-2", fullWidth && "flex-col items-start")}>
    {label && <span className="text-muted-foreground shrink-0 w-16">{label}</span>}
    <div
      className={cn(
        "flex items-center gap-1 min-w-0",
        fullWidth && "w-full"
      )}
    >
      <span
        className={cn(
          "truncate",
          mono && "font-mono text-[10px]",
          highlight && "text-cyan-600 dark:text-cyan-400 font-medium",
          fullWidth && "bg-secondary/50 rounded px-2 py-1 w-full"
        )}
      >
        {value}
      </span>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 p-0.5 rounded hover:bg-secondary transition-colors"
        >
          {copied ? (
            <CheckIcon className="size-3 text-green-500" />
          ) : (
            <ClipboardIcon className="size-3 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  </div>
);
