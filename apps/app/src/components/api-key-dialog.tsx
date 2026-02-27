import { useCallback, useEffect, useState } from "react";
import type { AuthMethod, AuthStatus } from "@agentide/shared";
import {
  Button,
  Input,
  KeyIcon,
  CircleXIcon,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
import { cn } from "@/lib/cn";
import { IconUserCircle } from "@tabler/icons-react";

type ApiKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  dismissible?: boolean;
};

export const ApiKeyDialog = ({
  open,
  onOpenChange,
  onSaved,
  dismissible = true,
}: ApiKeyDialogProps) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>("claude_login");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masked, setMasked] = useState<string | null>(null);
  const [codexApiKey, setCodexApiKey] = useState("");
  const [codexMasked, setCodexMasked] = useState<string | null>(null);
  const [codexSaving, setCodexSaving] = useState(false);
  const [codexError, setCodexError] = useState<string | null>(null);

  const refreshAuthStatus = useCallback(async () => {
    const api = getElectronAPI();
    const [authRes, keyRes, codexKeyRes] = await Promise.all([
      api?.auth?.status(),
      api?.apiKey?.get(),
      api?.codexApiKey?.get(),
    ]);
    if (authRes?.success && authRes.data) {
      setAuthStatus(authRes.data);
      setSelectedMethod(authRes.data.method);
    }
    if (keyRes?.success && keyRes.data) {
      const key = keyRes.data;
      setMasked(`${key.slice(0, 7)}${"•".repeat(20)}${key.slice(-4)}`);
    } else {
      setMasked(null);
    }
    if (codexKeyRes?.success && codexKeyRes.data) {
      const key = codexKeyRes.data;
      setCodexMasked(`${key.slice(0, 7)}${"•".repeat(20)}${key.slice(-4)}`);
    } else {
      setCodexMasked(null);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setLoggingIn(false);
    setApiKey("");
    setCodexApiKey("");
    setCodexError(null);
    setCodexSaving(false);
    refreshAuthStatus();
  }, [open, refreshAuthStatus]);

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("API key is required");
      return;
    }
    if (!trimmed.startsWith("sk-ant-")) {
      setError("Invalid API key format. It should start with sk-ant-");
      return;
    }
    setSaving(true);
    setError(null);
    const api = getElectronAPI();
    if (!api?.apiKey || !api?.auth) {
      setError("Electron API not available");
      setSaving(false);
      return;
    }
    const result = await api.apiKey.set(trimmed);
    if (!result.success) {
      setError(result.error ?? "Failed to save API key");
      setSaving(false);
      return;
    }
    await api.auth.setMethod("api_key");
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  }, [apiKey, onOpenChange, onSaved]);

  const handleUseCliLogin = useCallback(async () => {
    setSaving(true);
    setError(null);
    const api = getElectronAPI();
    if (!api?.auth) {
      setError("Electron API not available");
      setSaving(false);
      return;
    }
    await api.auth.setMethod("claude_login");
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  }, [onOpenChange, onSaved]);

  const handleRemoveApiKey = useCallback(async () => {
    const api = getElectronAPI();
    if (!api?.apiKey) return;
    await api.apiKey.set(null);
    setMasked(null);
    setApiKey("");
  }, []);

  const handleSaveCodexApiKey = useCallback(async () => {
    const trimmed = codexApiKey.trim();
    if (!trimmed) {
      setCodexError("API key is required");
      return;
    }
    setCodexSaving(true);
    setCodexError(null);
    const api = getElectronAPI();
    if (!api?.codexApiKey) {
      setCodexError("Electron API not available");
      setCodexSaving(false);
      return;
    }
    const result = await api.codexApiKey.set(trimmed);
    setCodexSaving(false);
    if (!result.success) {
      setCodexError(result.error ?? "Failed to save API key");
      return;
    }
    await refreshAuthStatus();
    onSaved?.();
  }, [codexApiKey, onSaved, refreshAuthStatus]);

  const handleRemoveCodexApiKey = useCallback(async () => {
    const api = getElectronAPI();
    if (!api?.codexApiKey) return;
    await api.codexApiKey.set(null);
    setCodexMasked(null);
    setCodexApiKey("");
  }, []);

  const handleLogin = useCallback(async () => {
    setLoggingIn(true);
    setError(null);
    const api = getElectronAPI();
    if (!api?.auth) {
      setError("Electron API not available");
      setLoggingIn(false);
      return;
    }
    const result = await api.auth.login();
    setLoggingIn(false);
    if (result.success) {
      await refreshAuthStatus();
      onSaved?.();
      onOpenChange(false);
    } else {
      setError(result.error ?? "Login failed");
    }
  }, [onOpenChange, onSaved, refreshAuthStatus]);

  if (!open) return null;

  const cliAvailable = authStatus?.cliLoggedIn === true;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background shadow-popover">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-3">
          <h2 className="text-sm font-semibold">Authentication</h2>
          {dismissible && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <CircleXIcon className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Choose how to authenticate with Claude.
          </p>

          <div className="flex flex-col gap-2">
            <MethodCard
              selected={selectedMethod === "claude_login"}
              onClick={() => { setSelectedMethod("claude_login"); setError(null); }}
              icon={<IconUserCircle className="size-5" stroke={1.5} />}
              title="Claude Code Login"
              description={
                cliAvailable
                  ? `Logged in as ${authStatus?.cliEmail ?? "unknown"}`
                  : "Sign in with your Claude account"
              }
              badge={cliAvailable ? "Connected" : "Not detected"}
              badgeVariant={cliAvailable ? "success" : "muted"}
              active={authStatus?.method === "claude_login"}
            />

            <MethodCard
              selected={selectedMethod === "api_key"}
              onClick={() => { setSelectedMethod("api_key"); setError(null); }}
              icon={<KeyIcon className="size-4" />}
              title="API Key"
              description="Use an Anthropic API key from console.anthropic.com"
              badge={authStatus?.hasApiKey ? "Configured" : undefined}
              badgeVariant="success"
              active={authStatus?.method === "api_key"}
            />
          </div>

          {selectedMethod === "claude_login" && (
            <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 bg-secondary/30 p-3">
              {cliAvailable ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Your Claude Code session will be used. No API key needed.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleLogin}
                      disabled={saving || loggingIn}
                    >
                      {loggingIn ? "Logging in…" : "Re-login"}
                    </Button>
                    <Button
                      size="sm"
                      variant="brand"
                      onClick={handleUseCliLogin}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Use Claude Login"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Sign in with your Claude account. This will open a browser window for authentication.
                  </p>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="brand"
                      onClick={handleLogin}
                      disabled={loggingIn}
                    >
                      {loggingIn ? (
                        <span className="flex items-center gap-2">
                          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Waiting for login…
                        </span>
                      ) : (
                        "Login with Claude"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {selectedMethod === "api_key" && (
            <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Get a key from{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline underline-offset-2 hover:text-foreground/80"
                >
                  console.anthropic.com
                </a>
                . Encrypted and stored locally.
              </p>

              {masked && !apiKey && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-foreground/10 bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                    {masked}
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleRemoveApiKey}>
                    Remove
                  </Button>
                </div>
              )}

              <Input
                type="password"
                placeholder="sk-ant-api03-..."
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveApiKey(); }}
                className={cn(
                  "font-mono text-xs",
                  error && "border-destructive focus-visible:ring-destructive"
                )}
                autoFocus
              />

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="brand"
                  onClick={handleSaveApiKey}
                  disabled={saving || !apiKey.trim()}
                >
                  {saving ? "Saving…" : "Save API Key"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-foreground/10 p-5">
          <h3 className="text-xs font-medium text-muted-foreground">Codex (OpenAI)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Used when the Codex provider is selected. Set CODEX_API_KEY or use an OpenAI-compatible key. Encrypted and stored locally.
          </p>
          <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 bg-secondary/30 p-3">
            {codexMasked && !codexApiKey && (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-foreground/10 bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                  {codexMasked}
                </div>
                <Button size="sm" variant="secondary" onClick={handleRemoveCodexApiKey}>
                  Remove
                </Button>
              </div>
            )}
            <Input
              type="password"
              placeholder="sk-... or CODEX_API_KEY"
              value={codexApiKey}
              onChange={(e) => { setCodexApiKey(e.target.value); setCodexError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveCodexApiKey(); }}
              className={cn(
                "font-mono text-xs",
                codexError && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {codexError && <p className="text-xs text-destructive">{codexError}</p>}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="brand"
                onClick={handleSaveCodexApiKey}
                disabled={codexSaving || !codexApiKey.trim()}
              >
                {codexSaving ? "Saving…" : "Save Codex API Key"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type MethodCardProps = {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "success" | "muted";
  active?: boolean;
};

const MethodCard = ({
  selected,
  onClick,
  icon,
  title,
  description,
  badge,
  badgeVariant = "muted",
  active,
}: MethodCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
      selected
        ? "border-foreground/20 bg-secondary/50"
        : "border-foreground/10 hover:bg-secondary/30"
    )}
  >
    <div className="mt-0.5 text-muted-foreground">{icon}</div>
    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{title}</span>
        {active && (
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Active
          </span>
        )}
        {badge && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              badgeVariant === "success"
                ? "bg-green-500/15 text-green-700 dark:text-green-400"
                : "bg-foreground/10 text-muted-foreground"
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground leading-relaxed">{description}</span>
    </div>
  </button>
);
