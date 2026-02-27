import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useTerminalStore } from "@/store/terminal.store";
import { getElectronAPI } from "@/lib/electron";
import { cn } from "@/lib/cn";
import { Columns2Icon, PlusIcon, SquareIcon, XIcon } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@agentide/ui";

function resolveColor(cssVar: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  el.style.color = `var(${cssVar}, ${fallback})`;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  el.remove();
  const m = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return fallback;
  return `#${Number(m[1]).toString(16).padStart(2, "0")}${Number(m[2]).toString(16).padStart(2, "0")}${Number(m[3]).toString(16).padStart(2, "0")}`;
}

function getTerminalTheme() {
  const bg = resolveColor("--color-secondary", "#f0f0f1");
  const fg = resolveColor("--color-foreground", "#1c1917");
  return {
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: "#d6d3d180",
    black: "#1c1917",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#ca8a04",
    blue: "#2563eb",
    magenta: "#9333ea",
    cyan: "#0891b2",
    white: "#e7e5e4",
    brightBlack: "#78716c",
    brightRed: "#ef4444",
    brightGreen: "#22c55e",
    brightYellow: "#eab308",
    brightBlue: "#3b82f6",
    brightMagenta: "#a855f7",
    brightCyan: "#06b6d4",
    brightWhite: "#fafaf9",
  };
}

type TerminalSessionProps = {
  sessionId: string;
  visible: boolean;
  cwd?: string;
};

const TerminalSession = ({ sessionId, visible, cwd }: TerminalSessionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalIdRef = useRef<string | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const api = getElectronAPI();
    if (!container || !api?.terminal) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Geist Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.2,
      theme: getTerminalTheme(),
    });
    termRef.current = term;
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(container);
    term.focus();

    const safeFit = () => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        try { fitAddon.fit(); } catch {}
      }
    };
    const rafId = requestAnimationFrame(() => safeFit());

    const cols = Math.max(term.cols || 80, 80);
    const rows = Math.max(term.rows || 24, 24);
    let unsubData: (() => void) | null = null;

    api.terminal.create({ cwd, cols, rows }).then((res) => {
      if (!res.success || !res.data) return;
      terminalIdRef.current = res.data.terminalId;
      term.onData((data) => {
        const id = terminalIdRef.current;
        if (id) api.terminal.write(id, data);
      });
      unsubData = api.terminal.onData((payload) => {
        if (payload.terminalId !== terminalIdRef.current) return;
        term.write(payload.data);
      });
      term.focus();
    });

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
      const id = terminalIdRef.current;
      if (id && term.cols > 0 && term.rows > 0) {
        api.terminal.resize(id, term.cols, term.rows);
      }
    });
    resizeObserver.observe(container);

    return () => {
      termRef.current = null;
      fitAddonRef.current = null;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      unsubData?.();
      const id = terminalIdRef.current;
      if (id) api.terminal.destroy(id);
      terminalIdRef.current = null;
      term.dispose();
    };
  }, [sessionId, cwd]);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        try { fitAddonRef.current?.fit(); } catch {}
        termRef.current?.focus();
      });
    }
  }, [visible]);

  const focusTerminal = useCallback(() => {
    termRef.current?.focus();
  }, []);

  return (
    <div
      className={cn("h-full w-full min-h-0 flex-col overflow-hidden p-2", visible ? "flex" : "hidden")}
      onClick={focusTerminal}
      role="presentation"
      tabIndex={0}
    >
      <div ref={containerRef} className="h-full w-full min-h-[200px]" />
    </div>
  );
};

export const TerminalPanel = () => {
  const api = getElectronAPI();
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const layout = useTerminalStore((s) => s.layout);
  const addSession = useTerminalStore((s) => s.addSession);
  const removeSession = useTerminalStore((s) => s.removeSession);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const toggleLayout = useTerminalStore((s) => s.toggleLayout);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const projectPath = activeWorkspace?.path ?? workspaces[0]?.path;
  const initialized = useRef(false);
  const isSideBySide = layout === "side-by-side";

  useEffect(() => {
    if (!initialized.current && sessions.length === 0 && api?.terminal) {
      initialized.current = true;
      addSession();
    }
  }, [sessions.length, addSession, api]);

  if (!api?.terminal) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col items-center justify-center gap-2 text-sm text-muted-foreground")}>
        <p>Terminal is only available in the desktop app.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 bg-tertiary flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 px-2 h-10 bg-secondary">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => setActiveSession(session.id)}
            className={cn(
              "group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              session.id === activeSessionId
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            <span>{session.label}</span>
            {sessions.length > 1 && (
            <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(session.id);
                }}
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100"
              >
                <XIcon className="size-2.5" />
              </span>
            )}
          </button>
        ))}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => addSession()}
        >
          <PlusIcon className="size-3.5" />
        </Button>

        <div className="ml-auto flex items-center">
          <Button
            onClick={toggleLayout}
            variant="ghost"
            size="icon-xs"
            title={isSideBySide ? "Stack terminals" : "Split terminals side by side"}
          >
            {isSideBySide ? <SquareIcon className="size-3.5" /> : <Columns2Icon className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className={cn("flex-1 min-h-0 bg-[#f0f0f1]", isSideBySide ? "flex flex-row" : "relative")}>
        {sessions.map((session) => {
          const isVisible = isSideBySide || session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={cn(
                "min-h-0 min-w-0 overflow-hidden",
                isSideBySide
                  ? "flex-1 border-r border-foreground/5 last:border-r-0"
                  : cn("h-full w-full", isVisible ? "block" : "hidden")
              )}
            >
              <TerminalSession
                sessionId={session.id}
                visible={isVisible}
                cwd={projectPath}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
