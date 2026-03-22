import type { AgentMode } from "@openade/shared";
import { cn } from "@/lib/cn";
import { useAgentStore } from "@/store/agent";
import { AGENT_MODES } from "./constants";

type ModeSelectorProps = {
  disabled?: boolean;
};

export const ModeSelector = ({ disabled }: ModeSelectorProps) => {
  const selectedMode = useAgentStore((s) => s.selectedMode);
  const setSelectedMode = useAgentStore((s) => s.setSelectedMode);
  return (
    <div
      role="tablist"
      aria-label="Agent mode"
      className="flex h-7 gap-1 rounded-lg bg-foreground/5 p-0.5"
    >
      {AGENT_MODES.map((mode) => {
        const Icon = mode.icon;
        const isSelected = selectedMode === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            title={`${mode.label}: ${mode.description}`}
            disabled={disabled}
            onClick={() => setSelectedMode(mode.value)}
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              isSelected ? "bg-background/80 shadow-card" : "hover:bg-foreground/5"
            )}
          >
            <Icon className="size-3.5! shrink-0" />
          </button>
        );
      })}
    </div>
  );
};
