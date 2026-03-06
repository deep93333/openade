import { CodeIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { FileName, basename } from "@/components/primitives";

type NormalizedPart =
  | { type: "text"; value: string }
  | { type: "mention"; label: string; id: string; mentionType?: "element" };

function unescapeHtml(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function normalizeUserContent(content: string): NormalizedPart[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const unescaped = unescapeHtml(trimmed);
  const looksLikeHtml = /<[^>]+>/.test(unescaped);
  if (looksLikeHtml) {
    try {
      const doc = new DOMParser().parseFromString(unescaped, "text/html");
      const parts: NormalizedPart[] = [];
      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          parts.push({ type: "text", value: node.textContent });
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;
        if (el.getAttribute?.("data-type") === "mention") {
          const id = el.getAttribute("data-id") ?? "";
          const labelAttr = el.getAttribute("data-label");
          let mentionType: "element" | undefined =
            el.getAttribute("data-mention-type") === "element" ? "element" : undefined;
          if (!mentionType && id) {
            try {
              const parsed = JSON.parse(id);
              if (parsed?.type === "element") mentionType = "element";
            } catch {
              /* not element */
            }
          }
          const label = (labelAttr ?? ((el.textContent?.trim() || id) || "@")).trim();
          const displayLabel =
            mentionType === "element" ? label : label.startsWith("@") ? label : `@${label}`;
          parts.push({
            type: "mention",
            label: displayLabel,
            id,
            ...(mentionType && { mentionType }),
          });
          return;
        }
        for (const child of el.childNodes) walk(child);
      };
      walk(doc.body);
      if (parts.length > 0) return parts;
      const stripped = unescaped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return [{ type: "text", value: stripped || trimmed }];
    } catch {
      const stripped = unescaped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return [{ type: "text", value: stripped || trimmed }];
    }
  }
  const mentionRe = /(@[\w./-]+)/g;
  const segments = trimmed.split(mentionRe);
  if (segments.length <= 1) return [{ type: "text", value: trimmed }];
  return segments.map((seg) =>
    /^@[\w./-]+$/.test(seg)
      ? { type: "mention" as const, label: seg.startsWith("@") ? seg : `@${seg}`, id: seg }
      : { type: "text" as const, value: seg }
  );
}

type MentionChipProps = {
  label: string;
  id?: string;
  mentionType?: "element";
  className?: string;
};

function looksLikeFilePath(label: string, id: string): boolean {
  const raw = label.startsWith("@") ? label.slice(1) : label;
  return raw.includes("/") || raw.includes(".") || id.includes("/");
}

export function MentionChip({ label, id = "", mentionType, className }: MentionChipProps) {
  const chipClass = cn(
    "inline-flex items-center gap-0.5 rounded shadow-card bg-quaternary px-1 py-0.2 text-muted-foreground font-medium align-baseline",
    className
  );

  if (mentionType === "element") {
    return (
      <span data-type="mention" className={chipClass}>
        <CodeIcon className="size-3 shrink-0 opacity-70" />
        <span className="truncate max-w-[180px] text-foreground! text-xxs">{label}</span>
      </span>
    );
  }

  const rawLabel = label.startsWith("@") ? label.slice(1) : label;

  if (looksLikeFilePath(label, id)) {
    const name = basename(rawLabel) || rawLabel;
    return (
      <span data-type="mention" className={chipClass}>
        <FileName
          path={rawLabel}
          type="file"
          nameClassName="text-foreground! font-medium text-xxs"
          className="gap-0.5 text-foreground!"
        />
        {name !== rawLabel && (
          <span className="sr-only">{rawLabel}</span>
        )}
      </span>
    );
  }

  return (
    <span data-type="mention" className={chipClass}>
      {label.startsWith("@") ? label : `@${label}`}
    </span>
  );
}

export function UserMessagePreview({ content, className }: { content: string; className?: string }) {
  const parts = normalizeUserContent(content);
  if (parts.length === 1 && parts[0].type === "text") {
    return <span className={cn("whitespace-pre-wrap wrap-break-word", className)}>{parts[0].value}</span>;
  }
  return (
    <span className={cn("whitespace-pre-wrap wrap-break-word", className)}>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <MentionChip key={i} label={p.label} id={p.id} mentionType={p.mentionType} className="align-baseline" />
        )
      )}
    </span>
  );
}
