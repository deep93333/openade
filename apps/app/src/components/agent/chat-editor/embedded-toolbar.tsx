import {
  ArrowUpIcon,
  Button,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  StopIcon,
} from "@agentide/ui";
import { IconPaperclip } from "@tabler/icons-react";
import { useAgentStore } from "@/store/agent.store";
import { useChatEditorStore } from "@/store/chat-editor.store";
import { ModeSelector } from "./mode-selector";

type EmbeddedToolbarProps = {
  isRunning: boolean;
  canShowAttach: boolean;
  onAttachClick: () => void;
  isProcessingImages: boolean;
  canSubmit: boolean;
  imageCount: number;
  onStop: () => void;
  onSubmit: () => void;
};

export type { EmbeddedToolbarProps };

export const EmbeddedToolbar = ({
  isRunning,
  canShowAttach,
  onAttachClick,
  isProcessingImages,
  canSubmit,
  imageCount,
  onStop,
  onSubmit,
}: EmbeddedToolbarProps) => {
  const selectedModel = useAgentStore((s) => s.selectedModel);
  const setSelectedModel = useAgentStore((s) => s.setSelectedModel);
  const modelOptions = useChatEditorStore((s) => s.modelOptions);

  const modelOptionsFormatted = modelOptions.map((m) => ({ value: m.value, label: m.label }));

  return (
    <div className="flex flex-wrap items-center gap-2 pb-2 px-2">
      <div className="flex flex-wrap items-center gap-2">
        <ModeSelector disabled={isRunning} />
        {canShowAttach && (
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onAttachClick}
            disabled={isRunning || isProcessingImages}
            title="Attach images"
          >
            <IconPaperclip stroke={1.5} className="size-4" />
          </Button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {modelOptionsFormatted.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" disabled={isRunning}>
                <span className="truncate text-xs text-left">
                  {modelOptionsFormatted.find((o) => o.value === selectedModel)?.label ?? selectedModel}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuRadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                {modelOptionsFormatted.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isRunning ? (
          <Button size="icon-sm" rounded="full" variant="secondary" onClick={onStop}>
            <StopIcon className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            rounded="full"
            variant={canSubmit || imageCount > 0 ? "brand" : "secondary"}
            onClick={onSubmit}
            disabled={!canSubmit && imageCount === 0}
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
