import type { AgentProvider } from "./types.js";

export function getProviderForModel(
  modelValue: string | undefined,
  models?: { value: string; provider: AgentProvider }[],
): AgentProvider | undefined {
  if (!modelValue) return undefined;
  if (models?.length) {
    const m = models.find((x) => x.value === modelValue);
    if (m) return m.provider;
  }
  return undefined;
}
