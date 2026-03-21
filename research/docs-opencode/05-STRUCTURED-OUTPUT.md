# Structured Output

Request validated JSON from the model using a JSON schema.

## Basic Usage

```typescript
const result = await client.session.prompt({
  path: { id: sessionId },
  body: {
    parts: [{ type: "text", text: "Research Anthropic and provide company info" }],
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          company: { type: "string", description: "Company name" },
          founded: { type: "number", description: "Year founded" },
          products: {
            type: "array",
            items: { type: "string" },
            description: "Main products",
          },
        },
        required: ["company", "founded"],
      },
    },
  },
});

console.log(result.data.info.structured_output);
// { company: "Anthropic", founded: 2021, products: ["Claude", "Claude API"] }
```

## Format Types

| Type | Description |
|------|-------------|
| text | Default. Standard text response |
| json_schema | Returns validated JSON matching schema |

## JSON Schema Format

| Field | Type | Description |
|-------|------|-------------|
| type | 'json_schema' | Required |
| schema | object | JSON Schema object |
| retryCount | number | Validation retries (default: 2) |

## Error Handling

On validation failure after retries:

```typescript
if (result.data.info.error?.name === "StructuredOutputError") {
  console.error("Failed:", result.data.info.error.message);
  console.error("Attempts:", result.data.info.error.retries);
}
```

## Best Practices

1. Provide clear descriptions in schema properties
2. Use `required` for mandatory fields
3. Keep schemas focused; complex nesting is harder for the model
4. Adjust `retryCount`: increase for complex schemas, decrease for simple ones
