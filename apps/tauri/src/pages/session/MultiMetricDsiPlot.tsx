import { useEffect } from "react";
import uPlot from "uplot";
import { useUPlot } from "@/hooks/useUPlot";
import "uplot/dist/uPlot.min.css";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import {
  axisBorder,
  basePlotOptions,
  BLUE_COLOUR,
  drawLastPointAsCircle,
  forEachFrameInWindow,
  GREEN_COLOUR,
  hiddenXAxis,
  PLOT_DATA_SEC,
  RED_COLOUR,
  rollingXScale,
  YELLOW_COLOUR,
} from "@/pages/session/UPlot.tsx";
import { PlotFrame, SeriesToggle, SeriesToggles, useSeriesVisibility } from "@/pages/session/PlotFrame.tsx";

const SERIES: SeriesToggle[] = [
  { key: "mlsi", label: "MLSI", color: BLUE_COLOUR, enabled: true, tooltipId: "session_mlsi" },
  { key: "apsi", label: "APSI", color: RED_COLOUR, enabled: true, tooltipId: "session_apsi" },
  { key: "vsi", label: "VSI", color: YELLOW_COLOUR, enabled: true, tooltipId: "session_vsi" },
  { key: "dpsi", label: "DPSI", color: GREEN_COLOUR, enabled: true, tooltipId: "session_dpsi" },
];

function createOptions(): uPlot.Options {
  return {
    ...basePlotOptions,
    scales: {
      x: rollingXScale,
      y: {
        range: (_u, min, max) => {
          if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
          if (min === max) return [min - 0.1, max + 0.1];
          const pad = (max - min) * 0.1;
          return [min - pad, max + pad];
        },
      },
    },
    axes: [
      { ...hiddenXAxis, border: axisBorder },
      {
        scale: "y",
        grid: { show: false },
        ticks: { show: true, size: 6, stroke: "#b2b2b2" },
        border: axisBorder,
        size: 40,
      },
    ],
    series: [
      {},
      ...SERIES.map((entry) => ({ label: entry.label, stroke: entry.color, width: 2, show: entry.enabled })),
    ],
    hooks: {
      // Mark the newest point of each visible series; visibility is read from uPlot itself.
      draw: [(u) => SERIES.forEach((entry, i) => drawLastPointAsCircle(u, entry.color, { seriesIdx: i + 1 }))],
    },
  };
}

export function MultiMetricPlot({
  title,
  tooltipId,
  macAddress,
  store,
}: {
  title: string;
  tooltipId?: string;
  macAddress: number;
  store: SessionStore;
}) {
  const { hostRef, plotRef } = useUPlot(createOptions, SERIES.length + 1);
  const { series, toggle } = useSeriesVisibility(SERIES, plotRef);

  useEffect(
    () =>
      store.subscribe(
        (state) => state.processedSessionData[macAddress],
        (buffer) => {
          if (!plotRef.current || !buffer) return;

          // Only the visible window is mapped; see forEachFrameInWindow.
          const t: number[] = [];
          const mlsi: number[] = [];
          const apsi: number[] = [];
          const vsi: number[] = [];
          const dpsi: number[] = [];

          forEachFrameInWindow(buffer, PLOT_DATA_SEC, (frame) => {
            t.push(frame.timestamp / 1000);
            mlsi.push(frame.mlsi ?? 0);
            apsi.push(frame.apsi ?? 0);
            vsi.push(frame.vsi ?? 0);
            dpsi.push(frame.dpsi ?? 0);
          });

          plotRef.current.setData([t, mlsi, apsi, vsi, dpsi]);
        },
        { fireImmediately: true },
      ),
    [store, macAddress, plotRef],
  );

  return (
    <PlotFrame title={title} tooltipId={tooltipId} hostRef={hostRef}>
      <SeriesToggles series={series} onToggle={toggle} />
    </PlotFrame>
  );
}
