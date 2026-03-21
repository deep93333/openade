import type { ThemeAppearance } from "@agentide/shared";

const STORAGE_KEY = "agentide-appearance";

export function getStoredAppearance(): ThemeAppearance | null {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r === "light" || r === "dark" || r === "system") return r;
  } catch {
    //
  }
  return null;
}

export function setStoredAppearance(value: ThemeAppearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    //
  }
}

export function resolveAppearance(pref: ThemeAppearance | undefined): "light" | "dark" {
  const p = pref ?? "dark";
  if (p === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return p;
}

export function applyResolvedTheme(resolved: "light" | "dark"): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document.body?.classList.toggle("dark", resolved === "dark");
}
