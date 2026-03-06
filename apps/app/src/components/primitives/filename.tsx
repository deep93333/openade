import { cn } from "@agentide/ui";
import { FolderIcon, getFileTypeIcon } from "@/components/file-tree/icons";

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}

export function parentDir(path: string): string | null {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i + 1) : null;
}

type FileNameProps = {
  path: string;
  type?: "file" | "directory";
  isOpen?: boolean;
  showParentDir?: boolean;
  nameClassName?: string;
  iconSize?: string;
  parentDirClassName?: string;
  className?: string;
};

export function FileName({
  path,
  type = "file",
  isOpen,
  iconSize = "size-3",
  showParentDir = false,
  nameClassName,
  parentDirClassName,
  className,
}: FileNameProps) {
  const name = basename(path);
  const dir = showParentDir ? parentDir(path) : null;

  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {type === "directory" ? (
        <FolderIcon name={name} open={isOpen} size={iconSize} />
      ) : (
        getFileTypeIcon(name, iconSize)
      )}
      <span className={cn("truncate text-xs", nameClassName)}>
        {name}
      </span>
      {dir && (
        <span className={cn("truncate text-muted-foreground text-[10px]", parentDirClassName)}>
          {dir}
        </span>
      )}
    </span>
  );
}
