import { useEffect, useLayoutEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { SessionState } from "@/store/sessionDataStore.tsx";
import { StoreApi } from "zustand";
import { FrequencySpectrum } from "@/types.ts";

type Props = {
  title: string;
  macAddress: number;
  store: StoreApi<SessionState>;
  maxFreq?: number; // Optional frequency limit for display
  logScale?: boolean; // Optional log scale for PSD
};

export function PSDPlot({
  title,
  macAddress,
  store,
  maxFreq = 5.0, // Default to 5 Hz (typical for postural sway)
  logScale = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Mount uPlot once
  useLayoutEffect(() => {
    if (!hostRef.current || plotRef.current) return;

    const rect = hostRef.current.getBoundingClientRect();

    const uPlotOptions: uPlot.Options = {
      width: rect.width,
      height: rect.height,
      legend: { show: false },
      cursor: { show: true },
      scales: {
        x: {
          time: false,
          range: [0, maxFreq],
        },
        y: {
          range: [0.000000001, 10],
          distr: logScale ? 3 : 1, // 3 = log scale, 1 = linear
        },
      },
      axes: [
        {
          scale: "x",
          label: "Frequency (Hz)",
          grid: { show: true, stroke: "#e5e7eb", width: 1 },
          ticks: { show: true, stroke: "#9ca3af", width: 1 },
          font: "12px sans-serif",
        },
        {
          scale: "y",
          label: logScale ? "PSD (mm²/Hz) [log]" : "PSD (mm²/Hz)",
          grid: { show: true, stroke: "#e5e7eb", width: 1 },
          ticks: { show: true, stroke: "#9ca3af", width: 1 },
          font: "12px sans-serif",
        },
      ],
      series: [
        {},
        {
          stroke: "#3b82f6",
          width: 2,
          fill: "rgba(59, 130, 246, 0.1)",
        },
      ],
    };

    plotRef.current = new uPlot(uPlotOptions, [[], []], hostRef.current);

    const resizeObserver = new ResizeObserver(() => {
      if (!hostRef.current || !plotRef.current) return;
      const r = hostRef.current.getBoundingClientRect();
      plotRef.current.setSize({ width: r.width, height: r.height });
    });

    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [maxFreq, logScale]);

  // Subscribe to frequency spectrum updates
  useEffect(() => {
    const unsub = store.subscribe(
      (state) => state.processedSingleFrameSessionData?.[macAddress]?.frequencySpectrum,
      (spectrum: FrequencySpectrum | undefined) => {
        if (!plotRef.current || !spectrum) {
          return;
        }

        // Filter data to maxFreq
        const filteredData = spectrum.freqs_hz.reduce(
          (acc, freq, i) => {
            if (freq <= maxFreq) {
              acc.freqs.push(freq);
              acc.psd.push(spectrum.psd_xy[i]);
            }
            return acc;
          },
          { freqs: [] as number[], psd: [] as number[] },
        );

        plotRef.current.setData([filteredData.freqs, filteredData.psd]);
      },
      {
        equalityFn: (a, b) => {
          // Deep comparison for frequency spectrum
          if (a === b) return true;
          if (!a || !b) return false;
          return (
            a.freqs_hz.length === b.freqs_hz.length &&
            a.psd_xy.length === b.psd_xy.length &&
            a.freqs_hz.every((f, i) => f === b.freqs_hz[i]) &&
            a.psd_xy.every((p, i) => Math.abs(p - b.psd_xy[i]) < 1e-6)
          );
        },
      },
    );

    return () => unsub();
  }, [macAddress, maxFreq, store]);

  return (
    <div className="h-full w-full">
      <p className="h-1/10 text-center text-sm font-medium">{title}</p>
      <div ref={hostRef} className="h-9/10 w-full" />
    </div>
  );
}
