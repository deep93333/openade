import { OPENADE_AGENT_DEFAULT_ORIGIN } from "@openade/shared";

export function getBackendBaseUrl(): string {
  const raw = import.meta.env.VITE_AGENT_SERVER_URL;
  if (typeof raw === "string" && raw.trim()) return raw.replace(/\/+$/, "");
  return OPENADE_AGENT_DEFAULT_ORIGIN;
}
