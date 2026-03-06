import type { AgentProvider } from "./types.js";

const MODEL_PROVIDER_MAP: Record<string, AgentProvider> = {
  "claude-sonnet-4-6": "claude",
  "claude-opus-4-6": "claude",
  "claude-haiku-4-5": "claude",
  "claude-sonnet-4-20250514": "claude",
  "gpt-5.2": "codex",
  "gpt-5-mini": "codex",
  "gpt-5.2-codex": "codex",
  "gpt-5.3-codex": "codex",
  "gpt-5.4-2026-03-05": "codex",
  "gpt-5.1-codex-mini": "codex",
  "minimax-m2": "minimax",
  "minimax-m2.1": "minimax",
  "minimax-m2.1-lightning": "minimax",
  "minimax-m2.5": "minimax",
};

export function getProviderForModel(modelValue: string | undefined): AgentProvider | undefined {
  if (!modelValue) return undefined;
  return MODEL_PROVIDER_MAP[modelValue];
}
