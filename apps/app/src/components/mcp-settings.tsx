import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { MCPServerConfig, MCPValidationResult } from "@agentide/shared";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@agentide/ui";
import { IconCheck, IconPlayerPlay, IconPlugConnected, IconTerminal2 } from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";

const PLACEHOLDER = JSON.stringify(
  {
    mcpServers: {
      filesystem: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      },
      "my-http-server": {
        url: "http://localhost:3000/mcp",
        headers: { Authorization: "Bearer my-token" },
      },
      "my-sse-server": {
        url: "http://localhost:3000/sse",
      },
    },
  },
  null,
  2,
);

type ServersMap = Record<string, Omit<MCPServerConfig, "id" | "name" | "type"> & { name?: string; type?: MCPServerConfig["type"] }>;

function inferMCPServerType(entry: Record<string, unknown>): MCPServerConfig["type"] | null {
  if (typeof entry.command === "string" && entry.command.trim()) return "stdio";
  if (typeof entry.url !== "string" || !entry.url.trim()) return null;

  try {
    const url = new URL(entry.url);
    const path = url.pathname.toLowerCase();
    if (path.endsWith("/sse") || path.includes("/sse/")) return "sse";
  } catch {
    if (entry.url.toLowerCase().includes("/sse")) return "sse";
  }

  return "http";
}

function serialize(servers: MCPServerConfig[]): string {
  const map: ServersMap = {};
  for (const server of servers) {
    const { id, name, type: _type, ...rest } = server as MCPServerConfig & { id?: string; name?: string };
    map[name ?? id ?? crypto.randomUUID()] = rest;
  }
  return JSON.stringify({ mcpServers: map }, null, 2);
}

function parse(raw: string): { configs: MCPServerConfig[]; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { configs: [], error: "Invalid JSON." };
  }

  if (typeof parsed !== "object" || parsed === null || !("mcpServers" in parsed)) {
    return { configs: [], error: 'Root object must have an "mcpServers" key.' };
  }

  const map = (parsed as { mcpServers: unknown }).mcpServers;
  if (typeof map !== "object" || map === null || Array.isArray(map)) {
    return { configs: [], error: '"mcpServers" must be an object mapping server names to configs.' };
  }

  const configs: MCPServerConfig[] = [];
  for (const [name, raw] of Object.entries(map as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null) {
      return { configs: [], error: `Server "${name}": must be an object.` };
    }
    const entry = raw as Record<string, unknown>;
    const explicitType = entry.type;
    const type =
      explicitType === "stdio" || explicitType === "http" || explicitType === "sse"
        ? explicitType
        : explicitType === undefined
          ? inferMCPServerType(entry)
          : null;

    if (!type) {
      return {
        configs: [],
        error:
          `Server "${name}": unable to infer transport. Provide "command" for stdio or "url" for http/sse,` +
          ' or set an explicit "type" of "stdio", "http", or "sse".',
      };
    }

    if (type === "stdio") {
      if (typeof entry.command !== "string" || !entry.command.trim()) {
        return { configs: [], error: `Server "${name}": "command" is required for stdio transport.` };
      }
      configs.push({
        id: crypto.randomUUID(),
        name,
        type: "stdio",
        command: entry.command,
        args: Array.isArray(entry.args) ? (entry.args.filter((value): value is string => typeof value === "string")) : undefined,
        env:
          entry.env && typeof entry.env === "object" && !Array.isArray(entry.env)
            ? Object.fromEntries(
                Object.entries(entry.env).filter((pair): pair is [string, string] => typeof pair[1] === "string")
              )
            : undefined,
        cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      });
      continue;
    }

    if (typeof entry.url !== "string" || !entry.url.trim()) {
      return { configs: [], error: `Server "${name}": "url" is required for ${type} transport.` };
    }
    configs.push({
      id: crypto.randomUUID(),
      name,
      type,
      url: entry.url,
      headers:
        entry.headers && typeof entry.headers === "object" && !Array.isArray(entry.headers)
          ? Object.fromEntries(
              Object.entries(entry.headers).filter((pair): pair is [string, string] => typeof pair[1] === "string")
            )
          : undefined,
    });
  }

  return { configs, error: null };
}

function transportSummary(server: MCPServerConfig): string {
  if (server.type === "stdio") {
    const args = server.args?.length ? ` ${server.args.join(" ")}` : "";
    return `${server.command}${args}`;
  }
  return server.url;
}

export function MCPSettings() {
  const api = getElectronAPI();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<MCPValidationResult | null>(null);

  const loadSettings = useCallback(async () => {
    if (!api?.settings) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    const result = await api.settings.get();
    if (!result.success || !result.data) {
      setError(result.error ?? "Failed to load MCP settings.");
      setLoading(false);
      return;
    }
    setText(serialize(result.data.mcpServers));
    setValidation(null);
    setLoading(false);
  }, [api]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const formatEditor = useCallback(async () => {
    await editorRef.current?.getAction("editor.action.formatDocument")?.run();
  }, []);

  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleTest = useCallback(async () => {
    if (!api?.settings) return;
    setError(null);
    setValidation(null);

    const trimmed = text.trim();
    const { configs, error: parseError } = trimmed ? parse(trimmed) : { configs: [], error: null };
    if (parseError) {
      setError(parseError);
      return;
    }

    setTesting(true);
    const result = await api.settings.validateMcpServers(configs);
    setTesting(false);

    if (!result.success || !result.data) {
      setError(result.error ?? "Failed to connect to MCP servers.");
      return;
    }

    setValidation(result.data);
  }, [api, text]);

  const handleSave = async () => {
    if (!api?.settings) return;
    setError(null);
    setSaved(false);

    const trimmed = text.trim();
    if (!trimmed) {
      const payload = { mcpServers: [] };
      setSaving(true);
      const result = await api.settings.set(payload);
      setSaving(false);
      if (!result.success) {
        setError(result.error ?? "Failed to save MCP settings.");
        return;
      }
      setText(serialize(payload.mcpServers));
      setValidation({ servers: [], warnings: [] });
      await formatEditor();
      setSaved(true);
      return;
    }

    const { configs, error: parseError } = parse(trimmed);
    if (parseError) {
      setError(parseError);
      return;
    }

    setSaving(true);
    const payload = { mcpServers: configs };
    const result = await api.settings.set(payload);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to save MCP settings.");
      return;
    }

    setText(serialize(configs));
    await formatEditor();
    setSaved(true);
  };

  const parsedForPreview = text.trim() ? parse(text) : { configs: [], error: null };
  const previewServers = parsedForPreview.error ? [] : parsedForPreview.configs;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">MCP Servers</h3>
        <p className="text-xs text-muted-foreground">
          JSON is the source of truth, like Cursor and Claude Desktop. Use <code className="rounded bg-muted px-1 font-mono text-[11px]">mcpServers</code>{" "}
          keys as server names, then test before saving to confirm the desktop app can actually reach and launch them.
        </p>
      </div>

      <Alert>
        <IconTerminal2 className="h-4 w-4" />
        <AlertTitle>Stdio runs local commands</AlertTitle>
        <AlertDescription>
          For stdio servers, the desktop app launches the configured command directly. That means tools like <code className="rounded bg-muted px-1 font-mono text-[11px]">node</code>,{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">npx</code>, or <code className="rounded bg-muted px-1 font-mono text-[11px]">bunx</code> must already work on your machine and be available on PATH.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && <p className="text-xs text-emerald-600">Settings saved.</p>}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 overflow-hidden rounded-md border border-input bg-background">
          <Editor
            height="100%"
            defaultLanguage="json"
            value={text}
            onMount={handleEditorDidMount}
            onChange={(value) => {
              setText(value ?? "");
              setError(null);
              setValidation(null);
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              formatOnPaste: true,
              formatOnType: true,
              tabSize: 2,
              insertSpaces: true,
              padding: { top: 12, bottom: 12 },
            }}
            beforeMount={(monaco) => {
              monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                allowComments: false,
                trailingCommas: "error",
                schemaValidation: "error",
                enableSchemaRequest: false,
                schemas: [],
              });
            }}
            loading={<div className="px-3 py-3 font-mono text-xs text-muted-foreground">Loading editor…</div>}
          />
        </div>

        <div className="space-y-4 overflow-y-auto">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-sm">Config preview</CardTitle>
              <CardDescription className="text-xs">
                Parsed servers from the current JSON before save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewServers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No servers configured.</p>
              ) : (
                previewServers.map((server) => (
                  <div key={server.id} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{server.name}</span>
                      <Badge variant="secondary" size="sm">
                        {server.type}
                      </Badge>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground break-all">{transportSummary(server)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-sm">Connection test</CardTitle>
              <CardDescription className="text-xs">
                Verifies MCP servers can start/connect and lists the tools each one exposes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="button" variant="outline" className="w-full" onClick={() => void handleTest()} disabled={loading || saving || testing}>
                <IconPlayerPlay className="mr-2 size-4" />
                {testing ? "Testing…" : "Test MCP servers"}
              </Button>

              {validation && validation.servers.length === 0 && validation.warnings.length === 0 && (
                <p className="text-xs text-muted-foreground">No servers to test.</p>
              )}

              {validation?.warnings.length ? (
                <Alert>
                  <AlertTitle>Notes</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {validation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              {validation?.servers.map((server) => (
                <div key={`${server.name}-${server.type}`} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <IconPlugConnected className="size-4 text-emerald-600" />
                    <span className="truncate text-sm font-medium">{server.name}</span>
                    <Badge variant="secondary" size="sm">
                      {server.type}
                    </Badge>
                    <Badge variant="outline" size="sm">
                      {server.toolCount} tools
                    </Badge>
                  </div>
                  {server.toolNames.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {server.toolNames.map((toolName) => (
                        <Badge key={toolName} variant="outline" size="sm">
                          {toolName}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Connected, but the server returned no tools.</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <p className="text-xs text-muted-foreground">
          Tip: run Test first for stdio servers to catch missing local commands before the next agent run.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => void loadSettings().then(() => formatEditor())} disabled={loading || saving || testing}>
            Reset
          </Button>
          <Button type="button" variant="outline" onClick={() => void formatEditor()} disabled={loading || saving || testing}>
            Format
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={loading || saving || testing}>
            {saving ? (
              "Saving..."
            ) : saved ? (
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="size-4" /> Saved
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
