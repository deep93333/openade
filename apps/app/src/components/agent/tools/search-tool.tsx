import { SearchIcon } from "@agentide/ui";
import type { ToolComponentProps } from "./types";

export const SearchTool = ({ toolInput }: ToolComponentProps) => {
  const query = (toolInput.query ?? toolInput.pattern ?? toolInput.search_term ?? "") as string;
  const path = (toolInput.path ?? toolInput.directory ?? "") as string;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-background p-2 ring-1 ring-foreground/10">
      <p className="flex w-full items-center gap-2 border-b border-foreground/10 pb-2 text-xs font-medium text-muted-foreground">
        <SearchIcon className="size-3.5" />
        Search
      </p>
      <div className="overflow-hidden rounded-md border border-border bg-secondary">
        <div className="flex items-center gap-2 px-3 py-2">
          <SearchIcon className="size-3 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">{query}</span>
        </div>
        {path && (
          <div className="border-t border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
            in {path}
          </div>
        )}
      </div>
    </div>
  );
};
