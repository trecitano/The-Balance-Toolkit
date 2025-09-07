import { useEffect, useRef, useState } from "react";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import { Tooltip } from "@/components/Tooltip.tsx";

interface StabilityBarGaugeProps {
  macAddress: number;
  store: SessionStore;
  title?: string;
  tooltipText?: string;
  width?: number;
  height?: number;
}

export function StabilityBarGauge({
  macAddress,
  store,
  title = "Stability",
  tooltipText,
  width = 60,
  height = 200,
}: StabilityBarGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stabilityIndex, setStabilityIndex] = useState<number | null>(null);

  // Subscribe to stability index updates
  useEffect(() => {
    const unsub = store.subscribe(
      (s) => s.processedSingleFrameSessionData?.[macAddress],
      (lastFrameData) => {
        setStabilityIndex(lastFrameData?.stabilityIndex ?? null);
      },
      { equalityFn: (a, b) => a === b },
    );

    return () => unsub();
  }, [macAddress, store]);

  // Draw the gauge
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Set canvas size with device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Define bar dimensions (use more of the canvas now that title is external)
    const barWidth = width * 0.5;
    const barHeight = height * 0.9;
    const barX = (width - barWidth) / 2;
    const barY = height * 0.05;

    // Draw background border (empty bar)
    ctx.strokeStyle = "#1f2937"; // dark gray border
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Draw the filled portion if we have a value
    if (stabilityIndex !== null && stabilityIndex >= 0 && stabilityIndex <= 1) {
      // Invert the value since lower is better for stability
      const displayValue = 1 - stabilityIndex;

      const fillHeight = barHeight * displayValue;
      const fillY = barY + barHeight - fillHeight;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, barY + barHeight, 0, barY);
      gradient.addColorStop(0, "#e50012");
      gradient.addColorStop(1, "#e50012");

      ctx.fillStyle = gradient;
      ctx.fillRect(barX, fillY, barWidth, fillHeight);

      // Draw current value indicator (horizontal line)
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX - 5, fillY);
      ctx.lineTo(barX + barWidth + 5, fillY);
      ctx.stroke();
    }
  }, [stabilityIndex, width, height]);

  return (
    <div className="flex flex-col items-center">
      <div className={"relative font-semibold"}>
        {title}
        {tooltipText && (
          <div className="absolute top-1/2 left-full ml-2.5 -translate-y-1/2">
            <Tooltip tooltipText={tooltipText} />
          </div>
        )}
      </div>
      <div>
        <canvas ref={canvasRef} />
      </div>
      <div className="mt-1 text-xs">{stabilityIndex !== null ? stabilityIndex.toFixed(2) : "--"}</div>
    </div>
  );
}
