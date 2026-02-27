import type { Checkpoint, ChatThread } from "@agentide/shared";

export const getCheckpointForMessage = (
  thread: ChatThread | null | undefined,
  messageIndex: number
): Checkpoint | undefined =>
  thread?.checkpoints?.find((c) => c?.messageIndex === messageIndex);

export const isCodeRestoreAvailable = (checkpoint: Checkpoint | undefined): boolean =>
  !!(checkpoint?.modifiedFiles?.length || checkpoint?.gitStashRef);

export const isMessageRewindable = (
  thread: ChatThread | null | undefined,
  messageIndex: number
): boolean => !!getCheckpointForMessage(thread, messageIndex);
