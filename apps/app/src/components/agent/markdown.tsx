import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { File } from "@pierre/diffs/react";
import { proseSmallStyle } from "@agentide/ui";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

const FILE_OPTIONS = {
  theme: { dark: "agentide-dark" as const, light: "agentide-dark" as const },
  disableFileHeader: true,
  disableLineNumbers: true,
};

function langToFilename(lang: string | undefined): string {
  if (!lang) return "code.txt";
  return `code.${lang}`;
}

type CodeBlockProps = {
  className?: string;
  children?: React.ReactNode;
};

const CodeBlock = memo(({ className, children }: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className ?? "");
  const lang = match?.[1];
  const code = String(children ?? "").replace(/\n$/, "");

  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-zinc-800 dark:border-zinc-700/50">
      <File
        file={{ name: langToFilename(lang), contents: code }}
        options={FILE_OPTIONS}
      />
    </div>
  );
});

CodeBlock.displayName = "CodeBlock";

export const MarkdownMessage = memo(({ content, className }: MarkdownMessageProps) => {
  return (
    <div className={proseSmallStyle(className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isFenced =
              codeClassName?.startsWith("language-") ||
              (typeof children === "string" && children.includes("\n"));
            if (isFenced) {
              return (
                <CodeBlock className={codeClassName}>{children}</CodeBlock>
              );
            }
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownMessage.displayName = "MarkdownMessage";
