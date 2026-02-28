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
  anchorTop?: boolean;
};

// --- Helpers ---

function getFileName(label: string): string {
  const parts = label.split("/");
  return parts[parts.length - 1] || label;
}

function getParentDir(label: string): string | null {
  const lastSlash = label.lastIndexOf("/");
  return lastSlash > 0 ? label.slice(0, lastSlash + 1) : null;
}

type GroupedItems = {
  skills: FileMentionItem[];
  files: FileMentionItem[];
};

function groupItems(items: FileMentionItem[]): GroupedItems {
  return {
    skills: items.filter((i) => i.type === "skill"),
    files: items.filter((i) => i.type !== "skill"),
  };
}

// --- Sub-components ---

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

interface MentionItemProps {
  item: FileMentionItem;
  isSelected: boolean;
  index: number;
  onSelect: () => void;
  command: (item: FileMentionItem) => void;
}

function MentionItem({ item, isSelected, index, onSelect, command }: MentionItemProps) {
  const fileName = getFileName(item.label);
  const parentDir = getParentDir(item.label);

  return (
    <Button
      data-mention-index={index}
      size="sm"
      variant={isSelected ? "secondary" : "ghost"}
      className={cn(
        "w-full shrink-0 justify-start gap-2 rounded-sm",
        isSelected && "bg-foreground/10 hover:bg-foreground/20 text-foreground"
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        command(item);
        onSelect();
      }}
    >
      <ItemIcon item={item} fileName={fileName} />
      <ItemLabel fileName={fileName} parentDir={parentDir} />
    </Button>
  );
}

function ItemIcon({ item, fileName }: { item: FileMentionItem; fileName: string }) {
  if (item.type === "skill") {
    return <BookIcon className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  if (item.type === "directory") {
    return <FolderIcon name={fileName} />;
  }
  return getFileTypeIcon(fileName);
}

function ItemLabel({ fileName, parentDir }: { fileName: string; parentDir: string | null }) {
  return (
    <span className="min-w-0 flex items-baseline gap-0 truncate text-xs font-medium">
      <span className="text-foreground">{fileName}</span>
      {parentDir && (
        <span className="ml-1.5 text-muted-foreground text-[10px]">{parentDir}</span>
      )}
    </span>
  );
}

interface ListContentProps {
  items: FileMentionItem[];
  selectedIndex: number;
  onSelect: () => void;
  command: (item: FileMentionItem) => void;
  preventBlur: (e: React.MouseEvent | React.TouchEvent) => void;
}

function ListContent({ items, selectedIndex, onSelect, command, preventBlur }: ListContentProps) {
  const { skills, files } = groupItems(items);
  let flatIndex = 0;

  return (
    <div
      className="flex flex-col gap-1 overflow-y-auto"
      onMouseDown={(e) => {
        e.preventDefault();
        preventBlur(e);
      }}
      onTouchStart={preventBlur}
    >
      {skills.length > 0 && (
        <>
          <SectionHeader>Skills</SectionHeader>
          {skills.map((item) => (
            <MentionItem
              key={`skill-${item.id}`}
              item={item}
              isSelected={flatIndex === selectedIndex}
              index={flatIndex++}
              onSelect={onSelect}
              command={command}
            />
          ))}
        </>
      )}
      {files.length > 0 && (
        <>
          <SectionHeader>Files</SectionHeader>
          {files.map((item) => (
            <MentionItem
              key={item.id}
              item={item}
              isSelected={flatIndex === selectedIndex}
              index={flatIndex++}
              onSelect={onSelect}
              command={command}
            />
          ))}
        </>
      )}
    </div>
  );
}

// --- Main Component ---

export const FileMentionList = ({
  items,
  selectedIndex,
  command,
  clientRect,
  onSelect,
  preventBlur,
  anchorTop = false,
  zIndexClassName,
}: FileMentionListProps) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-mention-index="${selectedIndex}"]`) as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) return null;

  // Anchor mode: render in-place (used in embedded chat)
  if (anchorTop) {
    return (
      <div
        ref={listRef}
        className={cn(
          "absolute bottom-4 left-0 right-0 max-h-[280px] w-full overflow-x-hidden rounded-xl bg-secondary p-1 shadow-popover",
          zIndexClassName ?? "z-[var(--z-drawer)]"
        )}
      >
        <ListContent
          items={items}
          selectedIndex={selectedIndex}
          onSelect={() => onSelect?.()}
          command={command}
          preventBlur={preventBlur}
        />
      </div>
    );
  }

  // Floating mode: render via portal, positioned near cursor
  const getRect = clientRect ?? (() => null);
  const rect = getRect();
  if (!rect) return null;

  const list = (
    <div
      ref={listRef}
      className={cn(
        "absolute max-h-[280px] w-[350px] overflow-x-hidden rounded-xl bg-background p-1 shadow-popover",
        zIndexClassName || "z-[var(--z-drawer)]"
      )}
      style={{
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
      }}
    >
      <ListContent
        items={items}
        selectedIndex={selectedIndex}
        onSelect={() => onSelect?.()}
        command={command}
        preventBlur={preventBlur}
      />
    </div>
  );

  return createPortal(list, document.body);
};
