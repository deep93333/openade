import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { proseSmallStyle } from "@agentide/ui";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

export const MarkdownMessage = memo(({ content, className }: MarkdownMessageProps) => {
  return (
    <div className={proseSmallStyle(className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
});

MarkdownMessage.displayName = "MarkdownMessage";