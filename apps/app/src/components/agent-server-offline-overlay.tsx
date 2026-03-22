import { Button } from "@openade/ui";
import { Loader2 } from "lucide-react";

type AgentServerOfflineOverlayProps = {
  checking: boolean;
  backendUrl: string;
  onRetry: () => void;
};

export function AgentServerOfflineOverlay({
  checking,
  backendUrl,
  onRetry,
}: AgentServerOfflineOverlayProps) {
  return (
    <div className="flex h-screen w-full min-w-0 flex-col items-center justify-center gap-6 bg-secondary p-8 text-center dark:bg-background">
      <div className="flex max-w-md flex-col items-center gap-3">
        {checking ? (
          <>
            <Loader2 className="size-10 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-semibold text-foreground">Connecting to agent server</h1>
            <p className="text-sm text-muted-foreground">
              Waiting for a response from{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{backendUrl}</code>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">Agent server unreachable</h1>
            <p className="text-sm text-muted-foreground">
              This app needs the local Openade agent API at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{backendUrl}</code>.
              Start it from your project clone (e.g.{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">bun run dev:server</code>
              ), confirm <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VITE_AGENT_SERVER_URL</code>{" "}
              matches if you use a static build, and check CORS if the UI is on another origin.
            </p>
          </>
        )}
      </div>
      {!checking && (
        <Button type="button" onClick={onRetry}>
          Retry connection
        </Button>
      )}
    </div>
  );
}
