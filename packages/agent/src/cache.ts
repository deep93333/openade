import type { ModelMessage, JSONValue, LanguageModel } from "ai";

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

export function addCacheControl({
  messages,
  model,
  providerOptions = {
    anthropic: { cacheControl: { type: "ephemeral" } },
  },
}: {
  messages: ModelMessage[];
  model: LanguageModel;
  providerOptions?: Record<string, Record<string, JSONValue>>;
}): ModelMessage[] {
  if (messages.length === 0) return messages;
  if (!isAnthropicModel(model)) return messages;

  return messages.map((message, index) => {
    if (index === messages.length - 1) {
      return {
        ...message,
        providerOptions: {
          ...message.providerOptions,
          ...providerOptions,
        },
      };
    }
    return message;
  });
}
