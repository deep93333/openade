export type ShortcutPlatform = "apple" | "other";

export type ShortcutDisplayOptions = {
  platform?: ShortcutPlatform;
};

const detectPlatform = (): ShortcutPlatform => {
  if (typeof navigator === "undefined") return "other";
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? "apple" : "other";
};

const normalizeShortcutPart = (part: string, platform: ShortcutPlatform): string => {
  const trimmed = part.trim();
  if (!trimmed) return "";

  const normalized = trimmed.toLowerCase();

  switch (normalized) {
    case "commandorcontrol":
    case "cmdorctrl":
      return platform === "apple" ? "⌘" : "⌃";
    case "command":
    case "cmd":
    case "meta":
      return "⌘";
    case "control":
    case "ctrl":
      return "⌃";
    case "shift":
      return "⇧";
    case "alt":
    case "option":
      return "⌥";
    case "space":
      return "␣";
    case "enter":
    case "return":
      return "↵";
    case "tab":
      return "⇥";
    default:
      return normalized.toUpperCase();
  }
};

export const getShortcutDisplayKeys = (
  shortcut: string,
  options: ShortcutDisplayOptions = {}
): string[] => {
  const platform = options.platform ?? detectPlatform();

  return shortcut
    .split(/[+]/)
    .map((part) => normalizeShortcutPart(part, platform))
    .filter(Boolean);
};


