import { useCostStore } from "@/store/cost";
import { useEffect } from "react";

export const CostDisplay = () => {
  const totalCostUsd = useCostStore((s) => s.totalCostUsd);
  const loadCost = useCostStore((s) => s.loadCost);

  useEffect(() => {
    loadCost();
  }, [loadCost]);

  if (totalCostUsd === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="text-muted-foreground">Total Cost:</span>
      <span className="font-medium text-foreground">
        ${totalCostUsd.toFixed(4)}
      </span>
    </div>
  );
};