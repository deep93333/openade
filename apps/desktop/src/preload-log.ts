import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "@agentide/shared";

contextBridge.exposeInMainWorld("logAPI", {
  getPath: () => ipcRenderer.invoke(IPC.AGENT_LOG_GET_PATH),
  read: () => ipcRenderer.invoke(IPC.AGENT_LOG_READ),
});
