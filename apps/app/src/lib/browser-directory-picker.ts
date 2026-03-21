export function supportsShowDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function pickWebDirectoryDisplayName(): Promise<string | null> {
  if (!supportsShowDirectoryPicker()) return null;
  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    return handle.name;
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === "AbortError" || name === "NotAllowedError") return null;
    throw e;
  }
}
