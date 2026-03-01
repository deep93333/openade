import { useUIStore } from "@/store/ui.store";
import { Button } from "@agentide/ui";
import { IconBrowser, IconLayoutSidebar, IconLayoutSidebarRight } from "@tabler/icons-react";
import type { ReactNode } from "react";

type AppTopBarProps = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function AppTopBar({ title, left, right }: AppTopBarProps) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const webViewOpen = useUIStore((s) => s.webView.open);
  const openWebView = useUIStore((s) => s.openWebView);

  return (
    <div className="flex h-10 draggable shrink-0 items-center justify-between gap-3 border-b border-foreground/5 pl-4 pr-2 drag-region">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          aria-label={leftPanelOpen ? "Collapse left sidebar" : "Expand left sidebar"}
          className="not-draggable"
        >
          <IconLayoutSidebar stroke={1} className="h-4 w-4" />
        </Button>
        <h1 className="shrink-0 text-sm font-semibold text-foreground">{title}</h1>
        {left != null && <div className="not-draggable shrink-0">{left}</div>}
      </div>
      { <div className="not-draggable shrink-0 flex flex-row items-center gap-1">
        {right}
        <div className="flex flex-row items-center gap-1">
        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openWebView()}
                          aria-label="Open web view"
                          title="Open web view"
                          className={!webViewOpen ? "text-muted-foreground" : undefined}
                        >
                          <IconBrowser stroke={1} className="h-4 w-4" />
                        </Button>
      <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setRightPanelOpen(!rightPanelOpen)}
                          aria-label={rightPanelOpen ? "Collapse right panel" : "Expand right panel"}
                        >
                          <IconLayoutSidebarRight stroke={1} className="h-4 w-4" />
                        </Button>
                      
                        </div>
        </div>}

      </div>
  );
}
