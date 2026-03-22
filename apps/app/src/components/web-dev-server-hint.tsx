import { useCallback, useLayoutEffect, useState } from "react";
import { Button } from "@openade/ui";
import { OPENADE_AGENT_DEFAULT_ORIGIN } from "@openade/shared";
import { getBackendBaseUrl } from "@/lib/backend-url";
import { isElectron } from "@/lib/electron";

const DISMISS_KEY = "openade-web-server-hint-dismissed";

export function WebDevServerHint() {
  const [dismissed, setDismissed] = useState(false);

  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      //
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      //
    }
    setDismissed(true);
  }, []);

  if (isElectron() || dismissed) return null;

  const base = getBackendBaseUrl();

  return (
    <div
      role="status"
      className="shrink-0 border-b border-border/60 bg-muted/50 px-4 py-3 text-sm text-foreground"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-2">
          <p className="font-medium">Web mode — run the agent server locally</p>
          <p className="text-muted-foreground">
            This UI talks to <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">{base}</code>.
            In a terminal (from any folder you want the project in):
          </p>
          <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
            <li>
              <span className="text-foreground">One-shot (recommended):</span>{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">npx tryade</code>
              <span className="text-muted-foreground"> — see </span>
              <a
                className="text-primary underline-offset-2 hover:underline"
                href="https://tryade.dev"
                target="_blank"
                rel="noreferrer"
              >
                tryade.dev
              </a>
            </li>
            <li>
              <span className="text-foreground">From a clone:</span>{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">bun run dev</code>
              <span className="text-muted-foreground"> (app + server), or </span>
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">bun run dev:server</code>
              <span className="text-muted-foreground"> (API only; run the Vite app separately).</span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground">Hosted static UI + this machine:</span> build the app with{" "}
            <code className="font-mono">VITE_AGENT_SERVER_URL</code> pointing at this server (e.g.{" "}
            <code className="rounded bg-background/80 px-1 py-0.5 font-mono">{OPENADE_AGENT_DEFAULT_ORIGIN}</code>
            ). The server allows <code className="font-mono">https://tryade.dev</code>,{" "}
            <code className="font-mono">https://app.tryade.dev</code>, and local dev origins;
            add more with <code className="font-mono">OPENADE_CORS_ORIGINS</code> (comma-separated) when starting{" "}
            <code className="font-mono">dev:server</code>.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 self-start" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
