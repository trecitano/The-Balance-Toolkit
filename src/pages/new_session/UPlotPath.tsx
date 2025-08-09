import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useEffect, useLayoutEffect, useRef } from "react";

type PathProps = {
  height?: number;
  points: { x: number[]; y: number[] };
  yRange?: [number, number]; // default [-1,1]
  showGuides?: boolean; // draw center crosshair
};

export function UPlotPath({
  height = 160,
  points,
  yRange = [-1, 1],
  showGuides = true,
}: PathProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  useLayoutEffect(() => {
    if (!hostRef.current || plotRef.current) return;

    const n = points.x.length;
    const idx = Array.from({ length: n }, (_, i) => i);

    const opts: uPlot.Options = {
      width: hostRef.current.clientWidth || 360,
      height,
      legend: { show: false },
      cursor: { show: false },
      scales: {
        x: {}, // index axis
        y: { range: yRange },
      },
      axes: [
        {
          // bottom
          grid: { show: false },
          ticks: { show: false },
          values: () => [],
        },
        {
          // left with "CoPy"
          label: "CoPy",
          labelSize: 20,
          labelFont: "12px system-ui, sans-serif",
          grid: { show: true },
          ticks: { show: true },
          values: (u, vals) => vals.map((v) => String(v)),
          gap: 6,
        },
      ],
      series: [
        {},
        {
          label: "CoP path",
          stroke: "#2563eb", // blue
          width: 2,
          points: { show: false },
        },
      ],
      hooks: showGuides
        ? {
            draw: [
              (u) => {
                const { ctx } = u;
                // Center crosshair (x mid of plotting area, y=0)
                const y0 = u.valToPos(0, "y", true);
                const xMid = Math.round((u.bbox.left + u.bbox.left + u.bbox.width) / 2);

                ctx.save();
                ctx.strokeStyle = "rgba(0,0,0,0.25)";
                ctx.lineWidth = 1;

                // vertical center line
                ctx.beginPath();
                ctx.moveTo(xMid, u.bbox.top);
                ctx.lineTo(xMid, u.bbox.top + u.bbox.height);
                ctx.stroke();

                // horizontal zero line
                ctx.beginPath();
                ctx.moveTo(u.bbox.left, y0);
                ctx.lineTo(u.bbox.left + u.bbox.width, y0);
                ctx.stroke();

                // Front/Back labels
                ctx.fillStyle = "rgba(17,24,39,0.9)";
                ctx.font = "12px system-ui, sans-serif";
                ctx.textBaseline = "top";
                ctx.textAlign = "left";
                ctx.fillText("Front", u.bbox.left + 4, u.bbox.top + 4);
                ctx.textBaseline = "bottom";
                ctx.fillText("Back", u.bbox.left + 4, u.bbox.top + u.bbox.height - 4);

                ctx.restore();
              },
            ],
          }
        : undefined,
    };

    plotRef.current = new uPlot(opts, [idx, points.y], hostRef.current);

    const onResize = () => {
      plotRef.current!.setSize({
        width: hostRef.current!.clientWidth,
        height,
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [height, yRange, showGuides, points]);

  useEffect(() => {
    if (!plotRef.current) return;
    const n = points.x.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    plotRef.current.setData([idx, points.y], false);
  }, [points]);

  return <div ref={hostRef} className="w-full" />;
}
