import { useCallback, useEffect, useState } from "react";
import type { ProviderConfig } from "@agentide/shared";
import { Badge, Button, Input, Label } from "@agentide/ui";
import { IconChevronDown, IconChevronUp, IconExternalLink } from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";

type ProviderKeyInputProps = {
  config: ProviderConfig;
  maskedKey: string | null;
  onSaved?: () => void;
  /** When true the form fields are always visible (no collapse toggle) */
  inline?: boolean;
};

export const ProviderKeyInput = ({
  config,
  maskedKey,
  onSaved,
  inline = false,
}: ProviderKeyInputProps) => {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = getElectronAPI();
  const isMoonshot = config.id === "moonshot";
  const isOpen = inline || expanded;

  useEffect(() => {
    if (!isMoonshot || !api?.settings) return;
    void api.settings.get().then((result) => {
      if (result.success && result.data?.moonshotBaseUrl) {
        setBaseUrl(result.data.moonshotBaseUrl);
      }
    });
  }, [isMoonshot, api]);

  const handleBaseUrlSave = useCallback(async () => {
    if (!isMoonshot || !api?.settings) return;
    const current = await api.settings.get();
    if (!current.success || !current.data) return;
    await api.settings.set({
      ...current.data,
      moonshotBaseUrl: baseUrl.trim() || undefined,
    });
    onSaved?.();
  }, [isMoonshot, api, baseUrl, onSaved]);

  const handleSave = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("API key is required");
      return;
    }
    if (config.keyPrefix && !trimmed.startsWith(config.keyPrefix)) {
      setError(`Key must start with ${config.keyPrefix}`);
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
    setExpanded(false);
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
    if (e.key === "Enter") void handleSave();
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Row header — always visible */}
      <div
        className={[
          "flex items-center gap-3 px-4 py-3",
          !inline ? "cursor-pointer select-none hover:bg-muted/30 transition-colors" : "",
        ].join(" ")}
        onClick={inline ? undefined : () => setExpanded((v) => !v)}
        role={inline ? undefined : "button"}
        tabIndex={inline ? undefined : 0}
        onKeyDown={inline ? undefined : (e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className="text-sm font-medium">{config.name}</span>
          <Badge variant={maskedKey ? "green" : "gray"} size="sm">
            {maskedKey ? "Configured" : "Not set"}
          </Badge>
        </div>

        {maskedKey && !isOpen && (
          <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px] hidden sm:block">
            {maskedKey}
          </span>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {config.helpUrl && (
            <a
              href={config.helpUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Docs</span>
            </a>
          )}
          {!inline && (
            <span className="text-muted-foreground">
              {isOpen ? <IconChevronUp className="size-4" /> : <IconChevronDown className="size-4" />}
            </span>
          )}
        </div>
      </div>

      {/* Expandable body */}
      {isOpen && (
        <div className="border-t border-border/50 px-4 py-4 space-y-4 bg-muted/10">
          {/* Existing key */}
          {maskedKey && !apiKey && (
            <div className="space-y-1.5">
              <Label className="text-xs">Current key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={maskedKey}
                  disabled
                  className="font-mono text-xs flex-1"
                />
                <Button size="sm" variant="secondary" onClick={handleRemove}>
                  Remove
                </Button>
              </div>
            </div>
          )}

          {/* Moonshot base URL */}
          {isMoonshot && (
            <div className="space-y-1.5">
              <Label htmlFor="moonshot-base-url" className="text-xs">
                Base URL{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Use{" "}
                <code className="rounded bg-muted px-1 font-mono text-[10px]">
                  https://api.moonshot.cn/v1
                </code>{" "}
                for China-region keys. Leave empty for international.
              </p>
              <div className="flex gap-2">
                <Input
                  id="moonshot-base-url"
                  type="url"
                  placeholder="https://api.moonshot.ai/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="font-mono text-xs flex-1"
                />
                <Button size="sm" variant="secondary" onClick={() => void handleBaseUrlSave()}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* New key input + save */}
          <div className="space-y-1.5">
            <Label htmlFor={`${config.id}-api-key`} className="text-xs">
              {maskedKey ? "Replace key" : "API key"}
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${config.id}-api-key`}
                type="password"
                placeholder={config.keyPlaceholder}
                value={apiKey}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="font-mono flex-1"
                autoFocus
              />
              <Button
                variant="brand"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !apiKey.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
