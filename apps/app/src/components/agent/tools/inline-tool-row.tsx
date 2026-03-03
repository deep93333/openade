import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRightIcon, LoaderCircle } from "lucide-react";
import { cn } from "@agentide/ui";

type TextShimmerProps = {
  children: ReactNode;
  className?: string;
  duration?: number;
};

function TextShimmer({ children, className, duration = 1.5 }: TextShimmerProps) {
  return (
    <span
      className={cn("shimmer-text", className)}
      style={{
        "--shimmer-duration": `${duration}s`,
      } as React.CSSProperties}
    >
      {children}
    </span>
  );
}

const ROW_HEIGHT = 24;
const CONNECTOR_HEIGHT = 8;
const ICON_SIZE = 14;
const TIMELINE_WIDTH = 14;

type InlineToolRowProps = {
  icon: ReactNode;
  label: ReactNode;
  children?: ReactNode;
  hasDetails?: boolean;
  isCompleted?: boolean;
  isRunning?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

export const InlineToolRow = ({
  icon,
  label,
  children,
  hasDetails = false,
  isCompleted = false,
  isRunning = false,
  isFirst = true,
  isLast = true,
}: InlineToolRowProps) => {
  const [open, setOpen] = useState(false);

  const statusNode = isCompleted ? (
    <CheckCircle2
      className="shrink-0 text-emerald-500"
      size={ICON_SIZE}
      strokeWidth={2}
    />
  ) : isRunning ? (
    <LoaderCircle
      className="shrink-0 text-blue-500 animate-spin"
      size={ICON_SIZE}
      strokeWidth={2}
    />
  ) : (
    <div
      className="shrink-0 rounded-full bg-muted-foreground/40"
      style={{ width: ICON_SIZE, height: ICON_SIZE }}
    />
  );

  const labelRow = (
    <div
      className="flex w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
      style={{ minHeight: ROW_HEIGHT }}
    >
      {hasDetails ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-foreground transition-colors"
        >
          <span className="flex shrink-0 items-center text-muted-foreground/70">{icon}</span>
          <span className="flex shrink-0 items-center text-muted-foreground/70">{icon}</span>
        
            <TextShimmer className="min-w-0 truncate">{label}</TextShimmer>
          
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex shrink-0"
          >
            <ChevronRightIcon className="size-3 text-muted-foreground/40" />
          </motion.span>
        </button>
      ) : (
        <>
          <span className="flex shrink-0 items-center text-muted-foreground/70">{icon}</span>
       
            <TextShimmer className="min-w-0 truncate">{label}</TextShimmer>
         
        </>
      )}
    </div>
  );

  return (
    <motion.div
      className="flex min-w-0"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div
        className="flex flex-col items-center self-stretch shrink-0"
        style={{ width: TIMELINE_WIDTH }}
      >
        {!isFirst && (
          <div
            className="w-px shrink-0 bg-border"
            style={{ height: CONNECTOR_HEIGHT }}
          />
        )}
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ height: ROW_HEIGHT }}
        >
          {statusNode}
        </div>
        <div
          className={`w-px min-w-px flex-1 min-h-px ${isLast ? "invisible" : "bg-border"}`}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col pl-0">
        {!isFirst && (
          <div
            className="shrink-0"
            style={{ height: CONNECTOR_HEIGHT }}
          />
        )}
        {labelRow}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="detail"
              className="mt-2 overflow-hidden"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
