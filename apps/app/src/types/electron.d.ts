declare namespace Electron {
  interface WebviewTag extends HTMLElement {
    src: string;
    preload?: string;
    partition?: string;
    allowpopups?: boolean;
    webpreferences?: string;
    httpreferrer?: string;
    useragent?: string;
    disablewebsecurity?: boolean;
    nodeintegration?: boolean;
    nodeintegrationinsubframes?: boolean;
    plugins?: boolean;
    disableblinkfeatures?: string;
    enableblinkfeatures?: string;

    reload(): void;
    goBack(): void;
    goForward(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
    stop(): void;
    getURL(): string;
    getTitle(): string;
    isLoading(): boolean;
    executeJavaScript(code: string): Promise<unknown>;
    openDevTools(): void;
    closeDevTools(): void;

    addEventListener<K extends keyof WebviewTagEventMap>(
      type: K,
      listener: (event: WebviewTagEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof WebviewTagEventMap>(
      type: K,
      listener: (event: WebviewTagEventMap[K]) => void,
      options?: boolean | EventListenerOptions
    ): void;
  }

  type WebviewTagEventMap = {
    "did-start-loading": Event;
    "did-stop-loading": Event;
    "did-navigate": DidNavigateEvent;
    "did-navigate-in-page": DidNavigateInPageEvent;
    "did-fail-load": DidFailLoadEvent;
    "page-title-updated": PageTitleUpdatedEvent;
    "console-message": ConsoleMessageEvent;
    "ipc-message": IpcMessageEvent;
    "dom-ready": Event;
  };

  type DidNavigateEvent = Event & { url: string };
  type DidNavigateInPageEvent = Event & { url: string; isMainFrame: boolean };
  type DidFailLoadEvent = Event & { errorCode: number; errorDescription: string; validatedURL: string };
  type PageTitleUpdatedEvent = Event & { title: string; explicitSet: boolean };
  type ConsoleMessageEvent = Event & { level: number; message: string; line: number; sourceId: string };
  type IpcMessageEvent = Event & { channel: string; args: unknown[] };
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<Electron.WebviewTag> & {
        src?: string;
        preload?: string;
        partition?: string;
        allowpopups?: string;
        webpreferences?: string;
        httpreferrer?: string;
        useragent?: string;
        disablewebsecurity?: string;
        nodeintegration?: string;
        nodeintegrationinsubframes?: string;
        plugins?: string;
        disableblinkfeatures?: string;
        enableblinkfeatures?: string;
      },
      Electron.WebviewTag
    >;
  }
}
