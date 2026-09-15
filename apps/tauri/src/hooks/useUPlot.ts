import { useLayoutEffect, useRef, useState } from "react";
import uPlot from "uplot";

/**
 * Options and series count are the mount preset; the plot is created once. Series
 * visibility and data are updated on the instance.
 */
export function useUPlot(createOptions: () => uPlot.Options, seriesCount: number) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [options] = useState(createOptions);
  const [initialSeriesCount] = useState(seriesCount);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const plot = new uPlot(
      { ...options, width: rect.width, height: rect.height },
      [[], ...Array.from({ length: initialSeriesCount - 1 }, (): number[] => [])],
      host,
    );
    plotRef.current = plot;
    const observer = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect();
      plot.setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [options, initialSeriesCount]);
  return { hostRef, plotRef };
}
