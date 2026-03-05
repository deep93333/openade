import { useCallback, useState } from "react";
import type { ProviderConfig } from "@agentide/shared";
import { Badge, Button, Input, Label } from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";

type ProviderKeyInputProps = {
  config: ProviderConfig;
  maskedKey: string | null;
  onSaved?: () => void;
};

export const ProviderKeyInput = ({
  config,
  maskedKey,
  onSaved,
}: ProviderKeyInputProps) => {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = getElectronAPI();

  const handleSave = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("API key is required");
      return;
    }
    if (config.keyPrefix && !trimmed.startsWith(config.keyPrefix)) {
      setError(`Invalid API key format. It should start with ${config.keyPrefix}`);
      return;
    }
    setSaving(true);
    setError(null);

    if (!api?.apiKeys) {
      setError("Electron API not available");
      setSaving(false);
      return;
    }

    const result = await api.apiKeys.set(config.id, trimmed);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to save API key");
      return;
    }

    setApiKey("");
    onSaved?.();
  }, [apiKey, config, api, onSaved]);

  const handleRemove = useCallback(async () => {
    if (!api?.apiKeys) return;
    await api.apiKeys.set(config.id, null);
    setApiKey("");
    onSaved?.();
  }, [config.id, api, onSaved]);

  const handleChange = (value: string) => {
    setApiKey(value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">{config.name} API Key
          <Badge variant={maskedKey ? "green" : "gray"} size="sm">
          {maskedKey ? "Configured" : "Not set"}
        </Badge>

          </h3>
          <p className="text-sm text-muted-foreground">
            {config.helpText ?? "Keys are encrypted and stored locally."}
          </p>
        </div>
     
      </div>

      {config.helpUrl && (
        <a
          href={config.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Open {config.name} key settings
        </a>
      )}

      {maskedKey && !apiKey && (
        <div className="flex items-center gap-2">
          <Input value={maskedKey} disabled className="font-mono text-xs" />
          <Button size="sm" variant="secondary" onClick={handleRemove}>
            Remove
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${config.id}-api-key`}>API Key</Label>
        <Input
          id={`${config.id}-api-key`}
          type="password"
          placeholder={config.keyPlaceholder}
          value={apiKey}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="font-mono"
        />
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Your key never leaves this machine.
        </span>
        <Button
          variant="brand"
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
        >
          {saving ? "Saving…" : `Save API Key`}
        </Button>
      </div>
    </div>
  );
};
