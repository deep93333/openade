import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createMinimax } from "vercel-minimax-ai-provider";
import type { AgentProvider } from "@agentide/shared";

export type LlmProvider = "anthropic" | "openai" | "minimax";

export type ModelDef = {
  value: string;
  label: string;
  llmProvider: LlmProvider;
  apiModelId: string;
  uiProvider: AgentProvider;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
};

export const MODELS: ModelDef[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", llmProvider: "anthropic", apiModelId: "claude-sonnet-4-6", uiProvider: "claude" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", llmProvider: "anthropic", apiModelId: "claude-opus-4-6", uiProvider: "claude" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", llmProvider: "anthropic", apiModelId: "claude-haiku-4-5-20251001", uiProvider: "claude" },
  {
    value: "gpt-5.2", label: "GPT-5.2", llmProvider: "openai", apiModelId: "gpt-5.2", uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000, outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5-mini", label: "GPT-5 Mini", llmProvider: "openai", apiModelId: "gpt-5-mini", uiProvider: "codex",
    inputPricePer1k: 0.25 / 1000, outputPricePer1k: 2 / 1000,
  },
  {
    value: "gpt-5.2-codex", label: "GPT-5.2 Codex", llmProvider: "openai", apiModelId: "gpt-5.2-codex", uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000, outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5.3-codex", label: "GPT-5.3 Codex", llmProvider: "openai", apiModelId: "gpt-5.3-codex", uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000, outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini", llmProvider: "openai", apiModelId: "gpt-5.1-codex-mini", uiProvider: "codex",
    inputPricePer1k: 0.25 / 1000, outputPricePer1k: 2 / 1000,
  },
  { value: "minimax-m2", label: "MiniMax M2", llmProvider: "minimax", apiModelId: "MiniMax-M2", uiProvider: "minimax" },
  { value: "minimax-m2.1", label: "MiniMax M2.1", llmProvider: "minimax", apiModelId: "MiniMax-M2.1", uiProvider: "minimax" },
  { value: "minimax-m2.1-lightning", label: "MiniMax M2.1 Lightning", llmProvider: "minimax", apiModelId: "MiniMax-M2.1-lightning", uiProvider: "minimax" },
  { value: "minimax-m2.5", label: "MiniMax M2.5", llmProvider: "minimax", apiModelId: "MiniMax-M2.5", uiProvider: "minimax" },
];

export type AgentBackendConfig = {
  getApiKey: () => string | null;
  getCodexApiKey: () => string | null;
  getMinimaxApiKey: () => string | null;
  writeAgentLog?: (level: "INFO" | "WARN" | "ERROR", source: string, ...args: unknown[]) => void;
};

export function resolveModel(modelValue: string | undefined): ModelDef {
  if (!modelValue) return MODELS[0];
  return MODELS.find((m) => m.value === modelValue) ?? MODELS[0];
}

export function resolveModelForProvider(modelValue: string | undefined, provider: AgentProvider | undefined): ModelDef {
  if (modelValue) return resolveModel(modelValue);
  if (provider) return MODELS.find((m) => m.uiProvider === provider) ?? MODELS[0];
  return MODELS[0];
}


function getProviderApiKey(provider: LlmProvider, config: AgentBackendConfig): string {
  if (provider === "anthropic") {
    const key = config.getApiKey();
    if (!key) throw new Error("Anthropic API key not set. Configure it in Settings → Authentication.");
    return key;
  }
  if (provider === "minimax") {
    const key = config.getMinimaxApiKey();
    if (!key) throw new Error("MiniMax API key not set. Configure it in Settings → Authentication.");
    return key;
  }
  const key = config.getCodexApiKey();
  if (!key) throw new Error("OpenAI API key not set. Configure it in Settings → Authentication (Codex).");
  return key;
}

export function createLanguageModel(modelDef: ModelDef, config: AgentBackendConfig): LanguageModel {
  const apiKey = getProviderApiKey(modelDef.llmProvider, config);
  if (modelDef.llmProvider === "anthropic") {
    return createAnthropic({ apiKey })(modelDef.apiModelId);
  }
  if (modelDef.llmProvider === "minimax") {
    return createMinimax({ apiKey })(modelDef.apiModelId);
  }
  return createOpenAI({ apiKey })(modelDef.apiModelId);
}
