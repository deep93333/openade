import { useCallback, useEffect, useMemo, useState } from "react";
import { PROVIDER_CONFIGS } from "@agentide/shared";
import {
  Button,
  ChevronDownIcon,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
import { useChatEditorStore } from "@/store/editor";
import { MCPSettings } from "./mcp-settings";
import { ProviderKeyInput } from "./providerkey";

type ApiKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export const ApiKeyDialog = ({
  open,
  onOpenChange,
  onSaved,
}: ApiKeyDialogProps) => {
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string | null>>({});
  const [activeProviderTab, setActiveProviderTab] = useState<string>(PROVIDER_CONFIGS[0]?.id ?? "claude");
  const [commitMessageModel, setCommitMessageModel] = useState("");
  const [commitMessageProvider, setCommitMessageProvider] = useState<string>("");

  const api = getElectronAPI();
  const modelOptions = useChatEditorStore((s) => s.modelOptions);
  const fetchModelOptions = useChatEditorStore((s) => s.fetchModelOptions);
  const commitMessageModelOptions = useMemo(
    () => modelOptions.map((option) => ({ value: option.value, label: option.label, provider: option.provider })),
    [modelOptions]
  );

  const refreshMaskedKeys = useCallback(async () => {
    if (!api?.apiKeys) return;

    const providers = PROVIDER_CONFIGS.map((p) => p.id);
    const results = await Promise.all(
      providers.map((provider) => api.apiKeys!.get(provider))
    );

    const newMasked: Record<string, string | null> = {};
    results.forEach((res, i) => {
      if (res?.success && res.data) {
        const key = res.data;
        newMasked[providers[i]] = `${key.slice(0, 7)}${"•".repeat(20)}${key.slice(-4)}`;
      } else {
        newMasked[providers[i]] = null;
      }
    });

    setMaskedKeys(newMasked);
  }, [api]);

  useEffect(() => {
    if (!open) return;
    refreshMaskedKeys();
    void fetchModelOptions();
  }, [fetchModelOptions, open, refreshMaskedKeys]);

  useEffect(() => {
    if (!open || !api?.settings) return;

    let cancelled = false;
    void api.settings.get().then((result) => {
      if (!result.success || !result.data || cancelled) return;
      setCommitMessageModel(result.data.commitMessageModel ?? "");
      setCommitMessageProvider(result.data.commitMessageProvider ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [api, open]);

  const activeProvider = PROVIDER_CONFIGS.find((p) => p.id === activeProviderTab);

  const handleCommitMessageModelChange = useCallback(async (value: string) => {
    if (!api?.settings) return;

    const selected = commitMessageModelOptions.find((option) => option.value === value);
    const nextModel = value === "__default__" ? "" : value;
    const nextProvider = value === "__default__" ? "" : (selected?.provider ?? "");

    setCommitMessageModel(nextModel);
    setCommitMessageProvider(nextProvider);

    const current = await api.settings.get();
    if (!current.success || !current.data) return;

    await api.settings.set({
      ...current.data,
      commitMessageModel: nextModel || undefined,
      commitMessageProvider: nextProvider || undefined,
    });
    onSaved?.();
  }, [api, commitMessageModelOptions, onSaved]);

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-4xl h-[680px]">
        <DialogHeader>
          <div className="flex flex-col gap-1">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage provider credentials and global MCP server connections.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs defaultValue="providers" className="flex h-full min-h-0 flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Commit message model</div>
              <div className="text-xs text-muted-foreground">
                Choose which model generates short git commit messages from staged diffs.
              </div>
            </div>
            <DropdownMenu modal={true}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-between">
                  <span className="truncate text-sm">
                    {commitMessageModel
                      ? (commitMessageModelOptions.find((option) => option.value === commitMessageModel)?.label ??
                        commitMessageModel)
                      : "Use default model"}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[240px]">
                <DropdownMenuRadioGroup
                  value={commitMessageModel || "__default__"}
                  onValueChange={(value) => void handleCommitMessageModelChange(value)}
                >
                  <DropdownMenuRadioItem value="__default__">Use default model</DropdownMenuRadioItem>
                  {commitMessageModelOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="providers" className="min-h-0 flex-1">
            <div className="flex h-full gap-4 pt-2">
              <div className="flex w-44 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  {PROVIDER_CONFIGS.map((provider) => (
                    <Button
                      key={provider.id}
                      onClick={() => setActiveProviderTab(provider.id)}
                      variant={activeProviderTab === provider.id ? "secondary" : "ghost"}
                      className="justify-start"
                    >
                      <span>{provider.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {activeProvider && (
                  <ProviderKeyInput
                    config={activeProvider}
                    maskedKey={maskedKeys[activeProvider.id] ?? null}
                    onSaved={() => {
                      void refreshMaskedKeys();
                      onSaved?.();
                    }}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mcp" className="min-h-0 flex-1 overflow-hidden">
            <MCPSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
