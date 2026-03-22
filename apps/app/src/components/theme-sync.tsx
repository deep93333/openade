import { useEffect } from "react";
import { getElectronAPI } from "@/lib/electron";
import { isElectron } from "@/lib/electron";
import {
  applyResolvedTheme,
  getStoredAppearance,
  resolveAppearance,
  setStoredAppearance,
} from "@/lib/document-theme";

export function ThemeSync() {
  useEffect(() => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    if (!api?.settings) return;
    let cancelled = false;
    void api.settings.get().then((r) => {
      if (!r.success || !r.data || cancelled) return;
      const a = r.data.appearance ?? "dark";
      setStoredAppearance(a);
      applyResolvedTheme(resolveAppearance(a));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredAppearance() !== "system") return;
      applyResolvedTheme(resolveAppearance("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
