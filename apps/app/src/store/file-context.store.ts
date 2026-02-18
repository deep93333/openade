import { create } from "zustand";

type FileContext = {
  filePath: string;
  code: string;
  startLine: number;
  endLine: number;
};

type AddContextHandler = (ctx: FileContext) => void;

type FileContextStoreState = {
  addContextHandler: AddContextHandler | null;
  setAddContextHandler: (handler: AddContextHandler | null) => void;
  addContextToChat: (ctx: FileContext) => void;
};

export const useFileContextStore = create<FileContextStoreState>()((set, get) => ({
  addContextHandler: null,

  setAddContextHandler: (handler) => set({ addContextHandler: handler }),

  addContextToChat: (ctx: FileContext) => {
    get().addContextHandler?.(ctx);
  },
}));
