import React from "react";
import { useTooltipText } from "@/hooks/useTooltipText";
import clsx from "clsx";

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export function Tooltip({ tooltipId }: { tooltipId: string }) {
  const tooltipData = useTooltipText(tooltipId);

  if (!tooltipData) return null;

  return (
    <div className="group relative">
      <InfoIcon className="size-3 cursor-help text-gray-400 hover:text-gray-600" />
      <div className={clsx("min-w-60 max-w-100 px-3 py-2 text-sm ",
        "pointer-events-none absolute bottom-full ",
        "left-1/2 z-20 mb-2 -translate-x-1/2 ",
        "transform rounded-md bg-gray-900",
        "text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100")}>
        <div className="space-y-1.5">
          {tooltipData.name && (
            <div className="font-semibold text-gray-100 border-b border-gray-700 pb-1">
              {tooltipData.name}
            </div>
          )}

          {tooltipData.equation && (
            <div className="font-mono text-xs bg-gray-800 px-2 py-1 rounded border text-blue-200">
              {tooltipData.equation}
            </div>
          )}

          <div className="text-gray-300 leading-relaxed">
            {tooltipData.tooltip}
          </div>
        </div>

        <div className="absolute top-full left-1/2 -translate-x-1/2 transform border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}