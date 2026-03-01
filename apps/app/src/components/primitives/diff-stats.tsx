import { cn } from "@agentide/ui";

type DiffStatsProps = {
  added: number;
  deleted: number;
  badge?: boolean;
  className?: string;
};

export function DiffStats({ added, deleted, badge = false, className }: DiffStatsProps) {
  if (added === 0 && deleted === 0) return null;

  const addedClass = badge
    ? "rounded bg-green-500/15 px-1 text-green-700 dark:text-green-400"
    : "text-green-600 dark:text-green-400";

  const deletedClass = badge
    ? "rounded bg-red-500/15 px-1 text-red-700 dark:text-red-400"
    : "text-red-600 dark:text-red-400";

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", className)}>
      {added > 0 && <span className={addedClass}>+{added}</span>}
      {deleted > 0 && <span className={deletedClass}>-{deleted}</span>}
    </span>
  );
}
