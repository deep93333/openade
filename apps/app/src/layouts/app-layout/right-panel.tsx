import { Panel, Separator } from "react-resizable-panels";
import type { NavigationView } from "@/store/ui.store";
import { FileTree } from "@/components/file-tree";
import { GitChangesPanel } from "@/components/git-changes-panel";
import { Button, cn } from "@agentide/ui";
import { IconExchange, IconFiles } from "@tabler/icons-react";
import { PANEL_SEPARATOR_CLASS } from "./constants";

type RightPanelProps = {
  activeView: NavigationView;
  setActiveView: (view: NavigationView) => void;
  onFileSelect: (path: string) => void;
  showSeparator: boolean;
};

export function RightPanel({ activeView, setActiveView, onFileSelect, showSeparator }: RightPanelProps) {
  return (
    <>
      {showSeparator && <Separator className={PANEL_SEPARATOR_CLASS} />}
      <Panel id="right-panel" minSize={220} maxSize={360} defaultSize={260}>
        <div className="flex min-h-0 h-full flex-col overflow-hidden">
          <div className="flex shrink-0 items-center border-b px-2 border-foreground/5 h-12 drag-region gap-1">
            <Button
              variant={activeView === "files" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("files")}
            >
              <IconFiles className="size-4" stroke={1} />
              Files
            </Button>
            <Button
              variant={activeView === "changes" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveView("changes")}
            >
              <IconExchange className="size-4" stroke={1} />
              Changes
            </Button>
          </div>
          <div
            className={cn("mt-0 min-h-0 flex-1 overflow-hidden", activeView !== "files" && "hidden")}
          >
            <FileTree className="h-full" onFileSelect={onFileSelect} />
          </div>
          <div
            className={cn("mt-0 min-h-0 flex-1 overflow-hidden", activeView !== "changes" && "hidden")}
          >
            <GitChangesPanel className="h-full min-h-0" onFileSelect={onFileSelect} />
          </div>
        </div>
      </Panel>
    </>
  );
}
