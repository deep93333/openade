import { create } from "zustand";

type TerminalLayout = "tabs" | "side-by-side";

type TerminalSession = {
  id: string;
  label: string;
};

type TerminalStoreState = {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  counter: number;
  layout: TerminalLayout;
  visible: boolean;

  addSession: () => string;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  toggleLayout: () => void;
  setVisible: (value: boolean | ((prev: boolean) => boolean)) => void;
};

export const useTerminalStore = create<TerminalStoreState>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  counter: 0,
  layout: "tabs",
  visible: false,

  setVisible: (value) =>
    set((s) => ({ visible: typeof value === "function" ? value(s.visible) : value })),

  addSession: () => {
    const { counter, sessions } = get();
    const next = counter + 1;
    const id = `session-${next}`;
    const session: TerminalSession = { id, label: `Terminal ${next}` };
    set({
      sessions: [...sessions, session],
      activeSessionId: id,
      counter: next,
    });
    return id;
  },

  removeSession: (id) => {
    const { sessions, activeSessionId } = get();
    const filtered = sessions.filter((s) => s.id !== id);
    let nextActive = activeSessionId;
    if (activeSessionId === id) {
      const idx = sessions.findIndex((s) => s.id === id);
      nextActive = filtered[Math.min(idx, filtered.length - 1)]?.id ?? null;
    }
    set({ sessions: filtered, activeSessionId: nextActive });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  toggleLayout: () =>
    set((s) => ({ layout: s.layout === "tabs" ? "side-by-side" : "tabs" })),
}));
