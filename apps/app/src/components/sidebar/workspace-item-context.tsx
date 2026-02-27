import { createContext, useContext } from "react";
import type {
  WorkspaceItemHandlers,
  WorkspaceItemState,
  DeleteThreadState,
  RemoveWorkspaceState,
} from "./use-workspace-item";

type WorkspaceItemContextValue = {
  state: WorkspaceItemState;
  handlers: WorkspaceItemHandlers;
  deleteState: DeleteThreadState;
  removeWorkspaceState: RemoveWorkspaceState;
};

const WorkspaceItemContext = createContext<WorkspaceItemContextValue | null>(null);

export function useWorkspaceItemContext() {
  const ctx = useContext(WorkspaceItemContext);
  if (!ctx) throw new Error("useWorkspaceItemContext must be used within WorkspaceItem");
  return ctx;
}

export const WorkspaceItemProvider = WorkspaceItemContext.Provider;
export { WorkspaceItemContext };
