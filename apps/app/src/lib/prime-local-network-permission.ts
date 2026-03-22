import { isElectron } from "./electron";

type PermissionDescriptorWithName = PermissionDescriptor & { name: string };

const LNA_QUERY_NAMES = ["local-network-access", "loopback-network", "local-network"] as const;

export function primeLocalNetworkPermission(): void {
  if (isElectron()) return;
  if (typeof window === "undefined" || window.location.protocol !== "https:") return;
  const pm = navigator.permissions;
  if (!pm?.query) return;
  for (const name of LNA_QUERY_NAMES) {
    const desc = { name } as PermissionDescriptorWithName;
    void pm.query(desc).catch(() => {});
  }
}
