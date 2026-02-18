import type { ElectronAPI, WindowWithElectronAPI } from "@agentide/shared";

export const getElectronAPI = (): ElectronAPI | null => {
  if (typeof window !== "undefined" && "electronAPI" in window) {
    return (window as unknown as WindowWithElectronAPI).electronAPI;
  }
  return null;
};

export const isElectron = (): boolean => {
  return getElectronAPI() !== null;
};
