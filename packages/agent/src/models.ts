import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createMinimax } from "vercel-minimax-ai-provider";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import type { AgentProvider } from "@openade/shared";

export type LlmProvider = "anthropic" | "openai" | "minimax" | "moonshot";

export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M?: number;
  cacheWritePer1M?: number;
};

export type ModelDef = {
  value: string;
  label: string;
  llmProvider: LlmProvider;
  apiModelId: string;
  uiProvider: AgentProvider;
  contextWindowTokens: number;
  maxOutputTokens: number;
  pricing: ModelPricing;
};

const MODELS_DEV_URL = "https://models.dev/api.json";
const MODELS_DEV_CACHE_TTL = 24 * 60 * 60 * 1000;

const SUPPORTED_PROVIDERS: LlmProvider[] = ["anthropic", "openai", "minimax", "moonshot"];

const PROVIDER_MAP: Record<LlmProvider, string> = {
  anthropic: "anthropic",
  openai: "openai",
  minimax: "minimax",
  moonshot: "moonshotai",
};

const UI_PROVIDER_MAP: Record<LlmProvider, AgentProvider> = {
  anthropic: "claude",
  openai: "codex",
  minimax: "minimax",
  moonshot: "moonshot",
};

type ModelsDevModel = {
  id: string;
  name?: string;
  tool_call?: boolean;
  modalities?: { input?: string[] };
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  limit?: { context?: number; output?: number };
};

type ModelsDevProvider = {
  id: string;
  models: Record<string, ModelsDevModel>;
};

type ModelsDevData = Record<string, ModelsDevProvider>;

let cachedModelsDevData: ModelsDevData | null = null;
let cacheTimestamp = 0;

async function fetchModelsDevData(): Promise<ModelsDevData | null> {
  if (cachedModelsDevData && Date.now() - cacheTimestamp < MODELS_DEV_CACHE_TTL) {
    console.log("[models] Using cached models.dev data");
    return cachedModelsDevData;
  }
  try {
    console.log("[models] Fetching from models.dev...");
    const response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) {
      console.log("[models] Fetch failed:", response.status, response.statusText);
      return cachedModelsDevData;
    }
    const data = await response.json() as ModelsDevData;
    cachedModelsDevData = data;
    cacheTimestamp = Date.now();
    const providerCount = Object.keys(data).length;
    console.log("[models] Fetched OK, providers:", providerCount);
    return data;
  } catch (err) {
    console.log("[models] Fetch error:", err);
    return cachedModelsDevData;
  }
}

function isChatModel(m: ModelsDevModel): boolean {
  if (m.tool_call !== true) return false;
  const input = m.modalities?.input ?? [];
  return input.includes("text");
}

function buildModelsFromDev(data: ModelsDevData): ModelDef[] {
  const out: ModelDef[] = [];

  for (const llmProvider of SUPPORTED_PROVIDERS) {
    const providerKey = PROVIDER_MAP[llmProvider];
    const provider = data[providerKey];
    if (!provider?.models) continue;

    const uiProvider = UI_PROVIDER_MAP[llmProvider];

    for (const [apiModelId, m] of Object.entries(provider.models)) {
      if (!isChatModel(m)) continue;

      const cost = m.cost ?? {};
      const limit = m.limit ?? {};
      out.push({
        value: apiModelId,
        label: m.name ?? apiModelId,
        llmProvider,
        apiModelId,
        uiProvider,
        contextWindowTokens: limit.context ?? 128_000,
        maxOutputTokens: limit.output ?? 64_000,
        pricing: {
          inputPer1M: cost.input ?? 1,
          outputPer1M: cost.output ?? 4,
          cacheReadPer1M: cost.cache_read,
          cacheWritePer1M: cost.cache_write,
        },
      });
    }
  }

  out.sort((a, b) => {
    const order = { anthropic: 0, openai: 1, minimax: 2, moonshot: 3 } as Record<LlmProvider, number>;
    if (order[a.llmProvider] !== order[b.llmProvider]) return order[a.llmProvider] - order[b.llmProvider];
    return a.label.localeCompare(b.label);
  });

  return out;
}

const FALLBACK_MODELS: ModelDef[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", llmProvider: "anthropic", apiModelId: "claude-sonnet-4-6", uiProvider: "claude", contextWindowTokens: 200_000, maxOutputTokens: 64_000, pricing: { inputPer1M: 3, outputPer1M: 15 } },
  { value: "gpt-5.2", label: "GPT-5.2", llmProvider: "openai", apiModelId: "gpt-5.2", uiProvider: "codex", contextWindowTokens: 400_000, maxOutputTokens: 128_000, pricing: { inputPer1M: 1.75, outputPer1M: 14 } },
];

const MODELS: ModelDef[] = [...FALLBACK_MODELS];

export { MODELS };

export async function refreshModelPricing(): Promise<void> {
  const data = await fetchModelsDevData();
  if (!data) {
    console.log("[models] No data, keeping fallback");
    return;
  }

  const built = buildModelsFromDev(data);
  if (built.length > 0) {
    MODELS.splice(0, MODELS.length, ...built);
    console.log("[models] Loaded", built.length, "models from models.dev");
  } else {
    console.log("[models] buildModelsFromDev returned 0, keeping fallback");
  }
}

import type { AgentLogger } from "./logger.js";

export type AgentBackendConfig = {
  getApiKey: () => string | null;
  getCodexApiKey: () => string | null;
  getMinimaxApiKey: () => string | null;
  getMoonshotApiKey: () => string | null;
  getMoonshotBaseUrl?: () => string | null;
  logger?: AgentLogger;
};

export function getCheapModel(primaryModel: ModelDef): ModelDef {
  const sameProvider = MODELS.filter(m => m.llmProvider === primaryModel.llmProvider);
  return sameProvider.reduce((cheapest, m) =>
    m.pricing.inputPer1M < cheapest.pricing.inputPer1M ? m : cheapest
  , primaryModel);
}

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
  if (provider === "moonshot") {
    const key = config.getMoonshotApiKey();
    if (!key) throw new Error("Moonshot API key not set. Configure it in Settings → Authentication.");
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
  if (modelDef.llmProvider === "moonshot") {
    const baseURL = config.getMoonshotBaseUrl?.() ?? undefined;
    return createMoonshotAI({ apiKey, baseURL })(modelDef.apiModelId);
  }
  return createOpenAI({ apiKey })(modelDef.apiModelId);
}
