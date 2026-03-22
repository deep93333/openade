const DEFAULT_ORIGINS = [
  "http://127.0.0.1:3010",
  "http://localhost:3010",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://tryade.dev",
  "https://www.tryade.dev",
];

export function getCorsAllowedOrigins(): string[] {
  const raw =
    process.env.OPENADE_CORS_ORIGINS?.trim() || process.env.AGENTIDE_CORS_ORIGINS?.trim();
  const extra = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return [...new Set([...DEFAULT_ORIGINS, ...extra])];
}
