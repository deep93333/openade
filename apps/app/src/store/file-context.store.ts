import { create } from "zustand";

export type FileContext = {
  filePath: string;
  code: string;
  startLine: number;
  endLine: number;
  comment?: string;
};

export type MentionFilePayload = {
  filePath: string;
  workspacePath?: string | null;
};

type AddContextHandler = (ctx: FileContext) => void;
type MentionFileHandler = (payload: MentionFilePayload) => void;

type FileContextStoreState = {
  addContextHandler: AddContextHandler | null;
  setAddContextHandler: (handler: AddContextHandler | null) => void;
  mentionFileHandler: MentionFileHandler | null;
  setMentionFileHandler: (handler: MentionFileHandler | null) => void;
  addContextToChat: (ctx: FileContext) => void;
  mentionFileInChat: (payload: MentionFilePayload) => void;
};

export const useFileContextStore = create<FileContextStoreState>()((set, get) => ({
  addContextHandler: null,
  mentionFileHandler: null,

  setAddContextHandler: (handler) => set({ addContextHandler: handler }),
  setMentionFileHandler: (handler) => set({ mentionFileHandler: handler }),

  addContextToChat: (ctx: FileContext) => {
    get().addContextHandler?.(ctx);
  },

  mentionFileInChat: (payload: MentionFilePayload) => {
    get().mentionFileHandler?.(payload);
  },
}));
