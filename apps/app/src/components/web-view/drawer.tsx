import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  CircleXIcon,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  Input,
} from "@agentide/ui";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CodeIcon,
  CrosshairIcon,
  ExternalLinkIcon,
  GlobeIcon,
  RefreshCwIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getElectronAPI } from "@/lib/electron";
import { useFileContextStore } from "@/store/context";
import { getInspectorScript } from "./script";
import { ElementInfoPanel, type ElementInfo } from "./inspector";
import { IconBrowser, IconGlobe } from "@tabler/icons-react";

const MIN_WIDTH = 400;
const MAX_WIDTH = 1400;
const DEFAULT_WIDTH = 800;

type WebViewDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl?: string;
};

export const WebViewDrawer = ({
  open,
  onOpenChange,
  initialUrl = "http://localhost:3000",
}: WebViewDrawerProps) => {
  const [url, setUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const api = getElectronAPI();
  const mentionElementInChat = useFileContextStore((s) => s.mentionElementInChat);

  const navigate = useCallback((targetUrl: string) => {
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `http://${normalizedUrl}`;
    }
    setUrl(normalizedUrl);
    setInputUrl(normalizedUrl);
  }, []);

  const handleRefresh = useCallback(() => {
    webviewRef.current?.reload();
  }, []);

  const handleGoBack = useCallback(() => {
    webviewRef.current?.goBack();
  }, []);

  const handleGoForward = useCallback(() => {
    webviewRef.current?.goForward();
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open(url, "_blank");
  }, [url]);

  const handleOpenDevTools = useCallback(() => {
    webviewRef.current?.openDevTools();
  }, []);

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigate(inputUrl);
    },
    [inputUrl, navigate]
  );

  const toggleInspectMode = useCallback(() => {
    const newMode = !inspectMode;
    setInspectMode(newMode);
    if (!newMode) {
      setSelectedElement(null);
    }
    webviewRef.current?.executeJavaScript(getInspectorScript(newMode));
  }, [inspectMode]);

  const handleCloseElementPanel = useCallback(() => {
    setSelectedElement(null);
    setInspectMode(false);
    webviewRef.current?.executeJavaScript(getInspectorScript(false));
  }, []);

  useEffect(() => {
    if (!open) return;

    const webview = webviewRef.current;
    if (!webview) return;

    const handleDidStartLoading = () => setLoading(true);
    const handleDidStopLoading = () => {
      setLoading(false);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      if (inspectMode) {
        webview.executeJavaScript(getInspectorScript(true));
      }
    };
    const handleDidNavigate = (e: Electron.DidNavigateEvent) => {
      setInputUrl(e.url);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };
    const handlePageTitleUpdated = (e: Electron.PageTitleUpdatedEvent) => {
      setPageTitle(e.title);
    };
    const handleDidFailLoad = () => {
      setLoading(false);
    };

    const handleConsoleMessage = (e: Electron.ConsoleMessageEvent) => {
      if (e.message.startsWith("__agentide_")) {
        try {
          const parsed = JSON.parse(e.message.replace("__agentide_", ""));
          if (parsed.type === "element_selected") {
            setSelectedElement(parsed.data);
          } else if (parsed.type === "inspector_cancel") {
            setInspectMode(false);
            setSelectedElement(null);
          }
        } catch {}
      }
    };

    webview.addEventListener("did-start-loading", handleDidStartLoading);
    webview.addEventListener("did-stop-loading", handleDidStopLoading);
    webview.addEventListener("did-navigate", handleDidNavigate);
    webview.addEventListener("did-navigate-in-page", handleDidNavigate as never);
    webview.addEventListener("page-title-updated", handlePageTitleUpdated);
    webview.addEventListener("did-fail-load", handleDidFailLoad);
    webview.addEventListener("console-message", handleConsoleMessage);

    return () => {
      webview.removeEventListener("did-start-loading", handleDidStartLoading);
      webview.removeEventListener("did-stop-loading", handleDidStopLoading);
      webview.removeEventListener("did-navigate", handleDidNavigate);
      webview.removeEventListener("did-navigate-in-page", handleDidNavigate as never);
      webview.removeEventListener("page-title-updated", handlePageTitleUpdated);
      webview.removeEventListener("did-fail-load", handleDidFailLoad);
      webview.removeEventListener("console-message", handleConsoleMessage);
    };
  }, [open, inspectMode]);

  useEffect(() => {
    if (!open) return;

    const webview = webviewRef.current;
    if (!webview) return;

    const handleIpcMessage = (event: Electron.IpcMessageEvent) => {
      if (event.channel === "__agentide_element_selected__") {
        setSelectedElement(event.args[0] as ElementInfo);
      } else if (event.channel === "__agentide_inspector_cancel__") {
        setInspectMode(false);
        setSelectedElement(null);
      }
    };

    webview.addEventListener("ipc-message", handleIpcMessage);

    return () => {
      webview.removeEventListener("ipc-message", handleIpcMessage);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setInputUrl(initialUrl);
      setInspectMode(false);
      setSelectedElement(null);
    }
  }, [open, initialUrl]);

  useEffect(() => {
    if (!open) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "__agentide_element_selected__") {
        setSelectedElement(event.data.data);
      } else if (event.data?.type === "__agentide_inspector_cancel__") {
        setInspectMode(false);
        setSelectedElement(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="right"
      resizable
      minWidth={MIN_WIDTH}
      maxWidth={MAX_WIDTH}
      defaultWidth={DEFAULT_WIDTH}
    >
      <DrawerContent aria-label="Web view" className="bg-background" overlayClassName="bg-black/90">
        <DrawerHeader className="flex flex-col gap-2 px-2 py-2 border-b border-border not-draggable">
         
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2 px-2">
    <IconBrowser stroke={1} className="size-4 text-muted-foreground" />
    <span className="truncate text-sm font-medium text-foreground max-w-[200px]">
      {pageTitle || "Browser"}
    </span>
  </div>
  <div className="flex flex-1"/>
  <DrawerClose className="flex items-center justify-center size-6 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
    <CircleXIcon className="size-5" />
  </DrawerClose>
</div>
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleGoBack}
                disabled={!canGoBack}
                className={canGoBack ? "hover:bg-secondary text-muted-foreground hover:text-foreground" : "text-muted-foreground/40 cursor-not-allowed"}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleGoForward}
                disabled={!canGoForward}
                className={cn(
                  canGoForward
                    ? "hover:bg-secondary text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                <ArrowRightIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleRefresh}
                loading={loading}
              >
                <RefreshCwIcon className="size-4" />
              </Button>
            </div>

            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter URL..."
              className="flex-1 h-7 text-sm font-mono bg-secondary border-0"
            />

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleInspectMode}
              className={inspectMode ? "bg-blue-500 text-white hover:bg-blue-600" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}
              title={inspectMode ? "Exit inspect mode (Esc)" : "Inspect element"}
            >
              <CrosshairIcon className="size-4" />
              </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleOpenDevTools}
              className="hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Open DevTools"
            >
              <CodeIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleOpenExternal}
              className="hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Open in external browser"
            >
              <ExternalLinkIcon className="size-4" />
            </Button>
           
          </form>

          {inspectMode && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-600 dark:text-blue-400">
              <CrosshairIcon className="size-3.5" />
              <span>Click on any element to inspect it. Press <kbd className="px-1.5 py-0.5 rounded bg-blue-500/20 font-mono">Esc</kbd> to exit.</span>
            </div>
          )}
          
        </DrawerHeader>

        <DrawerBody className="p-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">
            {api ? (
              <webview
                ref={webviewRef as React.RefObject<Electron.WebviewTag>}
                src={url}
                className="w-full h-full"
                style={{ display: "flex", flex: 1 }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <GlobeIcon className="size-12 text-muted-foreground/50" />
                <p className="text-sm">Web view is only available in the desktop app.</p>
              </div>
            )}
          </div>

          {selectedElement && (
            <ElementInfoPanel
              element={selectedElement}
              onClose={handleCloseElementPanel}
              onAddToChat={mentionElementInChat}
            />
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};
