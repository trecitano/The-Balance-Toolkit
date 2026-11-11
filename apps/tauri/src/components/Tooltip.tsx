import { Fragment, useRef, useState, useId } from "react";
import { getTooltip } from "@/utils/tooltips";
import clsx from "clsx";

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

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

/** A label and value shown under a tooltip's text, such as the port a stream uses. */
export type TooltipDetail = { label: string; value: string };

// Which edge of the tooltip lines up with its icon: centred, or pinned to the icon's side when
// centring would push it past an edge.
type Align = "start" | "center" | "end";
const tooltipAlign: Record<Align, string> = { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" };
const arrowAlign: Record<Align, string> = { start: "left-1", center: "left-1/2 -translate-x-1/2", end: "right-1" };

export function Tooltip({ tooltipId, details }: { tooltipId: string; details?: TooltipDetail[] }) {
  const tooltipContentId = useId();
  const tooltipData = getTooltip(tooltipId);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ below: boolean; align: Align }>({ below: false, align: "center" });

  // Decide the placement when the tooltip is about to appear: below the trigger if placing it
  // above would be clipped, and pinned to one side if centring it would cross the left or right
  // edge. The edges are those of the nearest scrolling ancestor, within the window.
  const choosePlacement = () => {
    if (!containerRef.current || !tooltipRef.current) return;
    const triggerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const boundary = nearestOverflowAncestor(containerRef.current)?.getBoundingClientRect();
    const top = Math.max(0, boundary?.top ?? 0);
    const left = Math.max(0, boundary?.left ?? 0);
    const right = Math.min(document.documentElement.clientWidth, boundary?.right ?? Infinity);
    const tooltipHeight = tooltipRect.height || 200;
    const buffer = 20; // spacing + safety
    const margin = 8;
    const iconCentre = triggerRect.left + triggerRect.width / 2;
    const halfWidth = tooltipRect.width / 2;
    setPlacement({
      below: triggerRect.top - top < tooltipHeight + buffer,
      align:
        iconCentre + halfWidth > right - margin ? "end" : iconCentre - halfWidth < left + margin ? "start" : "center",
    });
  };

  if (!tooltipData) return null;

  return (
    <div className="group relative" ref={containerRef} onMouseEnter={choosePlacement} onFocus={choosePlacement}>
      <button
        type="button"
        aria-label={`About ${tooltipData.name}`}
        aria-describedby={tooltipContentId}
        className="block shrink-0 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <InfoIcon className="size-4 cursor-help text-gray-400 hover:text-gray-600" />
      </button>
      <div
        ref={tooltipRef}
        id={tooltipContentId}
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute z-30 px-3 py-2 text-sm",
          tooltipAlign[placement.align],
          details ? "w-96" : "min-w-60",
          "rounded-md bg-gray-900 text-white",
          "opacity-0 shadow-lg transition-opacity duration-200",
          "group-hover:opacity-100 group-has-focus-visible:opacity-100",
          placement.below ? "top-full mt-2" : "bottom-full mb-2",
        )}
      >
        <div className="space-y-2">
          {tooltipData.name && (
            <div className="border-b border-gray-700 pb-1 font-semibold text-gray-100">{tooltipData.name}</div>
          )}

          {tooltipData.equation && (
            // Equations are bundled markup from assets/tooltips.json, not user input.
            <div
              className="rounded border bg-gray-800 px-2 py-1 font-mono text-sm text-blue-200"
              dangerouslySetInnerHTML={{ __html: tooltipData.equation }}
            />
          )}

          <div className="leading-relaxed text-gray-300">{tooltipData.tooltip}</div>

          {details && details.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-gray-700 pt-2 text-xs">
              {details.map(({ label, value }) => (
                <Fragment key={label}>
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="font-mono break-all text-gray-100">{value}</dd>
                </Fragment>
              ))}
            </dl>
          )}

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
            "absolute",
            arrowAlign[placement.align],
            "border-4 border-transparent",
            placement.below ? "bottom-full border-b-gray-900" : "top-full border-t-gray-900",
          )}
        />
      </div>
    </div>
  );
}
