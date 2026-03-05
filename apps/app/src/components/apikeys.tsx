import { useCallback, useEffect, useState } from "react";
import type { ProviderConfig } from "@agentide/shared";
import { PROVIDER_CONFIGS } from "@agentide/shared";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
import { ProviderKeyInput } from "./providerkey";
import { IconX } from "@tabler/icons-react";

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
  const [activeTab, setActiveTab] = useState<string>(PROVIDER_CONFIGS[0]?.id ?? "claude");

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

  const activeProvider = PROVIDER_CONFIGS.find((p) => p.id === activeTab);

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="max-w-2xl h-[500px]">
        <DialogHeader>
          <div className="flex flex-col gap-1">
            <DialogTitle>API Keys</DialogTitle>
            <DialogDescription>
              Configure API keys for AI providers. Keys are encrypted and stored locally.
            </DialogDescription>
          </div>
      
        </DialogHeader>
   
        <div className="flex gap-4 pt-6">
          <div className="flex w-44 flex-col gap-3">
           
            <div className="flex flex-col gap-1">
              {PROVIDER_CONFIGS.map((provider) => (
                <Button
                  key={provider.id}
                  onClick={() => setActiveTab(provider.id)}
                  variant={activeTab === provider.id ? "secondary" : "ghost"}
                  className="justify-start"
                >
                  <span>{provider.name}</span>
                 
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            {activeProvider && (
              <ProviderKeyInput
                config={activeProvider}
                maskedKey={maskedKeys[activeProvider.id] ?? null}
                onSaved={refreshMaskedKeys}
              />
            )}
          </div>
        </div>

   
      </DialogContent>
    </Dialog>
  );
};
