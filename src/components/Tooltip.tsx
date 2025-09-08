import React, { useRef, useState, useEffect } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showBelow, setShowBelow] = useState(false);

  useEffect(() => {
    const handleMouseEnter = () => {
      if (!containerRef.current || !tooltipRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Calculate space above the trigger element
      const spaceAbove = containerRect.top;
      // Add some buffer (e.g., 20px) to ensure tooltip doesn't get cut off
      const tooltipHeight = tooltipRect.height || 200; // Fallback height estimate
      const buffer = 20;

      // If there's not enough space above, show below
      setShowBelow(spaceAbove < tooltipHeight + buffer);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mouseenter', handleMouseEnter);
      return () => container.removeEventListener('mouseenter', handleMouseEnter);
    }
  }, []);

  if (!tooltipData) return null;

  return (
    <div className="group relative" ref={containerRef}>
      <InfoIcon className="size-3 cursor-help text-gray-400 hover:text-gray-600" />
      <div
        ref={tooltipRef}
        className={clsx(
          "min-w-60 px-3 py-2 text-sm pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 transform rounded-md bg-gray-900 text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100",
          showBelow ? "top-full mt-2" : "bottom-full mb-2"
        )}
      >
        <div className="space-y-2">
          {tooltipData.name && (
            <div className="font-semibold text-gray-100 border-b border-gray-700 pb-1">
              {tooltipData.name}
            </div>
          )}

          {tooltipData.equation && (
            <div
              className="font-mono text-sm bg-gray-800 px-2 py-1 rounded border text-blue-200"
              dangerouslySetInnerHTML={{ __html: tooltipData.equation }}
            />
          )}

          <div className="text-gray-300 leading-relaxed">
            {tooltipData.tooltip}
          </div>

          {tooltipData.description && tooltipData.description.length > 0 && (
            <div className="border-t border-gray-700 pt-2">
              <ul className="space-y-1 text-xs text-gray-400">
                {tooltipData.description.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="inline-block w-1 h-1 bg-gray-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={clsx(
          "absolute left-1/2 -translate-x-1/2 transform border-4 border-transparent",
          showBelow
            ? "bottom-full border-b-gray-900"
            : "top-full border-t-gray-900"
        )}></div>
      </div>
    </div>
  );
}