import { useMemo } from "react";
import tooltipsData from "@/assets/tooltips.json";

type TooltipData = {
  id: string;
  name: string;
  equation: string;
  tooltip: string;
  description?: string[];
};

export const useTooltipText = (tooltipId: string): TooltipData | undefined => {
  const tooltipMap = useMemo(() => {
    return tooltipsData.reduce((acc: Record<string, TooltipData>, item: TooltipData) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, []);

  return tooltipMap[tooltipId];
};
