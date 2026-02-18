import { createHighlighter, type Highlighter } from "shiki";
import pierreLight from "./themes/pierre-light.json";

const THEME = "pierre-light";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [pierreLight as Parameters<typeof createHighlighter>[0]["themes"][number]],
      langs: [
        "typescript",
        "tsx",
        "javascript",
        "jsx",
        "json",
        "css",
        "scss",
        "html",
        "markdown",
        "mdx",
        "python",
        "bash",
        "yaml",
        "xml",
        "sql",
        "go",
        "rust",
        "ruby",
        "java",
        "kotlin",
        "swift",
        "c",
        "cpp",
        "vue",
        "svelte",
      ],
    });
  }
  return highlighterPromise;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  mdx: "mdx",
  py: "python",
  sh: "bash",
  bash: "bash",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  sql: "sql",
  go: "go",
  rs: "rust",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  vue: "vue",
  svelte: "svelte",
};

export function getLangFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "plaintext";
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter();

  const loadedLangs = highlighter.getLoadedLanguages();
  if (!loadedLangs.includes(lang as never)) {
    try {
      await highlighter.loadLanguage(lang as Parameters<Highlighter["loadLanguage"]>[0]);
    } catch {
      lang = "plaintext";
    }
  }

  return highlighter.codeToHtml(code, { lang, theme: THEME });
}

export async function highlightFileContent(
  content: string,
  filePath: string
): Promise<string> {
  const lang = getLangFromPath(filePath);
  return highlightCode(content, lang);
}
