import { useEffect } from "react";
import { AppLayout } from "@/layouts/app-layout";
import { NewTaskWindow } from "@/components/tasks/new-task-window";
import { useChatEditorStore } from "@/store/editor";

const getRoute = () => {
  if (typeof window === "undefined") return "/";
  return window.location.hash.replace(/^#/, "") || "/";
};

export const App = () => {
  const route = getRoute();
  const isNewTaskWindow = route.startsWith("/new-task");
  const fetchModelOptions = useChatEditorStore((s) => s.fetchModelOptions);

  useEffect(() => {
    void fetchModelOptions();
  }, [fetchModelOptions]);

  return (
    <div className="flex h-screen w-full min-w-0 overflow-hidden bg-background">
      {isNewTaskWindow ? <NewTaskWindow /> : <AppLayout />}
    </div>
  );
};
