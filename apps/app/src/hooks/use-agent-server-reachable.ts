import { useCallback, useEffect, useState } from "react";
import { withAgentFetchInit } from "@/lib/agent-fetch";
import { getBackendBaseUrl } from "@/lib/backend-url";
import { isElectron } from "@/lib/electron";
import { primeLocalNetworkPermission } from "@/lib/prime-local-network-permission";

type CheckMode = "initial" | "retry" | "background";

async function probeHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, withAgentFetchInit({ method: "GET" }));
    if (!res.ok) return false;
    const j = (await res.json()) as { ok?: unknown };
    return j.ok === true;
  } catch {
    return false;
  }
}

export function useAgentServerReachable() {
  const [ready, setReady] = useState(() => isElectron());
  const [checking, setChecking] = useState(() => !isElectron());
  const baseUrl = getBackendBaseUrl();

  const runCheck = useCallback(
    async (mode: CheckMode) => {
      if (isElectron()) {
        setReady(true);
        setChecking(false);
        return;
      }
      if (mode === "initial" || mode === "retry") setChecking(true);
      const ok = await probeHealth(baseUrl);
      setReady(ok);
      if (mode === "initial" || mode === "retry") setChecking(false);
    },
    [baseUrl]
  );

  useEffect(() => {
    if (isElectron()) {
      setReady(true);
      setChecking(false);
      return;
    }
    void runCheck("initial");
  }, [baseUrl, runCheck]);

  useEffect(() => {
    if (isElectron()) return;
    const ms = ready ? 30000 : 2500;
    const id = setInterval(() => void runCheck("background"), ms);
    return () => clearInterval(id);
  }, [ready, baseUrl, runCheck]);

  const recheck = useCallback(() => {
    primeLocalNetworkPermission();
    void runCheck("retry");
  }, [runCheck]);

  return { ready, checking, backendUrl: baseUrl, recheck };
}
