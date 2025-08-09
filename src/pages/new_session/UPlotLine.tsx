import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useEffect, useLayoutEffect, useRef } from "react";

type SeriesData = { t: number[]; y: number[] };
export function UPlotLine({
  label,
  color = "#dc2626", // red
  height = 150,
  data,
  yLabel = "", // NEW: axis label (e.g., "vCoPx", "vCoPy")
  yRange, // NEW: [min, max] if you want fixed range
}: {
  label: string;
  color?: string;
  height?: number;
  data: SeriesData;
  yLabel?: string;
  yRange?: [number, number] | null;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const widthRef = useRef(0);

  useLayoutEffect(() => {
    if (!hostRef.current || plotRef.current) return;

    const width = hostRef.current.clientWidth || 300;
    widthRef.current = width;

    const opts: uPlot.Options = {
      width,
      height,
      legend: { show: false },
      cursor: { show: false },
      scales: {
        x: {}, // time axis is fine without time formatting
        y: yRange ? { range: yRange } : {},
      },
      axes: [
        {
          // bottom axis
          grid: { show: false },
          ticks: { show: true },
          values: (u, vals) => vals.map((v) => String(v)),
        },
        {
          // left axis with label
          label: yLabel || undefined,
          labelSize: 20,
          labelFont: "12px system-ui, sans-serif",
          grid: { show: true },
          ticks: { show: true },
          values: (u, vals) => vals.map((v) => String(v)),
          // a little padding so label isn't clipped
          gap: 6,
        },
      ],
      series: [{}, { label, stroke: color, width: 2, points: { show: false } }],
    };

    plotRef.current = new uPlot(opts, [data.t, data.y], hostRef.current);

    const onResize = () => {
      const w = hostRef.current!.clientWidth;
      if (w !== widthRef.current) {
        widthRef.current = w;
        plotRef.current!.setSize({ width: w, height });
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [height, yLabel, color, yRange, data]);

  useEffect(() => {
    if (!plotRef.current) return;
    plotRef.current.setData([data.t, data.y], false);
  }, [data]);

  return <div ref={hostRef} className="w-full" />;
}
