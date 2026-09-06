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

function isClippingOverflow(value: string) {
  // Treat auto | scroll | hidden | clip as clipping contexts
  return /(auto|scroll|hidden|clip)/.test(value);
}

function nearestOverflowAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement || null;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    if (isClippingOverflow(cs.overflowY) || isClippingOverflow(cs.overflow)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function Tooltip({ tooltipId }: { tooltipId: string }) {
  const tooltipData = useTooltipText(tooltipId);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showBelow, setShowBelow] = useState(false);

  useEffect(() => {
    const handleMouseEnter = () => {
      if (!containerRef.current || !tooltipRef.current) return;

      const triggerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      const overflowParent = nearestOverflowAncestor(containerRef.current);

      // The top boundary that can clip the tooltip is the intersection
      // of the viewport top (0) and the nearest overflow ancestor top.
      const boundaryTop = Math.max(0, overflowParent ? overflowParent.getBoundingClientRect().top : 0);

      const spaceAboveWithin = triggerRect.top - boundaryTop;

      const tooltipHeight = tooltipRect.height || 200;
      const buffer = 20; // spacing + safety

      // If placing above would be clipped by the overflow boundary (or viewport),
      // then place it below instead.
      setShowBelow(spaceAboveWithin < tooltipHeight + buffer);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter);
      return () => container.removeEventListener("mouseenter", handleMouseEnter);
    }
  }, []);

  if (!tooltipData) return null;

  return (
    <div className="group relative" ref={containerRef}>
      <InfoIcon className="size-4 cursor-help text-gray-400 hover:text-gray-600" />
      <div
        ref={tooltipRef}
        className={clsx(
          "pointer-events-none absolute left-1/2 z-30 min-w-60 px-3 py-2 text-sm",
          "-translate-x-1/2 transform rounded-md bg-gray-900 text-white",
          "opacity-0 shadow-lg transition-opacity duration-200",
          "group-hover:opacity-100",
          showBelow ? "top-full mt-2" : "bottom-full mb-2",
        )}
      >
        <div className="space-y-2">
          {tooltipData.name && (
            <div className="border-b border-gray-700 pb-1 font-semibold text-gray-100">{tooltipData.name}</div>
          )}

          {tooltipData.equation && (
            <div
              className="rounded border bg-gray-800 px-2 py-1 font-mono text-sm text-blue-200"
              dangerouslySetInnerHTML={{ __html: tooltipData.equation }}
            />
          )}

          <div className="leading-relaxed text-gray-300">{tooltipData.tooltip}</div>

          {tooltipData.description && tooltipData.description.length > 0 && (
            <div className="border-t border-gray-700 pt-2">
              <ul className="space-y-1 text-xs text-gray-400">
                {tooltipData.description.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mt-1.5 mr-2 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-gray-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Arrow */}
        <div
          className={clsx(
            "absolute left-1/2 -translate-x-1/2 transform",
            "border-4 border-transparent",
            showBelow ? "bottom-full border-b-gray-900" : "top-full border-t-gray-900",
          )}
        />
      </div>
    </div>
  );
}
