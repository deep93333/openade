export const IPC = {
  AGENT_START: "agent:start",
  AGENT_STOP: "agent:stop",
  AGENT_STATUS: "agent:status",
  AGENT_MESSAGE: "agent:message",
  AGENT_RESULT: "agent:result",
  AGENT_ERROR: "agent:error",
  AGENT_TOOL_APPROVAL_REQUEST: "agent:tool-approval-request",
  AGENT_TOOL_APPROVAL_RESPONSE: "agent:tool-approval-response",

  WORKSPACE_LIST: "workspace:list",
  WORKSPACE_CREATE: "workspace:create",
  WORKSPACE_DELETE: "workspace:delete",
  WORKSPACE_SELECT: "workspace:select",
  WORKSPACE_GIT_REFRESH: "workspace:git-refresh",
  WORKSPACE_GIT_BRANCHES: "workspace:git-branches",
  WORKSPACE_GIT_SWITCH_BRANCH: "workspace:git-switch-branch",
  WORKSPACE_GIT_CREATE_BRANCH: "workspace:git-create-branch",

  DIALOG_SELECT_FOLDER: "dialog:select-folder",

  READ_DIRECTORY_TREE: "filesystem:read-directory-tree",
  READ_FILE: "filesystem:read-file",

  CHAT_LOAD: "chat:load",
  CHAT_SAVE: "chat:save",

  APP_READY: "app:ready",
  APP_QUIT: "app:quit",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
