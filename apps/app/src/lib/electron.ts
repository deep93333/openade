import { getBackendBaseUrl } from "@/lib/backend-url";
import { createWebElectronAPI } from "@/lib/web-electron-api";
import type { ElectronAPI, WindowWithElectronAPI } from "@openade/shared";

let webElectronApi: ElectronAPI | null = null;

export const getElectronAPI = (): ElectronAPI | null => {
  if (typeof window === "undefined") return null;
  const native = (window as unknown as Partial<WindowWithElectronAPI>).electronAPI;
  if (native) return native;
  if (!webElectronApi) {
    webElectronApi = createWebElectronAPI(getBackendBaseUrl());
  }
  return webElectronApi;
};

export const isElectron = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as Partial<WindowWithElectronAPI>).electronAPI);
};
