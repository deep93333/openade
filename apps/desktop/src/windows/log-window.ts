import { BrowserWindow, app } from "electron";
import path from "node:path";
import fs from "node:fs";

let logWindow: BrowserWindow | null = null;

const LOG_VIEWER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Log</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      background: #1E231F;
      color: #d4d4d4;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      padding: 8px 12px;
      border-bottom: 1px solid #333;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .toolbar button {
      padding: 6px 12px;
      background: #2d2d2d;
      border: 1px solid #444;
      border-radius: 6px;
      color: #d4d4d4;
      cursor: pointer;
      font-size: 12px;
    }
    .toolbar button:hover { background: #3d3d3d; }
    .path {
      font-size: 11px;
      color: #858585;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      flex: 1;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .error { color: #f48771; }
    .empty { color: #858585; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" id="refresh">Refresh</button>
    <span class="path" id="path"></span>
  </div>
  <pre id="content" class="empty">Loading…</pre>
  <script>
    const pathEl = document.getElementById("path");
    const contentEl = document.getElementById("content");
    const POLL_MS = 1500;
    const SCROLL_THRESHOLD = 80;

    function isNearBottom() {
      const pre = contentEl;
      return pre.scrollHeight - pre.scrollTop - pre.clientHeight < SCROLL_THRESHOLD;
    }

    async function load() {
      if (!window.logAPI) {
        contentEl.textContent = "Log API not available.";
        contentEl.className = "error";
        return;
      }
      const pathRes = await window.logAPI.getPath();
      if (pathRes.success) {
        pathEl.textContent = pathRes.data;
      }
      const readRes = await window.logAPI.read();
      if (readRes.success) {
        const text = readRes.data || "(empty)";
        const wasNearBottom = isNearBottom();
        contentEl.textContent = text;
        contentEl.className = text === "(empty)" ? "empty" : "";
        if (wasNearBottom) {
          contentEl.scrollTop = contentEl.scrollHeight;
        }
      } else {
        contentEl.textContent = readRes.error || "Failed to read log";
        contentEl.className = "error";
      }
    }

    document.getElementById("refresh").onclick = () => load();

    load();

    const pollId = setInterval(load, POLL_MS);
    window.addEventListener("beforeunload", () => clearInterval(pollId));
  </script>
</body>
</html>`;

function getLogViewerPath(): string {
  const dir = path.join(app.getPath("userData"), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "log-viewer.html");
}

export const createLogWindow = (): BrowserWindow => {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return logWindow;
  }

  const preloadPath = path.join(__dirname, "preload-log.js");
  fs.writeFileSync(getLogViewerPath(), LOG_VIEWER_HTML, "utf-8");

  logWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    title: "Agent Log",
    backgroundColor: "#1E231F",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  logWindow.loadFile(getLogViewerPath());

  logWindow.on("closed", () => {
    logWindow = null;
  });

  return logWindow;
};

export const getLogWindow = (): BrowserWindow | null => logWindow;
