import type { AgentModelOption, ImageAttachment } from "@agentide/shared";
import { create } from "zustand";
import { getElectronAPI } from "@/lib/electron";

const DEFAULT_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
];

type ChatEditorState = {
  prompt: string;
  imageAttachments: ImageAttachment[];
  modelOptions: AgentModelOption[];
  isLoadingModels: boolean;

  setPrompt: (prompt: string) => void;
  setImageAttachments: (attachments: ImageAttachment[]) => void;
  addImageAttachments: (attachments: ImageAttachment[]) => void;
  removeImageAttachment: (id: string) => void;
  clearImageAttachments: () => void;
  fetchModelOptions: () => Promise<void>;
};

export const useChatEditorStore = create<ChatEditorState>()((set, get) => ({
  prompt: "",
  imageAttachments: [],
  modelOptions: DEFAULT_MODEL_OPTIONS.map((m) => ({ ...m, provider: "claude" as const })),
  isLoadingModels: false,

  setPrompt: (prompt) => set({ prompt }),

  setImageAttachments: (attachments) => set({ imageAttachments: attachments }),

  addImageAttachments: (attachments) =>
    set((state) => ({ imageAttachments: [...state.imageAttachments, ...attachments] })),

  removeImageAttachment: (id) =>
    set((state) => ({
      imageAttachments: state.imageAttachments.filter((att) => att.id !== id),
    })),

  clearImageAttachments: () => set({ imageAttachments: [] }),

  fetchModelOptions: async () => {
    const api = getElectronAPI();
    if (!api?.agent?.getModels) return;

    set({ isLoadingModels: true });
    try {
      const res = await api.agent.getModels();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        set({ modelOptions: res.data as AgentModelOption[] });
      }
    } finally {
      set({ isLoadingModels: false });
    }
  },
}));
