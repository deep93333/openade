import { spawn } from "child_process";
import { shell } from "electron";

type EditorLauncher = {
  command: string;
  args: (filePath: string, line?: number) => string[];
};

const editorLaunchers: EditorLauncher[] = [
  {
    command: "cursor",
    args: (filePath, line) => (line ? [`${filePath}:${line}`] : [filePath]),
  },
  {
    command: "code",
    args: (filePath, line) =>
      line ? ["--goto", `${filePath}:${line}`] : ["--goto", filePath],
  },
];

function tryLaunchEditorCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

      child.once("error", (error) => {
        if (resolved) return;
        resolved = true;
        const err = error as NodeJS.ErrnoException;
        if (err.code !== "ENOENT") {
          console.warn(`Failed to launch ${command}:`, err);
        }
        resolve(false);
      });

      child.once("spawn", () => {
        if (resolved) return;
        resolved = true;
        child.unref();
        resolve(true);
      });
    } catch (error) {
      if (resolved) return;
      resolved = true;
      console.warn(`Failed to launch ${command}:`, error);
      resolve(false);
    }
  });
}

export async function openFileInExternalEditor(
  filePath: string,
  line?: number,
): Promise<{ success: true } | { success: false; error: string }> {
  for (const launcher of editorLaunchers) {
    const launched = await tryLaunchEditorCommand(
      launcher.command,
      launcher.args(filePath, line),
    );
    if (launched) return { success: true };
  }

  const fallbackError = await shell.openPath(filePath);
  if (fallbackError) return { success: false, error: fallbackError };

  return { success: true };
}
