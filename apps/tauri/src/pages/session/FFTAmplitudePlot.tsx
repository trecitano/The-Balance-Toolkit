import { useEffect, useRef } from "react";
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

/** Highest frequency shown, in Hz. The core already stops at this bound. */
const MAX_FREQ = 2.0;
/** Lowest axis ceiling, in mm, so an empty board does not collapse the scale. */
const MIN_CEILING_MM = 1;
/** Headroom above the tallest bin so it never touches the top edge. */
const HEADROOM = 1.15;
/**
 * Per-frame decay of the axis ceiling. Results arrive about ten times a second, so the
 * ceiling follows a growing spectrum immediately and takes a few seconds to come back down.
 */
const CEILING_DECAY = 0.98;

// Legend colours and line colours come from the same list.
const SERIES: SeriesToggle[] = [
  { key: "x", label: "X", color: BLUE_COLOUR, enabled: false },
  { key: "y", label: "Y", color: RED_COLOUR, enabled: false },
  { key: "xy", label: "Combined", color: YELLOW_COLOUR, enabled: true },
];

/** Round up to 1, 2 or 5 times a power of ten so the axis does not flicker between frames. */
function niceCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Amplitude in mm against frequency in Hz; the y ceiling follows the data, see `CEILING_DECAY`. */
function createOptions(ceilingRef: { readonly current: number }): uPlot.Options {
  // Axis sizes add to the plot's outer height and width, so they stay as they were; the units
  // go on the outermost tick label instead of a separate axis label.
  const axis = { grid: { show: false }, ticks: { show: false }, border: axisBorder, font: "10px sans-serif" };
  const withUnit =
    (unit: string) =>
    (_: uPlot, splits: number[]): string[] =>
      splits.map((value, i) => (i === splits.length - 1 ? `${value} ${unit}` : String(value)));
  return {
    ...basePlotOptions,
    scales: {
      x: { time: false, range: [0, MAX_FREQ] },
      y: { range: () => [0, niceCeiling(ceilingRef.current)] },
    },
    axes: [
      { ...axis, scale: "x", size: 20, values: withUnit("Hz") },
      { ...axis, scale: "y", size: 40, values: withUnit("mm") },
    ],
    series: [
      {}, // bin frequencies
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
  const ceilingRef = useRef(MIN_CEILING_MM);
  const { hostRef, plotRef } = useUPlot(() => createOptions(ceilingRef), SERIES.length + 1);
  const { series, toggle } = useSeriesVisibility(SERIES, plotRef);

  useEffect(
    () =>
      store.subscribe(
        (state) => state.processedSingleFrameSessionData[macAddress]?.amplitudeSpectrum,
        (spectrum) => {
          if (!plotRef.current || !spectrum) return;

          const idx = spectrum.freqs_hz.findIndex((f) => f > MAX_FREQ);
          const endIdx = idx === -1 ? spectrum.freqs_hz.length : idx;

          // Combined bounds both directions, so it alone sets the ceiling. The raw value
          // decays here; rounding happens in the scale so the decay is not undone each frame.
          const tallest = Math.max(0, ...spectrum.amplitude_xy.slice(0, endIdx));
          const decayed = Math.max(MIN_CEILING_MM, ceilingRef.current * CEILING_DECAY);
          ceilingRef.current = Math.max(tallest * HEADROOM, decayed);

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
