import { create } from "zustand";
import type { ElementInfo } from "@/components/web-view/inspector";

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

export type MentionElementPayload = ElementInfo;

type AddContextHandler = (ctx: FileContext) => void;
type MentionFileHandler = (payload: MentionFilePayload) => void;
type MentionElementHandler = (payload: MentionElementPayload) => void;

type FileContextStoreState = {
  addContextHandler: AddContextHandler | null;
  setAddContextHandler: (handler: AddContextHandler | null) => void;
  mentionFileHandler: MentionFileHandler | null;
  setMentionFileHandler: (handler: MentionFileHandler | null) => void;
  mentionElementHandler: MentionElementHandler | null;
  setMentionElementHandler: (handler: MentionElementHandler | null) => void;
  addContextToChat: (ctx: FileContext) => void;
  mentionFileInChat: (payload: MentionFilePayload) => void;
  mentionElementInChat: (payload: MentionElementPayload) => void;
};

export const useFileContextStore = create<FileContextStoreState>()((set, get) => ({
  addContextHandler: null,
  mentionFileHandler: null,
  mentionElementHandler: null,

  setAddContextHandler: (handler) => set({ addContextHandler: handler }),
  setMentionFileHandler: (handler) => set({ mentionFileHandler: handler }),
  setMentionElementHandler: (handler) => set({ mentionElementHandler: handler }),

  addContextToChat: (ctx: FileContext) => {
    get().addContextHandler?.(ctx);
  },

  mentionFileInChat: (payload: MentionFilePayload) => {
    get().mentionFileHandler?.(payload);
  },

  mentionElementInChat: (payload: MentionElementPayload) => {
    get().mentionElementHandler?.(payload);
  },
}));
