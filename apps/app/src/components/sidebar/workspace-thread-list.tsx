import { AccordionContent } from "@agentide/ui";
import { useWorkspaceItemContext } from "./workspace-item-context";
import { WorkspaceThreadRow } from "./workspace-thread-row";

export function WorkspaceThreadList() {
  const { state } = useWorkspaceItemContext();
  const { isActive, threads } = state;

  if (!isActive || threads.length === 0) {
    return (
      <AccordionContent className="pb-2">
        <div className="flex flex-col gap-0.5" />
      </AccordionContent>
    );
  }

  return (
    <AccordionContent className="pb-2">
      <div className="flex flex-col gap-0.5">
        {threads.map((thread) => (
          <WorkspaceThreadRow key={thread.id} thread={thread} />
        ))}
      </div>
    </AccordionContent>
  );
}
