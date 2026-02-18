import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "@agentide/shared";

contextBridge.exposeInMainWorld("electronAPI", {
  chat: {
    load: (workspaceId: string) => ipcRenderer.invoke(IPC.CHAT_LOAD, workspaceId),
    save: (workspaceId: string, data: { messages: unknown[] }) =>
      ipcRenderer.invoke(IPC.CHAT_SAVE, workspaceId, data),
  },
  agent: {
    start: (params: { prompt: string; workspaceId: string }) =>
      ipcRenderer.invoke(IPC.AGENT_START, params),

    stop: (sessionId: string) => ipcRenderer.invoke(IPC.AGENT_STOP, sessionId),

    status: () => ipcRenderer.invoke(IPC.AGENT_STATUS),

    onMessage: (callback: (message: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, message: unknown) => callback(message);
      ipcRenderer.on(IPC.AGENT_MESSAGE, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_MESSAGE, handler);
    },

    onResult: (callback: (result: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, result: unknown) => callback(result);
      ipcRenderer.on(IPC.AGENT_RESULT, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_RESULT, handler);
    },

    onError: (callback: (error: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
      ipcRenderer.on(IPC.AGENT_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_ERROR, handler);
    },

    onToolApprovalRequest: (callback: (request: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, request: unknown) => callback(request);
      ipcRenderer.on(IPC.AGENT_TOOL_APPROVAL_REQUEST, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_TOOL_APPROVAL_REQUEST, handler);
    },

    respondToolApproval: (response: unknown) =>
      ipcRenderer.invoke(IPC.AGENT_TOOL_APPROVAL_RESPONSE, response),
  },

  workspace: {
    list: () => ipcRenderer.invoke(IPC.WORKSPACE_LIST),

    create: (params: { name: string; path: string }) =>
      ipcRenderer.invoke(IPC.WORKSPACE_CREATE, params),

    delete: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_DELETE, id),

    select: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_SELECT, id),

    refreshGit: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_REFRESH, id),

    getBranches: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_GIT_BRANCHES, id),

    switchBranch: (id: string, branchName: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_SWITCH_BRANCH, id, branchName),

    createBranch: (id: string, branchName: string) =>
      ipcRenderer.invoke(IPC.WORKSPACE_GIT_CREATE_BRANCH, id, branchName),
  },

  filesystem: {
    readDirectoryTree: (path: string) =>
      ipcRenderer.invoke(IPC.READ_DIRECTORY_TREE, path),
    readFile: (path: string) => ipcRenderer.invoke(IPC.READ_FILE, path),
  },

  dialog: {
    selectFolder: () => ipcRenderer.invoke(IPC.DIALOG_SELECT_FOLDER),
  },
});
