import type { IPty } from "node-pty";
import * as pty from "node-pty";
import os from "node:os";
import path from "node:path";

const isWindows = process.platform === "win32";
const shell = process.env[isWindows ? "COMSPEC" : "SHELL"] || (isWindows ? "cmd.exe" : "/bin/bash");
const defaultCwd = process.env.HOME || process.env.USERPROFILE || path.resolve("/");

const terminals = new Map<string, IPty>();

export type CreateTerminalParams = {
  cwd?: string;
  cols?: number;
  rows?: number;
};

export function createTerminal(params: CreateTerminalParams): { terminalId: string; pty: IPty } {
  const terminalId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const cwd = params.cwd || defaultCwd;
  const cols = params.cols ?? 80;
  const rows = params.rows ?? 24;

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: { ...process.env },
  });

  terminals.set(terminalId, ptyProcess);
  return { terminalId, pty: ptyProcess };
}

export function writeToTerminal(terminalId: string, data: string): boolean {
  const p = terminals.get(terminalId);
  if (!p) return false;
  p.write(data);
  return true;
}

export function resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
  const p = terminals.get(terminalId);
  if (!p) return false;
  p.resize(cols, rows);
  return true;
}

export function destroyTerminal(terminalId: string): boolean {
  const p = terminals.get(terminalId);
  if (!p) return false;
  p.kill();
  terminals.delete(terminalId);
  return true;
}

export function getTerminal(terminalId: string): IPty | undefined {
  return terminals.get(terminalId);
}

export function removeTerminal(terminalId: string): void {
  terminals.delete(terminalId);
}
