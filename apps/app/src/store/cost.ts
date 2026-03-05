import { create } from "zustand";

const COST_STORAGE_KEY = "agentide-total-cost";

const loadCostFromStorage = (): number => {
  try {
    const raw = localStorage.getItem(COST_STORAGE_KEY);
    return raw ? parseFloat(raw) || 0 : 0;
  } catch {
    return 0;
  }
};

const saveCostToStorage = (totalCost: number): void => {
  try {
    localStorage.setItem(COST_STORAGE_KEY, totalCost.toString());
  } catch {
    // ignore
  }
};

type CostStoreState = {
  totalCostUsd: number;
  addCost: (cost: number) => void;
  resetCost: () => void;
  loadCost: () => void;
};

export const useCostStore = create<CostStoreState>()((set, get) => ({
  totalCostUsd: 0,

  addCost: (cost: number) => {
    if (cost > 0) {
      const newTotal = get().totalCostUsd + cost;
      set({ totalCostUsd: newTotal });
      saveCostToStorage(newTotal);
    }
  },

  resetCost: () => {
    set({ totalCostUsd: 0 });
    saveCostToStorage(0);
  },

  loadCost: () => {
    const totalCost = loadCostFromStorage();
    set({ totalCostUsd: totalCost });
  },
}));