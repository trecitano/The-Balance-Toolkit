import { useEffect } from "react";
import uPlot from "uplot";
import { useUPlot } from "@/hooks/useUPlot";
import "uplot/dist/uPlot.min.css";
import { axisBorder, basePlotOptions, BLUE_COLOUR, RED_COLOUR, YELLOW_COLOUR } from "@/pages/session/UPlot.tsx";
import { PlotFrame, SeriesToggle, SeriesToggles, useSeriesVisibility } from "@/pages/session/PlotFrame.tsx";
import { SessionStore } from "@/store/sessionDataStore.tsx";

interface Props {
  title: string;
  tooltipId?: string;
  macAddress: number;
  store: SessionStore;
}

const MAX_FREQ = 2.0;

// Legend colours and line colours come from the same list.
const SERIES: SeriesToggle[] = [
  { key: "x", label: "X", color: BLUE_COLOUR, enabled: false },
  { key: "y", label: "Y", color: RED_COLOUR, enabled: false },
  { key: "xy", label: "Combined", color: YELLOW_COLOUR, enabled: true },
];

function createOptions(): uPlot.Options {
  const axis = { grid: { show: false }, ticks: { show: false }, border: axisBorder };
  return {
    ...basePlotOptions,
    scales: {
      x: { time: false, range: [0, MAX_FREQ] },
      y: { range: [0, 1] },
    },
    axes: [
      { ...axis, scale: "x", size: 20 },
      { ...axis, scale: "y", size: 40 },
    ],
    series: [
      {}, // x-axis values (freqs)
      ...SERIES.map((entry) => ({
        label: entry.label,
        stroke: entry.color,
        width: entry.key === "xy" ? 3 : 2,
        fill: entry.key === "xy" ? "rgba(59, 130, 246, 0.1)" : undefined,
        show: entry.enabled,
      })),
    ],
  };
}

export function FFTAmplitudePlot({ title, tooltipId, macAddress, store }: Props) {
  const { hostRef, plotRef } = useUPlot(createOptions, SERIES.length + 1);
  const { series, toggle } = useSeriesVisibility(SERIES, plotRef);

  useEffect(
    () =>
      store.subscribe(
        (state) => state.processedSingleFrameSessionData[macAddress]?.amplitudeSpectrum,
        (spectrum) => {
          if (!plotRef.current || !spectrum) return;

          const idx = spectrum.freqs_hz.findIndex((f) => f > MAX_FREQ);
          const endIdx = idx === -1 ? spectrum.freqs_hz.length : idx;

          plotRef.current.setData([
            spectrum.freqs_hz.slice(0, endIdx),
            spectrum.amplitude_x.slice(0, endIdx),
            spectrum.amplitude_y.slice(0, endIdx),
            spectrum.amplitude_xy.slice(0, endIdx),
          ]);
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
