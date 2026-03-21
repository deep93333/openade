import type {
  AgentSkillItem,
  AuthStatus,
  ChatData,
  Checkpoint,
  ElectronAPI,
  FileDiffContent,
  FileTreeNode,
  GitBranch,
  GitStagedChange,
  GitUnstagedChange,
  GlobalSettings,
  IpcResult,
  MCPServerConfig,
  MCPValidationResult,
  Workspace,
} from "@agentide/shared";
import { IPC } from "@agentide/shared";

async function platformInvoke(
  baseUrl: string,
  channel: string,
  args: unknown[] = []
): Promise<unknown> {
  const res = await fetch(`${baseUrl}/api/platform/ipc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, args }),
  });
  return res.json();
}

function createPlatformWorkspaceEventBridge(baseUrl: string) {
  const fileListeners = new Set<(p: { workspaceId: string }) => void>();
  const gitListeners = new Set<(p: { workspaceId: string }) => void>();
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function platformWsUrl(): string {
    const u = new URL(baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/api/platform/ws";
    u.search = "";
    u.hash = "";
    return u.toString();
  }

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function closeSocket() {
    clearReconnect();
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      socket = null;
    }
  }

  function scheduleReconnect() {
    if (fileListeners.size + gitListeners.size === 0) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  function connect() {
    if (fileListeners.size + gitListeners.size === 0) return;
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
      return;
    }
    const ws = new WebSocket(platformWsUrl());
    socket = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type?: string;
          channel?: string;
          payload?: { workspaceId: string };
        };
        if (msg.type !== "workspace_ipc" || !msg.channel || !msg.payload) return;
        if (msg.channel === IPC.WORKSPACE_FILES_CHANGED) {
          for (const cb of fileListeners) cb(msg.payload);
        }
        if (msg.channel === IPC.WORKSPACE_GIT_CHANGED) {
          for (const cb of gitListeners) cb(msg.payload);
        }
      } catch {
        //
      }
    };
    ws.onclose = () => {
      socket = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  function touch() {
    if (fileListeners.size + gitListeners.size > 0) connect();
    else closeSocket();
  }

  return {
    onFilesChanged(cb: (p: { workspaceId: string }) => void) {
      fileListeners.add(cb);
      touch();
      return () => {
        fileListeners.delete(cb);
        touch();
      };
    },
    onGitChanged(cb: (p: { workspaceId: string }) => void) {
      gitListeners.add(cb);
      touch();
      return () => {
        gitListeners.delete(cb);
        touch();
      };
    },
  };
}

export function createWebElectronAPI(baseUrl: string): ElectronAPI {
  const inv = (channel: string, ...args: unknown[]) => platformInvoke(baseUrl, channel, args);
  const workspaceEvents = createPlatformWorkspaceEventBridge(baseUrl);

  return {
    config: {
      getActiveWorkspaceId: () =>
        inv(IPC.CONFIG_GET_ACTIVE_WORKSPACE) as Promise<IpcResult<string | null>>,
      setActiveWorkspaceId: (workspaceId) =>
        inv(IPC.CONFIG_SET_ACTIVE_WORKSPACE, workspaceId) as Promise<IpcResult>,
    },
    apiKey: {
      get: () => inv(IPC.API_KEY_GET) as Promise<IpcResult<string | null>>,
      set: (k) => inv(IPC.API_KEY_SET, k) as Promise<IpcResult>,
      has: () => inv(IPC.API_KEY_HAS) as Promise<IpcResult<boolean>>,
    },
    codexApiKey: {
      get: () => inv(IPC.CODEX_API_KEY_GET) as Promise<IpcResult<string | null>>,
      set: (k) => inv(IPC.CODEX_API_KEY_SET, k) as Promise<IpcResult>,
      has: () => inv(IPC.CODEX_API_KEY_HAS) as Promise<IpcResult<boolean>>,
    },
    minimaxApiKey: {
      get: () => inv(IPC.MINIMAX_API_KEY_GET) as Promise<IpcResult<string | null>>,
      set: (k) => inv(IPC.MINIMAX_API_KEY_SET, k) as Promise<IpcResult>,
      has: () => inv(IPC.MINIMAX_API_KEY_HAS) as Promise<IpcResult<boolean>>,
    },
    apiKeys: {
      get: (p) => inv(IPC.API_KEYS_GET, p) as Promise<IpcResult<string | null>>,
      set: (p, k) => inv(IPC.API_KEYS_SET, p, k) as Promise<IpcResult>,
      has: (p) => inv(IPC.API_KEYS_HAS, p) as Promise<IpcResult<boolean>>,
    },
    auth: {
      status: () => inv(IPC.AUTH_STATUS) as Promise<IpcResult<AuthStatus>>,
      setMethod: (m) => inv(IPC.AUTH_SET_METHOD, m) as Promise<IpcResult>,
      login: () => inv(IPC.AUTH_LOGIN) as Promise<IpcResult<{ email?: string }>>,
    },
    settings: {
      get: () => inv(IPC.SETTINGS_GET) as Promise<IpcResult<GlobalSettings>>,
      set: (s) => inv(IPC.SETTINGS_SET, s) as Promise<IpcResult>,
      validateMcpServers: (servers) =>
        inv(IPC.SETTINGS_VALIDATE_MCP_SERVERS, servers) as Promise<IpcResult<MCPValidationResult>>,
    },
    chat: {
      load: (id) => inv(IPC.CHAT_LOAD, id) as Promise<IpcResult<ChatData>>,
      save: (id, d) => inv(IPC.CHAT_SAVE, id, d) as Promise<IpcResult>,
      deleteThread: (wid, tid) => inv(IPC.CHAT_DELETE_THREAD, wid, tid) as Promise<IpcResult>,
      updateMessage: (wid, tid, mid, u) =>
        inv(IPC.CHAT_UPDATE_MESSAGE, wid, tid, mid, u) as Promise<IpcResult>,
    },
    workspace: {
      list: () => inv(IPC.WORKSPACE_LIST) as Promise<IpcResult<Workspace[]>>,
      create: (p) => inv(IPC.WORKSPACE_CREATE, p) as Promise<IpcResult<Workspace>>,
      delete: (id) => inv(IPC.WORKSPACE_DELETE, id) as Promise<IpcResult>,
      select: (id) => inv(IPC.WORKSPACE_SELECT, id) as Promise<IpcResult<Workspace>>,
      refreshGit: (id) => inv(IPC.WORKSPACE_GIT_REFRESH, id) as Promise<IpcResult<Workspace>>,
      getBranches: (id) => inv(IPC.WORKSPACE_GIT_BRANCHES, id) as Promise<IpcResult<GitBranch[]>>,
      switchBranch: (id, b) =>
        inv(IPC.WORKSPACE_GIT_SWITCH_BRANCH, id, b) as Promise<IpcResult<Workspace>>,
      createBranch: (id, b) =>
        inv(IPC.WORKSPACE_GIT_CREATE_BRANCH, id, b) as Promise<IpcResult<Workspace>>,
      initializeGit: (id) => inv(IPC.WORKSPACE_GIT_INIT, id) as Promise<IpcResult<Workspace>>,
      getUnstagedChanges: (id) =>
        inv(IPC.WORKSPACE_GIT_UNSTAGED_CHANGES, id) as Promise<IpcResult<GitUnstagedChange[]>>,
      getStagedChanges: (id) =>
        inv(IPC.WORKSPACE_GIT_STAGED_CHANGES, id) as Promise<IpcResult<GitStagedChange[]>>,
      getFileDiffContent: (wid, fp, st) =>
        inv(IPC.WORKSPACE_GET_FILE_DIFF, wid, fp, st) as Promise<IpcResult<FileDiffContent>>,
      revertFileChange: (wid, fp) =>
        inv(IPC.WORKSPACE_REVERT_FILE_CHANGE, wid, fp) as Promise<IpcResult>,
      stageFile: (wid, fp) => inv(IPC.WORKSPACE_GIT_STAGE_FILE, wid, fp) as Promise<IpcResult>,
      unstageFile: (wid, fp) => inv(IPC.WORKSPACE_GIT_UNSTAGE_FILE, wid, fp) as Promise<IpcResult>,
      commit: (wid, m) => inv(IPC.WORKSPACE_GIT_COMMIT, wid, m) as Promise<IpcResult>,
      push: (wid) => inv(IPC.WORKSPACE_GIT_PUSH, wid) as Promise<IpcResult>,
      getAheadCount: (wid) => inv(IPC.WORKSPACE_GIT_AHEAD_COUNT, wid) as Promise<IpcResult<number>>,
      onFilesChanged: workspaceEvents.onFilesChanged,
      onGitChanged: workspaceEvents.onGitChanged,
    },
    filesystem: {
      readDirectoryTree: (p, d) =>
        inv(IPC.READ_DIRECTORY_TREE, p, d) as Promise<IpcResult<FileTreeNode>>,
      readDirectoryChildren: (p) =>
        inv(IPC.READ_DIRECTORY_CHILDREN, p) as Promise<IpcResult<FileTreeNode[]>>,
      readFile: (p) => inv(IPC.READ_FILE, p) as Promise<IpcResult<string>>,
    },
    dialog: {
      selectFolder: () => Promise.resolve({ success: true, data: null } as IpcResult<string | null>),
    },
    project: {
      createEmpty: (parent, name) =>
        inv(IPC.PROJECT_CREATE_EMPTY, parent, name) as Promise<IpcResult<string>>,
      clone: (url, parent) => inv(IPC.PROJECT_CLONE, url, parent) as Promise<IpcResult<string>>,
    },
    terminal: {
      create: (params) =>
        inv(IPC.TERMINAL_CREATE, params) as Promise<IpcResult<{ terminalId: string }>>,
      write: (id, d) => inv(IPC.TERMINAL_WRITE, id, d) as Promise<IpcResult>,
      resize: (id, c, r) => inv(IPC.TERMINAL_RESIZE, id, c, r) as Promise<IpcResult>,
      destroy: (id) => inv(IPC.TERMINAL_DESTROY, id) as Promise<IpcResult>,
      onData: () => () => {},
    },
    skills: {
      list: () => inv(IPC.SKILLS_LIST) as Promise<IpcResult<AgentSkillItem[]>>,
      getContent: (id) => inv(IPC.SKILLS_GET_CONTENT, id) as Promise<IpcResult<string>>,
    },
    checkpoint: {
      create: (p) =>
        inv(IPC.CHECKPOINT_CREATE, p) as Promise<
          IpcResult<{ checkpoint: Checkpoint; finalizedPrev: Checkpoint | null }>
        >,
      capturePostRun: (p) => inv(IPC.CHECKPOINT_CAPTURE_POST_RUN, p) as Promise<IpcResult>,
      finalize: (p) =>
        inv(IPC.CHECKPOINT_FINALIZE, p) as Promise<
          IpcResult<{
            checkpointId: string;
            modifiedFiles: string[];
            createdFiles: string[];
          } | null>
        >,
      restore: (p) => inv(IPC.CHECKPOINT_RESTORE, p) as Promise<IpcResult>,
    },
    agentLog: {
      getPath: () => inv(IPC.AGENT_LOG_GET_PATH) as Promise<IpcResult<string>>,
      read: () => inv(IPC.AGENT_LOG_READ) as Promise<IpcResult<string>>,
      openFolder: () => inv(IPC.AGENT_LOG_OPEN_FOLDER) as Promise<IpcResult>,
    },
    editor: {
      openFile: (fp, line) => inv(IPC.EDITOR_OPEN_FILE, fp, line) as Promise<IpcResult>,
    },
  };
}
