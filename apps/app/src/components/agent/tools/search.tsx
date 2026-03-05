import { Search } from "lucide-react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./container";

export const SearchTool = ({ toolInput }: ToolComponentProps) => {
  const query = (toolInput.query ??
    toolInput.pattern ??
    toolInput.search_term ??
    "") as string;
  const path = (toolInput.path ?? toolInput.directory ?? "") as string;

  return (
    <ToolContainer
      icon={<Search className="size-3.5" strokeWidth={1.5} />}
      title="Search"
      toolInput={toolInput}
    >
      <div className="overflow-hidden rounded-md border border-border bg-secondary mx-2 mb-2">
        <div className="flex items-center gap-2 px-3 py-2">
          <Search className="size-3 text-muted-foreground" strokeWidth={1.5} />
          <span className="font-mono text-xs text-foreground">{query}</span>
        </div>
        {path && (
          <div className="border-t border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
            in {path}
          </div>
        )}
      </div>
    </ToolContainer>
  );
};
