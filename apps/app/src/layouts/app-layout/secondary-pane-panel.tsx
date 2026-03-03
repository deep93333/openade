import { Panel, Separator } from "react-resizable-panels";
import type { SecondaryPaneMode } from "@/store/ui.store";
import { FileViewer } from "@/components/file-viewer";
import { DiffViewer } from "@/components/diff-viewer";
import { cn } from "@agentide/ui";
import { CARD_CLASS, PANEL_SEPARATOR_CLASS } from "./constants";

type SecondaryPanePanelProps = {
  secondaryPane: { open: boolean; mode: SecondaryPaneMode; path: string | null; staged?: boolean };
  onOpenChange: (open: boolean) => void;
};

export function SecondaryPanePanel({ secondaryPane, onOpenChange }: SecondaryPanePanelProps) {
  return (
    <>
      <Separator className={cn(PANEL_SEPARATOR_CLASS, "px-0.5")} />
      <Panel id="secondary" minSize={380} maxSize="60%" defaultSize={520}>
        <div className={cn("my-2 p-px h-[calc(100%-1rem)] overflow-hidden", CARD_CLASS)}>
          {secondaryPane.mode === "file" ? (
            <FileViewer
              open={secondaryPane.open}
              onOpenChange={onOpenChange}
              filePath={secondaryPane.path}
              className="flex h-full min-h-0 flex-col"
            />
          ) : (
            <DiffViewer
              open={secondaryPane.open}
              onOpenChange={onOpenChange}
              filePath={secondaryPane.path}
              staged={secondaryPane.staged}
              className="flex h-full min-h-0 flex-col"
            />
          )}
        </div>
      </Panel>
    </>
  );
}
