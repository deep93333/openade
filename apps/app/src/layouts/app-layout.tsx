import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { AgentPanel } from "@/components/agent/agent-panel";
import { CostDisplay } from "@/components/cost-display";
import { FileTree } from "@/components/file-tree";
import { FileViewerDrawer } from "@/components/file-viewer";

export const AppLayout = () => {
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerPath, setFileViewerPath] = useState<string | null>(null);

  const handleFileSelect = (path: string) => {
    setFileViewerPath(path);
    setFileViewerOpen(true);
  };

  const handleFileViewerOpenChange = (open: boolean) => {
    setFileViewerOpen(open);
    if (!open) setFileViewerPath(null);
  };

  return (
    <div className="flex h-screen w-full min-w-0 overflow-hidden bg-secondary">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden bg-secondary">
        <div className="flex min-h-0 flex-1 shrink-0 flex-col overflow-hidden bg-secondary">
          <div className="flex h-10 draggable shrink-0 items-center justify-between border-b border-foreground/10 px-4 drag-region">
            <div className="flex items-center">
              <h1 className="text-sm font-semibold text-foreground">AgentIDE</h1>
            </div>
            <CostDisplay />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AgentPanel />
          </div>
        </div>
        <div className="flex min-h-0 w-[300px] shrink-0 flex-col overflow-hidden border-l border-foreground/5 bg-secondary">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-foreground/10 px-4 drag-region">
            <h2 className="text-sm font-medium text-foreground">Files</h2>
          </div>
          <FileTree className="h-full" onFileSelect={handleFileSelect} />
        </div>
      </div>
      <FileViewerDrawer
        open={fileViewerOpen}
        onOpenChange={handleFileViewerOpenChange}
        filePath={fileViewerPath}
      />
    </div>
  );
};
