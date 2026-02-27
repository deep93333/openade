import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button, BookIcon } from "@agentide/ui";
import { cn } from "@/lib/cn";
import { FolderIcon, getFileTypeIcon } from "@/components/file-tree/file-icons";

export type FileMentionItem = {
  id: string;
  label: string;
  type: "file" | "directory" | "skill";
};

type FileMentionListProps = {
  items: FileMentionItem[];
  selectedIndex: number;
  command: (item: FileMentionItem) => void;
  clientRect?: (() => DOMRect | null) | null;
  onSelect?: () => void;
  preventBlur: (e: React.MouseEvent | React.TouchEvent) => void;
  workspacePath?: string;
  zIndexClassName?: string;
};

function getFileName(label: string): string {
  const parts = label.split("/");
  return parts[parts.length - 1] || label;
}

function getParentDir(label: string): string | null {
  const lastSlash = label.lastIndexOf("/");
  return lastSlash > 0 ? label.slice(0, lastSlash + 1) : null;
}

export const FileMentionList = ({
  items,
  selectedIndex,
  command,
  clientRect,
  onSelect,
  preventBlur,
  workspacePath,
  zIndexClassName,
}: FileMentionListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const getRect = clientRect ?? (() => null);
  const rect = getRect();

  const skillItems = items.filter((i) => i.type === "skill");
  const fileItems = items.filter((i) => i.type !== "skill");

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-mention-index="${selectedIndex}"]`) as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!rect || items.length === 0) return null;

  const renderItem = (item: FileMentionItem, index: number) => {
    const fileName = getFileName(item.label);
    const parentDir = getParentDir(item.label);

    return (
      <Button
        key={item.type === "skill" ? `skill-${item.id}` : item.id}
        data-mention-index={index}
        size="sm"
        variant={index === selectedIndex ? "accent" : "ghost"}
        className={cn(
          "w-full shrink-0 justify-start gap-2 rounded-md",
          index === selectedIndex && "bg-accent/10 hover:bg-accent/20 text-foreground"
        )}
        onMouseDown={(e) => {
          e.preventDefault();
          command(item);
          onSelect?.();
        }}
      >
        {item.type === "skill" ? (
          <BookIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : item.type === "directory" ? (
          <FolderIcon name={fileName} />
        ) : (
          getFileTypeIcon(fileName)
        )}
        <span className="min-w-0 flex items-baseline gap-0 truncate text-xs font-medium">
          <span className="text-foreground">{fileName}</span>
          {parentDir && (
            <span className="ml-1.5 text-muted-foreground text-[10px]">{parentDir}</span>
          )}
        </span>
      </Button>
    );
  };

  let flatIndex = 0;
  const list = (
    <div
      ref={listRef}
      className={cn(
        "fixed max-h-[280px] bg-background dark:ring dark:ring-foreground/10 w-[350px] flex flex-col gap-1 overflow-y-auto overflow-x-hidden rounded-xl p-1 shadow-popover",
        zIndexClassName || "z-[var(--z-drawer)]"
      )}
      style={{
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        preventBlur(e);
      }}
      onTouchStart={preventBlur}
    >
      {skillItems.length > 0 && (
        <>
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Skills
          </div>
          {skillItems.map((item) => renderItem(item, flatIndex++))}
        </>
      )}
      {fileItems.length > 0 && (
        <>
          <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Files
          </div>
          {fileItems.map((item) => renderItem(item, flatIndex++))}
        </>
      )}
    </div>
  );

  return createPortal(list, document.body);
};
