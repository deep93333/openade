import { useCostStore } from "@/store/cost.store";
import { useEffect } from "react";

export const CostDisplay = () => {
  const totalCostUsd = useCostStore((s) => s.totalCostUsd);
  const loadCost = useCostStore((s) => s.loadCost);

  useEffect(() => {
    loadCost();
  }, [loadCost]);

  if (totalCostUsd === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-600">
      <span className="text-zinc-500">Total Cost:</span>
      <span className="font-medium text-zinc-800">
        ${totalCostUsd.toFixed(4)}
      </span>
    </div>
  );
};