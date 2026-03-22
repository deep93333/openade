import { getBackendBaseUrl } from "@/lib/backend-url";
import { isElectron } from "@/lib/electron";

function isLoopbackAgentHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

export function withAgentFetchInit(init?: RequestInit): RequestInit {
  if (isElectron()) return { ...init };
  if (typeof window === "undefined") return { ...init };
  if (window.location.protocol !== "https:") return { ...init };
  try {
    const u = new URL(getBackendBaseUrl());
    if (!isLoopbackAgentHost(u.hostname)) return { ...init };
  } catch {
    return { ...init };
  }
  return {
    ...init,
    targetAddressSpace: "loopback",
  } as RequestInit;
}
