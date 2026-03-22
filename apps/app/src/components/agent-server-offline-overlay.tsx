import { Button } from "@openade/ui";
import { Loader2 } from "lucide-react";
import { isElectron } from "@/lib/electron";

type AgentServerOfflineOverlayProps = {
  checking: boolean;
  backendUrl: string;
  manualConnectRequired: boolean;
  onRetry: () => void;
};

function isLoopbackBackendUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
  } catch {
    return false;
  }
}

export function AgentServerOfflineOverlay({
  checking,
  backendUrl,
  manualConnectRequired,
  onRetry,
}: AgentServerOfflineOverlayProps) {
  const showChromeLnaHint =
    !isElectron() &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    isLoopbackBackendUrl(backendUrl);
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
            {showChromeLnaHint && (
              <p className="text-sm text-muted-foreground">
                If this never finishes, Chrome may be blocking loopback from this HTTPS origin until
                you allow local access for this site (lock icon → site settings), then use Retry
                below once it appears.
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              {manualConnectRequired ? "Connect to local agent server" : "Agent server unreachable"}
            </h1>
            <p className="text-sm text-muted-foreground">
              This app needs the local Openade agent API at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{backendUrl}</code>
              . Start it on this machine from your project clone (e.g.{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                bun run dev:server
              </code>
              ), confirm{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                VITE_AGENT_SERVER_URL
              </code>{" "}
              matches if you use a static build, and check CORS if the UI is on another origin.
            </p>
            {showChromeLnaHint && (
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground">Chrome / Edge:</span> this hosted UI can use your
                localhost backend, but the browser must allow loopback access for this site first.
                Click the button below to trigger the check. If Chrome keeps blocking it, open the
                site lock icon → Site settings and allow local or loopback access for this site,
                then try again.
              </p>
            )}
          </>
        )}
      </div>
      {!checking && (
        <Button type="button" onClick={onRetry}>
          {manualConnectRequired ? "Connect to localhost" : "Retry connection"}
        </Button>
      )}
    </div>
  );
}
