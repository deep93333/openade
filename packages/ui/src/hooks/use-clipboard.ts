import { useCallback, useState } from "react";

type CopiedValue = string | null;

type CopyFn = (text: string) => Promise<boolean>;

type ElectronClipboardAPI = {
  copyTextToClipboard?: (text: string, html?: string) => Promise<{ success: boolean }>;
};

const getElectronAPI = (): ElectronClipboardAPI | undefined => {
  if (typeof window !== "undefined") {
    return (window as unknown as { electronAPI?: ElectronClipboardAPI }).electronAPI;
  }
  return undefined;
};

export function useClipboard() {
  const [copiedText, setCopiedText] = useState<CopiedValue>(null);
  const [showCopied, setShowCopied] = useState<boolean>(false);

  const copy: CopyFn = useCallback(async (text) => {
    try {
      const electronAPI = getElectronAPI();
      if (electronAPI?.copyTextToClipboard) {
        const result = await electronAPI.copyTextToClipboard(text);
        if (result?.success) {
          setCopiedText(text);
          setShowCopied(true);
          setTimeout(() => {
            setShowCopied(false);
          }, 2000);
          return true;
        }
      }

      if (!navigator?.clipboard) {
        setCopiedText(null);
        return false;
      }

      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setShowCopied(true);
      setTimeout(() => {
        setShowCopied(false);
      }, 2000);
      return true;
    } catch {
      setCopiedText(null);
      return false;
    }
  }, []);

  return { copiedText, copy, showCopied };
}
