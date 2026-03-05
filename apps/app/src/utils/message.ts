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

type ElementContextMention = {
  type: "element";
  tagName: string;
  id: string | null;
  classList: string[];
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
  attributes: Record<string, string>;
  styles: Record<string, string>;
  textContent: string | null;
  react: {
    component: string | null;
    props: string[] | null;
    source: { fileName: string; lineNumber: number; columnNumber?: number } | null;
  };
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

function tryParseElementContextMention(id: string): ElementContextMention | null {
  try {
    const parsed = JSON.parse(id);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      parsed.type === "element" &&
      typeof parsed.selector === "string"
    ) {
      return parsed as ElementContextMention;
    }
  } catch {
    /* not a JSON element-context mention */
  }
  return null;
}

function formatElementContextBlock(ctx: ElementContextMention): string {
  const parts: string[] = [];
  parts.push(`\n<element_context selector="${ctx.selector}">`);
  parts.push(`**Selector:** \`${ctx.selector}\``);
  parts.push(`\n**Element:** \`<${ctx.tagName}>\``);
  if (ctx.id) parts.push(`\n**ID:** \`#${ctx.id}\``);
  if (ctx.classList.length > 0) {
    parts.push(`\n**Classes:** ${ctx.classList.map((c) => `\`.${c}\``).join(" ")}`);
  }
  parts.push(`\n**Position:** (${ctx.rect.x}, ${ctx.rect.y})`);
  parts.push(`\n**Dimensions:** ${ctx.rect.width}×${ctx.rect.height}px`);
  if (ctx.react.component) {
    parts.push(`\n**React Component:** \`<${ctx.react.component} />\``);
    if (ctx.react.source) {
      parts.push(`\n**Source:** \`${ctx.react.source.fileName}:${ctx.react.source.lineNumber}\``);
    }
    if (ctx.react.props && ctx.react.props.length > 0) {
      parts.push(`\n**Props:** ${ctx.react.props.map((p) => `\`${p}\``).join(", ")}`);
    }
  }
  if (ctx.textContent) {
    parts.push(`\n**Text Content:**\n\`\`\`\n${ctx.textContent}\n\`\`\``);
  }
  if (Object.keys(ctx.attributes).length > 0) {
    parts.push(
      `\n**Attributes:** ${Object.entries(ctx.attributes)
        .filter(([k]) => !["class", "id", "style"].includes(k))
        .map(([k, v]) => `\`${k}="${v}"\``)
        .join(", ")}`
    );
  }
  if (Object.keys(ctx.styles).length > 0) {
    parts.push(
      `\n**Computed Styles:** display=${ctx.styles.display}, position=${ctx.styles.position}, font-size=${ctx.styles.fontSize}, color=${ctx.styles.color}, background=${ctx.styles.backgroundColor}`
    );
  }
  parts.push("\n</element_context>\n");
  return parts.join("");
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
        const elementCtx = tryParseElementContextMention(idAttr);
        if (elementCtx) {
          parts.push(formatElementContextBlock(elementCtx));
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
