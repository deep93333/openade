import { Panel, Separator } from "react-resizable-panels";
import { FileTree } from "@/components/file-tree";
import { GitChangesPanel } from "@/components/gitpanel";
import { cn } from "@agentide/ui";
import { useUIStore } from "@/store/ui";
import { PANEL_SEPARATOR_CLASS } from "./constants";

type RightPanelProps = {
  onFileSelect: (path: string) => void;
  showSeparator: boolean;
};

export function RightPanel({ onFileSelect, showSeparator }: RightPanelProps) {
  const activeView = useUIStore((s) => s.activeView);

  return (
    <>
      {showSeparator && <Separator className={PANEL_SEPARATOR_CLASS} />}
      <Panel id="right-panel" minSize={220} maxSize={360} defaultSize={260}>
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
          <div className="grid min-h-0 min-w-0 h-full w-full flex-1 grid-cols-1 grid-rows-1">
            <div
              className={cn(
                "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col overflow-hidden",
                activeView !== "files" && "invisible pointer-events-none",
                activeView === "files" && "z-[1]"
              )}
              aria-hidden={activeView !== "files"}
            >
              <FileTree className="h-full min-h-0 min-w-0" onFileSelect={onFileSelect} />
            </div>
            <div
              className={cn(
                "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col overflow-hidden",
                activeView !== "changes" && "invisible pointer-events-none",
                activeView === "changes" && "z-[1]"
              )}
              aria-hidden={activeView !== "changes"}
            >
              <GitChangesPanel className="h-full min-h-0 min-w-0" onFileSelect={onFileSelect} />
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
