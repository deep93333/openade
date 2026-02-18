import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button, FileIcon } from "@agentide/ui";
import { cn } from "@/lib/cn";

export type FileMentionItem = { id: string; label: string };

type FileMentionListProps = {
  items: FileMentionItem[];
  selectedIndex: number;
  command: (item: FileMentionItem) => void;
  clientRect?: (() => DOMRect | null) | null;
  onSelect?: () => void;
  preventBlur: (e: React.MouseEvent | React.TouchEvent) => void;
};

export const FileMentionList = ({
  items,
  selectedIndex,
  command,
  clientRect,
  onSelect,
  preventBlur,
}: FileMentionListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const getRect = clientRect ?? (() => null);
  const rect = getRect();

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!rect || items.length === 0) return null;

  const list = (
    <div
      ref={listRef}
      className="fixed z-[var(--z-drawer)] max-h-[280px] bg-background w-[300px] flex flex-col gap-1 overflow-y-auto overflow-x-hidden rounded-xl p-1 shadow-popover"
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
      {items.map((file, i) => (
        <Button
          key={file.id}
          variant={i === selectedIndex ? "accent" : "ghost"}
          className="w-full justify-start"
          onMouseDown={(e) => {
            e.preventDefault();
            command(file);
            onSelect?.();
          }}
        >
            <FileIcon className="size-4" />
            <span className="truncate">{file.label}</span>
        </Button>
      ))}
    </div>
  );

  return createPortal(list, document.body);
};
