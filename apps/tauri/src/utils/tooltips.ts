import tooltipsData from "@/assets/tooltips.json";

export type TooltipData = {
  id: string;
  name: string;
  equation: string;
  tooltip: string;
  description?: string[];
};

const tooltipMap = Object.fromEntries(tooltipsData.map((item) => [item.id, item]));
export const getTooltip = (tooltipId: string): TooltipData | undefined => tooltipMap[tooltipId];
