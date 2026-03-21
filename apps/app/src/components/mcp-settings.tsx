import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { MCPServerConfig, MCPValidationResult } from "@agentide/shared";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
} from "@agentide/ui";
import {
  IconAlertTriangle,
  IconCheck,
  IconCode,
  IconList,
  IconPlayerPlay,
  IconPlugConnected,
  IconPlus,
  IconRefresh,
  IconServer,
  IconTerminal2,
  IconTrash,
  IconWifi,
} from "@tabler/icons-react";
import { getElectronAPI } from "@/lib/electron";

/* -------------------------------------------------------------------------- */
/* Constants                                                                    */
/* -------------------------------------------------------------------------- */

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
    },
  },
  null,
  2
);

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

type ViewMode = "list" | "json";

type ServersMap = Record<
  string,
  Omit<MCPServerConfig, "id" | "name" | "type"> & {
    name?: string;
    type?: MCPServerConfig["type"];
  }
>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function inferMCPServerType(
  entry: Record<string, unknown>
): MCPServerConfig["type"] | null {
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
    const {
      id,
      name,
      type: _type,
      ...rest
    } = server as MCPServerConfig & { id?: string; name?: string };
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

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("mcpServers" in parsed)
  ) {
    return {
      configs: [],
      error: 'Root object must have an "mcpServers" key.',
    };
  }

  const map = (parsed as { mcpServers: unknown }).mcpServers;
  if (typeof map !== "object" || map === null || Array.isArray(map)) {
    return {
      configs: [],
      error: '"mcpServers" must be an object mapping server names to configs.',
    };
  }

  const configs: MCPServerConfig[] = [];
  for (const [name, raw] of Object.entries(map as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null) {
      return { configs: [], error: `Server "${name}": must be an object.` };
    }
    const entry = raw as Record<string, unknown>;
    const explicitType = entry.type;
    const type =
      explicitType === "stdio" ||
      explicitType === "http" ||
      explicitType === "sse"
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
        return {
          configs: [],
          error: `Server "${name}": "command" is required for stdio transport.`,
        };
      }
      configs.push({
        id: crypto.randomUUID(),
        name,
        type: "stdio",
        command: entry.command,
        args: Array.isArray(entry.args)
          ? entry.args.filter(
              (value): value is string => typeof value === "string"
            )
          : undefined,
        env:
          entry.env &&
          typeof entry.env === "object" &&
          !Array.isArray(entry.env)
            ? Object.fromEntries(
                Object.entries(entry.env).filter(
                  (pair): pair is [string, string] =>
                    typeof pair[1] === "string"
                )
              )
            : undefined,
        cwd: typeof entry.cwd === "string" ? entry.cwd : undefined,
      });
      continue;
    }

    if (typeof entry.url !== "string" || !entry.url.trim()) {
      return {
        configs: [],
        error: `Server "${name}": "url" is required for ${type} transport.`,
      };
    }
    configs.push({
      id: crypto.randomUUID(),
      name,
      type,
      url: entry.url,
      headers:
        entry.headers &&
        typeof entry.headers === "object" &&
        !Array.isArray(entry.headers)
          ? Object.fromEntries(
              Object.entries(entry.headers).filter(
                (pair): pair is [string, string] => typeof pair[1] === "string"
              )
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

function transportIcon(type: MCPServerConfig["type"]) {
  if (type === "stdio") return <IconTerminal2 className="size-3.5" />;
  if (type === "sse") return <IconWifi className="size-3.5" />;
  return <IconServer className="size-3.5" />;
}

/* -------------------------------------------------------------------------- */
/* Main component                                                               */
/* -------------------------------------------------------------------------- */

export function MCPSettings() {
  const api = getElectronAPI();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<MCPValidationResult | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!api?.settings) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    setIsDirty(false);
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
    const timer = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const formatEditor = useCallback(async () => {
    await editorRef.current?.getAction("editor.action.formatDocument")?.run();
  }, []);

  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    setError(null);
    setValidation(null);
    setIsDirty(true);
  }, []);

  const handleTest = useCallback(async () => {
    if (!api?.settings) return;
    setError(null);
    setValidation(null);

    const trimmed = text.trim();
    const { configs, error: parseError } = trimmed
      ? parse(trimmed)
      : { configs: [], error: null };
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

  const handleSave = useCallback(async () => {
    if (!api?.settings) return;
    setError(null);
    setSaved(false);

    const trimmed = text.trim();
    if (!trimmed) {
      const payload = { mcpServers: [] as MCPServerConfig[] };
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
      setIsDirty(false);
      return;
    }

    const { configs, error: parseError } = parse(trimmed);
    if (parseError) {
      setError(parseError);
      return;
    }

    setSaving(true);
    const result = await api.settings.set({ mcpServers: configs });
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to save MCP settings.");
      return;
    }

    setText(serialize(configs));
    await formatEditor();
    setSaved(true);
    setIsDirty(false);
  }, [api, text, formatEditor]);

  const parsed = text.trim() ? parse(text) : { configs: [], error: null };
  const previewServers = parsed.error ? [] : parsed.configs;
  const isBusy = loading || saving || testing;

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              viewMode === "list"
                ? "text-foreground bg-secondary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            ].join(" ")}
          >
            <IconList className="size-3.5" />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setViewMode("json")}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              viewMode === "json"
                ? "text-foreground bg-secondary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            ].join(" ")}
          >
            <IconCode className="size-3.5" />
            JSON
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {isDirty && !saved && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <IconCheck className="size-3" />
              Saved
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void loadSettings().then(() => formatEditor())}
            disabled={isBusy}
            title="Reset to saved"
          >
            <IconRefresh className="size-3.5" />
            Reset
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => void handleTest()}
            disabled={isBusy}
          >
            <IconPlayerPlay className="size-3.5" />
            {testing ? "Testing…" : "Test"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => void handleSave()}
            disabled={isBusy}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <Alert variant="destructive" className="mb-3 py-2">
          <IconAlertTriangle className="size-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Validation warnings */}
      {validation?.warnings.length ? (
        <Alert className="mb-3 py-2">
          <AlertDescription>
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {validation.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {viewMode === "list" ? (
          <ListModeView
            servers={previewServers}
            parseError={parsed.error}
            validation={validation}
            onSwitchToJson={() => setViewMode("json")}
          />
        ) : (
          <JsonModeView
            text={text}
            onMount={handleEditorDidMount}
            onChange={handleTextChange}
            onFormat={() => void formatEditor()}
            isBusy={isBusy}
          />
        )}
      </div>

      {/* Footer hint */}
      <p className="mt-3 text-[11px] text-muted-foreground">
        JSON is the source of truth. Run{" "}
        <span className="font-medium">Test</span> before saving stdio servers to
        catch missing local commands.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* List mode                                                                    */
/* -------------------------------------------------------------------------- */

type ListModeViewProps = {
  servers: MCPServerConfig[];
  parseError: string | null;
  validation: MCPValidationResult | null;
  onSwitchToJson: () => void;
};

function ListModeView({
  servers,
  parseError,
  validation,
  onSwitchToJson,
}: ListModeViewProps) {
  if (parseError) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-6">
        <IconAlertTriangle className="size-8 text-destructive/70" />
        <div>
          <p className="text-sm font-medium">JSON parse error</p>
          <p className="text-xs text-muted-foreground mt-1">{parseError}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onSwitchToJson}>
          Fix in JSON editor
        </Button>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-6">
        <div className="size-10 flex items-center justify-center">
          <IconPlugConnected className="size-6 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-medium">No MCP servers configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add servers to give the agent access to external tools and data sources.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onSwitchToJson}>
          <IconPlus className="size-3.5 mr-1" />
          Add via JSON editor
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
      {servers.map((server) => {
        const health = validation?.servers.find((s) => s.name === server.name);
        const tested = validation !== null;

        return (
          <ServerRow
            key={server.id ?? server.name}
            server={server}
            health={health}
            tested={tested}
          />
        );
      })}
    </div>
  );
}

type ServerRowProps = {
  server: MCPServerConfig;
  health: MCPValidationResult["servers"][number] | undefined;
  tested: boolean;
};

function ServerRow({ server, health, tested }: ServerRowProps) {
  const statusColor = !tested
    ? "bg-muted-foreground/30"
    : health
      ? "bg-emerald-500"
      : "bg-destructive";

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-border/30 last:border-b-0 transition-colors">
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <span
          className={`size-2 rounded-full shrink-0 ${statusColor}`}
          title={
            !tested
              ? "Not tested"
              : health
                ? "Connected"
                : "Connection failed"
          }
        />

        {/* Name + transport */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{server.name}</span>
            <Badge variant="secondary" size="sm" className="flex items-center gap-1">
              {transportIcon(server.type)}
              {server.type}
            </Badge>
            {health && (
              <Badge variant="outline" size="sm">
                {health.toolCount} tools
              </Badge>
            )}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
            {transportSummary(server)}
          </p>
        </div>
      </div>

      {/* Tool names when available */}
      {health?.toolNames.length ? (
        <div className="flex flex-wrap gap-1 pl-5">
          {health.toolNames.map((t) => (
            <Badge key={t} variant="outline" size="sm" className="font-mono text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      ) : health && health.toolCount === 0 ? (
        <p className="pl-5 text-xs text-muted-foreground">
          Connected — no tools exposed.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* JSON mode                                                                    */
/* -------------------------------------------------------------------------- */

type JsonModeViewProps = {
  text: string;
  onMount: OnMount;
  onChange: (value: string) => void;
  onFormat: () => void;
  isBusy: boolean;
};

function JsonModeView({
  text,
  onMount,
  onChange,
  onFormat,
  isBusy,
}: JsonModeViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconTerminal2 className="size-3.5" />
          <span>
            Stdio servers launch commands locally — ensure{" "}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">
              node
            </code>
            ,{" "}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">
              npx
            </code>{" "}
            are on PATH.
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={onFormat}
          disabled={isBusy}
        >
          Format
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border bg-background">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={text}
          placeholder={PLACEHOLDER}
          onMount={onMount}
          onChange={(value) => onChange(value ?? "")}
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
          loading={
            <div className="px-3 py-3 font-mono text-xs text-muted-foreground">
              Loading editor…
            </div>
          }
        />
      </div>
    </div>
  );
}
