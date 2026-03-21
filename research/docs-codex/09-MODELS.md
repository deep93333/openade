# Models

Codex uses OpenAI models for reasoning and code generation.

## Recommended Models

| Model | Description |
|-------|-------------|
| **gpt-5.4** | Recommended. Flagship model; strong coding, reasoning, tool use, agentic workflows |
| **gpt-5.4-mini** | Fast, efficient for responsive tasks and subagents |
| **gpt-5.3-codex** | Industry-leading coding for complex engineering |
| **gpt-5.3-codex-spark** | Research preview; near-instant iteration (ChatGPT Pro) |

## Alternative Models

gpt-5.2-codex, gpt-5.2, gpt-5.1-codex-max, gpt-5.1, gpt-5.1-codex, gpt-5-codex, gpt-5-codex-mini, gpt-5. Codex works best with the recommended models above.

## Selecting

**Config**:
```toml
model = "gpt-5.4-mini"
```

**SDK**:
```typescript
new Codex({
  config: { model: "gpt-5.4-mini" }
});
```

## Reasoning Models

gpt-5.4 and gpt-5.4-mini support extended reasoning. Use for:

- Multi-step debugging
- Architecture decisions
- Complex refactors

## Cost

Pricing varies by model. Check [OpenAI Pricing](https://openai.com/api/pricing/) and [Codex Pricing](https://developers.openai.com/codex/pricing).

## Latest

See [Codex Changelog](https://developers.openai.com/codex/changelog) for new models and deprecations.
