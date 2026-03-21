# Files and Search

## find.text()

Search for text in files.

```typescript
const results = await client.find.text({
  query: { pattern: "function.*opencode" },
});
```

Returns array of match objects: `path`, `lines`, `line_number`, `absolute_offset`, `submatches`.

## find.files()

Find files and directories by name.

```typescript
const files = await client.find.files({
  query: { query: "*.ts", type: "file" },
});

const dirs = await client.find.files({
  query: { query: "packages", type: "directory", limit: 20 },
});
```

### Query Fields

| Field | Type | Description |
|-------|------|-------------|
| query | string | Search string (fuzzy match) |
| type | "file" \| "directory" | Limit results |
| directory | string | Override project root |
| limit | number | Max results (1–200) |

Returns `string[]` (paths).

## find.symbols()

Find workspace symbols.

```typescript
const symbols = await client.find.symbols({ query: "..." });
```

Returns `Symbol[]`.

## file.read()

Read file content.

```typescript
const content = await client.file.read({
  query: { path: "src/index.ts" },
});
```

Returns `{ type: "raw" | "patch", content: string }`.

## file.status()

Get status for tracked files.

```typescript
const status = await client.file.status({ query: {} });
```

Returns `File[]`.
