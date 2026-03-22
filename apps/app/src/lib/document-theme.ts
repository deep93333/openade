import type { ThemeAppearance } from "@openade/shared";

const STORAGE_KEY = "openade-appearance";
const LEGACY_APPEARANCE_KEY = "agentide-appearance";

export function getStoredAppearance(): ThemeAppearance | null {
  try {
    let r = localStorage.getItem(STORAGE_KEY);
    if (!r) r = localStorage.getItem(LEGACY_APPEARANCE_KEY);
    if (r === "light" || r === "dark" || r === "system") {
      if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(LEGACY_APPEARANCE_KEY)) {
        localStorage.setItem(STORAGE_KEY, r);
      }
      return r;
    }
  } catch {
    //
  }
  return null;
}

export function setStoredAppearance(value: ThemeAppearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.removeItem(LEGACY_APPEARANCE_KEY);
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
