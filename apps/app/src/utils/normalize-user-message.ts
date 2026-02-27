function unescapeHtml(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

type FileContextMention = {
  filePath: string;
  code: string;
  startLine: number;
  endLine: number;
  comment?: string;
};

function tryParseFileContextMention(id: string): FileContextMention | null {
  try {
    const parsed = JSON.parse(id);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.filePath === "string" &&
      typeof parsed.code === "string"
    ) {
      return parsed as FileContextMention;
    }
  } catch {
    /* not a JSON file-context mention */
  }
  return null;
}

function formatFileContextBlock(ctx: FileContextMention): string {
  const lineRange =
    ctx.startLine === ctx.endLine
      ? `L${ctx.startLine}`
      : `L${ctx.startLine}-${ctx.endLine}`;
  const parts = [`\n<file_context path="${ctx.filePath}" lines="${lineRange}">`];
  parts.push("```");
  parts.push(ctx.code);
  parts.push("```");
  if (ctx.comment) {
    parts.push(`Note: ${ctx.comment}`);
  }
  parts.push("</file_context>\n");
  return parts.join("\n");
}

export function normalizeUserMessageContentToText(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  const unescaped = unescapeHtml(trimmed);
  const looksLikeHtml = /<[^>]+>/.test(unescaped) && /data-type\s*=\s*["']mention["']/.test(unescaped);
  if (!looksLikeHtml) return trimmed;
  try {
    const doc = new DOMParser().parseFromString(unescaped, "text/html");
    const parts: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        parts.push(node.textContent);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (el.getAttribute?.("data-type") === "mention") {
        const idAttr = el.getAttribute("data-id") ?? "";
        const fileCtx = tryParseFileContextMention(idAttr);
        if (fileCtx) {
          parts.push(formatFileContextBlock(fileCtx));
          return;
        }
        const labelAttr = el.getAttribute("data-label");
        const raw = labelAttr || el.textContent?.trim() || idAttr || "@";
        const label = raw.trim();
        parts.push(label.startsWith("@") ? label : `@${label}`);
        return;
      }
      for (const child of el.childNodes) walk(child);
    };
    walk(doc.body);
    if (parts.length === 0) {
      return unescaped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || trimmed;
    }
    return parts.join("");
  } catch {
    return unescaped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || trimmed;
  }
}
