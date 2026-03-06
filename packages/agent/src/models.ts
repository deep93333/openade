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
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6", llmProvider: "anthropic", apiModelId: "claude-sonnet-4-6", uiProvider: "claude" },
  { value: "claude-opus-4-6", label: "Opus 4.6", llmProvider: "anthropic", apiModelId: "claude-opus-4-6", uiProvider: "claude" },
  { value: "claude-haiku-4-5", label: "Haiku 4.5", llmProvider: "anthropic", apiModelId: "claude-haiku-4-5-20251001", uiProvider: "claude" },
  {
    value: "gpt-5.2", label: "GPT-5.2", llmProvider: "openai", apiModelId: "gpt-5.2", uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000, outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5-mini", label: "GPT-5 Mini", llmProvider: "openai", apiModelId: "gpt-5-mini", uiProvider: "codex",
    inputPricePer1k: 0.25 / 1000, outputPricePer1k: 2 / 1000,
  },
  {
    value: "gpt-5.2-codex", label: "Codex 5.2", llmProvider: "openai", apiModelId: "gpt-5.2-codex", uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000, outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5.3-codex", label: "Codex 5.3", llmProvider: "openai", apiModelId: "gpt-5.3-codex", uiProvider: "codex",
    inputPricePer1k: 1.75 / 1000, outputPricePer1k: 14 / 1000,
  },
  {
    value: "gpt-5.4-2026-03-05", label: "GPT 5.4", llmProvider: "openai", apiModelId: "gpt-5.4-2026-03-05", uiProvider: "codex",
    inputPricePer1k: 2.5 / 1000, outputPricePer1k: 15 / 1000,
  },
  {
    value: "gpt-5.1-codex-mini", label: "Codex 5.1 Mini", llmProvider: "openai", apiModelId: "gpt-5.1-codex-mini", uiProvider: "codex",
    inputPricePer1k: 0.25 / 1000, outputPricePer1k: 2 / 1000,
  },
  { value: "minimax-m2.5", label: "MiniMax M2.5", llmProvider: "minimax", apiModelId: "MiniMax-M2.5", uiProvider: "minimax" },
];

import type { AgentLogger } from "./logger.js";

export type AgentBackendConfig = {
  getApiKey: () => string | null;
  getCodexApiKey: () => string | null;
  getMinimaxApiKey: () => string | null;
  logger?: AgentLogger;
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
