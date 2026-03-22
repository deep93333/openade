import { AppLayout } from "@/layouts/app-layout";
import { NewTaskWindow } from "@/components/tasks/new-task-window";
import { ThemeSync } from "@/components/theme-sync";

const getRoute = () => {
  if (typeof window === "undefined") return "/";
  return window.location.hash.replace(/^#/, "") || "/";
};

export const App = () => {
  const route = getRoute();
  const isNewTaskWindow = route.startsWith("/new-task");

  return (
    <div className="flex h-screen w-full min-w-0 overflow-hidden bg-background">
      <ThemeSync />
      {isNewTaskWindow ? <NewTaskWindow /> : <AppLayout />}
    </div>
  );
};
