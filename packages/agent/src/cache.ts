import type { ModelMessage, JSONValue, LanguageModel } from "ai";

const DEFAULT_PROVIDER_OPTIONS = {
  anthropic: { cacheControl: { type: "ephemeral" } },
} satisfies Record<string, Record<string, JSONValue>>;

function isAnthropicModel(model: LanguageModel): boolean {
  if (typeof model === "string") {
    return model.includes("anthropic") || model.includes("claude");
  }
  return (
    model.provider === "anthropic" ||
    model.provider.includes("anthropic") ||
    model.modelId.includes("anthropic") ||
    model.modelId.includes("claude")
  );
}

function withProviderOptions(
  message: ModelMessage,
  providerOptions: Record<string, Record<string, JSONValue>>,
): ModelMessage {
  return {
    ...message,
    providerOptions: {
      ...message.providerOptions,
      ...providerOptions,
    },
  };
}

function countStablePrefixMessages(messages: ModelMessage[]): number {
  let stableCount = 0;

  for (const message of messages) {
    if (message.role !== "assistant" && message.role !== "user") break;
    stableCount++;
  }

  return stableCount;
}

export function addCacheControl({
  messages,
  model,
  providerOptions = DEFAULT_PROVIDER_OPTIONS,
}: {
  messages: ModelMessage[];
  model: LanguageModel;
  providerOptions?: Record<string, Record<string, JSONValue>>;
}): ModelMessage[] {
  if (messages.length === 0) return messages;
  if (!isAnthropicModel(model)) return messages;

  const stablePrefixCount = countStablePrefixMessages(messages);
  if (stablePrefixCount === 0) return messages;

  return messages.map((message, index) => {
    if (index >= stablePrefixCount) return message;
    return withProviderOptions(message, providerOptions);
  });
}
