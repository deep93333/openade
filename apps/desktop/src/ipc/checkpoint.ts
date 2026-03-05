import { ipcMain } from "electron";
import { IPC } from "@agentide/shared";
import type { Checkpoint } from "@agentide/shared";
import { ulid } from "ulid";
import * as chatStorage from "../services/chat";
import { workspaceManager } from "../services/workspace";
import { gitService } from "../services/git";
import { postRunSnapshotPromises } from "./agent";

export function registerCheckpointHandlers(): void {
  ipcMain.handle(
    IPC.CHECKPOINT_CREATE,
    async (_event, params: { workspaceId: string; activeThreadId: string; messageIndex: number }) => {
      try {
        const workspace = workspaceManager.get(params.workspaceId);
        if (!workspace) return { success: false, error: "Workspace not found" };

        const checkpointId = ulid();

        const [stashSha, baseHead, untrackedAtCheckpoint] = await Promise.all([
          gitService.stashCreate(workspace.path).catch(() => null as string | null),
          gitService.getCurrentHead(workspace.path).catch(() => null as string | null),
          gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]),
        ]);

        let gitStashRef: string | undefined;
        if (stashSha) {
          const refName = `refs/checkpoints/${params.activeThreadId}/${checkpointId}`;
          const created = await gitService
            .createRef(workspace.path, refName, stashSha)
            .then(() => true)
            .catch(() => false);
          gitStashRef = created ? refName : stashSha;
        }

        const chat = chatStorage.getChat(params.workspaceId);
        const thread = chat.threads.find((t) => t.id === params.activeThreadId);
        const prevCheckpoint = thread?.checkpoints?.slice(-1)[0] ?? null;

        let finalizedPrev: Checkpoint | null = null;
        if (prevCheckpoint && !prevCheckpoint.modifiedFiles) {
          const modified = await gitService
            .getModifiedFilesBetween(workspace.path, prevCheckpoint.gitStashRef ?? null, gitStashRef ?? null)
            .catch(() => [] as string[]);
          const fromSet = new Set(prevCheckpoint.untrackedAtCheckpoint ?? []);
          const created = untrackedAtCheckpoint.filter((f) => !fromSet.has(f));
          finalizedPrev = { ...prevCheckpoint, modifiedFiles: modified, createdFiles: created };
        }

        const newCheckpoint: Checkpoint = {
          id: checkpointId,
          threadId: params.activeThreadId,
          messageIndex: params.messageIndex,
          timestamp: Date.now(),
          ...(baseHead && { baseHead }),
          untrackedAtCheckpoint,
          ...(gitStashRef && { gitStashRef }),
        };

        const threads = chat.threads.map((t) => {
          if (t.id !== params.activeThreadId) return t;
          const updatedCheckpoints = (t.checkpoints ?? []).map((c) =>
            finalizedPrev && c.id === finalizedPrev.id ? finalizedPrev : c,
          );
          return { ...t, checkpoints: [...updatedCheckpoints, newCheckpoint] };
        });
        chatStorage.setChat(params.workspaceId, { threads });
        return { success: true, data: { checkpoint: newCheckpoint, finalizedPrev } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to create checkpoint" };
      }
    },
  );

  ipcMain.handle(
    IPC.CHECKPOINT_FINALIZE,
    async (_event, params: { workspaceId: string; threadId: string }) => {
      try {
        const workspace = workspaceManager.get(params.workspaceId);
        if (!workspace) return { success: false, error: "Workspace not found" };

        const chat = chatStorage.getChat(params.workspaceId);
        const thread = chat.threads.find((t) => t.id === params.threadId);
        if (!thread) return { success: false, error: "Thread not found" };

        const checkpoint = thread.checkpoints?.slice().reverse().find((c) => !c.modifiedFiles);
        if (!checkpoint) return { success: true, data: null };

        const snapshotKey = `${params.workspaceId}:${params.threadId}`;
        const postRun = await postRunSnapshotPromises.get(snapshotKey)?.catch(() => null) ?? null;
        postRunSnapshotPromises.delete(snapshotKey);

        const postRunUntracked = postRun?.untracked
          ?? await gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]);
        const postRunStashSha = postRun?.stashSha ?? null;

        const modified = await gitService
          .getModifiedFilesBetween(workspace.path, checkpoint.gitStashRef ?? null, postRunStashSha)
          .catch(() => [] as string[]);

        const fromUntracked = new Set(checkpoint.untrackedAtCheckpoint ?? []);
        const created = postRunUntracked.filter((f) => !fromUntracked.has(f));

        const updatedThreads = chat.threads.map((t) =>
          t.id === params.threadId
            ? {
                ...t,
                checkpoints: (t.checkpoints ?? []).map((c) =>
                  c.id === checkpoint.id ? { ...c, modifiedFiles: modified, createdFiles: created } : c,
                ),
              }
            : t,
        );
        chatStorage.setChat(params.workspaceId, { threads: updatedThreads });

        return {
          success: true,
          data: { checkpointId: checkpoint.id, modifiedFiles: modified, createdFiles: created },
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to finalize checkpoint" };
      }
    },
  );

  ipcMain.handle(
    IPC.CHECKPOINT_RESTORE,
    async (
      _event,
      params: { workspaceId: string; stashRef: string | null; modifiedFiles?: string[]; createdFiles?: string[] },
    ) => {
      try {
        const workspace = workspaceManager.get(params.workspaceId);
        if (!workspace) return { success: false, error: "Workspace not found" };

        if (params.modifiedFiles && params.modifiedFiles.length > 0) {
          await gitService.restoreFiles(workspace.path, params.stashRef, params.modifiedFiles);
          if (params.createdFiles?.length) {
            await gitService.safeDeleteFiles(workspace.path, params.createdFiles);
          }
        } else if (params.stashRef) {
          await gitService.stashApply(workspace.path, params.stashRef);
        } else {
          await gitService.restoreToHead(workspace.path);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to restore checkpoint" };
      }
    },
  );
}
