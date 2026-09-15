import { ReactNode, RefObject, useEffect, useState } from "react";
import uPlot from "uplot";
import { Tooltip } from "@/components/Tooltip.tsx";

export type SeriesToggle = { key: string; label: string; color: string; enabled: boolean; tooltipId?: string };

/** Per-series show/hide state, pushed to the uPlot instance whenever it changes. */
export function useSeriesVisibility(initial: SeriesToggle[], plotRef: RefObject<uPlot | null>) {
  const [series, setSeries] = useState(initial);
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    // Series index 0 is the x axis.
    series.forEach((entry, index) => plot.setSeries(index + 1, { show: entry.enabled }));
  }, [series, plotRef]);
  return {
    series,
    toggle: (key: string) =>
      setSeries((previous) => previous.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))),
  };
}

/** Title with optional tooltip, the plot host, and a footer row for toggles. */
export function PlotFrame({
  title,
  tooltipId,
  hostRef,
  children,
}: {
  title: string;
  tooltipId?: string;
  hostRef: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}) {
  return (
    <div className="h-full w-full">
      <div className="relative flex h-1/10 items-center justify-center">
        <div className="relative font-semibold">
          {title}
          {tooltipId && (
            <div className="absolute top-1/2 left-full ml-2.5 -translate-y-1/2">
              <Tooltip tooltipId={tooltipId} />
            </div>
          )}
        </div>
      </div>
      <div ref={hostRef} className="h-78/100 w-full" />
      <div className="mb-2 flex h-1/10 items-center justify-between">{children}</div>
    </div>
  );
}

export function SeriesToggles({ series, onToggle }: { series: SeriesToggle[]; onToggle: (key: string) => void }) {
  return (
    <div className="ml-auto flex gap-3">
      {series.map((entry) => (
        <label key={entry.key} className="flex cursor-pointer items-center gap-1">
          <input type="checkbox" checked={entry.enabled} onChange={() => onToggle(entry.key)} className="size-3" />
          <span className="text-xs font-medium" style={{ color: entry.enabled ? entry.color : "#9ca3af" }}>
            {entry.label}
          </span>
          {entry.tooltipId && <Tooltip tooltipId={entry.tooltipId} />}
        </label>
      ))}
    </div>
  );
}
