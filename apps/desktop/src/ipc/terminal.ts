import { ipcMain } from "electron";
import { IPC } from "@openade/shared";
import * as terminalService from "../services/terminal-service";
import { getAppWindow } from "../windows/app-window";

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    IPC.TERMINAL_CREATE,
    async (_event, params: { cwd?: string; cols?: number; rows?: number }) => {
      try {
        const { terminalId, pty } = terminalService.createTerminal(params);
        pty.onData((data) => {
          getAppWindow()?.webContents.send(IPC.TERMINAL_DATA, { terminalId, data });
        });
        pty.onExit(() => {
          terminalService.removeTerminal(terminalId);
        });
        return { success: true, data: { terminalId } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to create terminal" };
      }
    },
  );

  ipcMain.handle(IPC.TERMINAL_WRITE, async (_event, terminalId: string, data: string) => {
    return { success: terminalService.writeToTerminal(terminalId, data) };
  });

  ipcMain.handle(IPC.TERMINAL_RESIZE, async (_event, terminalId: string, cols: number, rows: number) => {
    return { success: terminalService.resizeTerminal(terminalId, cols, rows) };
  });

  ipcMain.handle(IPC.TERMINAL_DESTROY, async (_event, terminalId: string) => {
    return { success: terminalService.destroyTerminal(terminalId) };
  });
}
