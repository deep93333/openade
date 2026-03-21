export function getBackendBaseUrl(): string {
  const raw = import.meta.env.VITE_AGENT_SERVER_URL;
  if (typeof raw === "string" && raw.trim()) return raw.replace(/\/+$/, "");
  return "http://127.0.0.1:42891";
}
