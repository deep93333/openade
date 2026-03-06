import { useCallback, useEffect, useState } from "react";
import { PROVIDER_CONFIGS } from "@agentide/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
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

  const api = getElectronAPI();

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
  }, [open, refreshMaskedKeys]);

  const activeProvider = PROVIDER_CONFIGS.find((p) => p.id === activeProviderTab);

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
