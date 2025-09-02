import { useEffect, useRef, useState } from "react";
import { SessionState } from "@/store/sessionDataStore.tsx";
import { StoreApi } from "zustand";

interface StabilityBarGaugeProps {
  macAddress: number;
  store: StoreApi<SessionState>;
  width?: number;
  height?: number;
}

export function StabilityBarGauge({
                                    macAddress,
                                    store,
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

    // Define bar dimensions
    const barWidth = width * 0.5;
    const barHeight = height * 0.8;
    const barX = (width - barWidth) / 2;
    const barY = height * 0.1;

    // Draw background (empty bar)
    ctx.fillStyle = "#1f2937"; // dark gray
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw the filled portion if we have a value
    if (stabilityIndex !== null && stabilityIndex >= 0 && stabilityIndex <= 1) {
      // Invert the value since lower is better for stability
      // If your stability index already has 0 as best and 1 as worst, remove this inversion
      const displayValue = 1 - stabilityIndex;

      const fillHeight = barHeight * displayValue;
      const fillY = barY + barHeight - fillHeight;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, barY + barHeight, 0, barY);

      // Color stops from bottom to top
      // Bottom (good stability) - green
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

    // Draw value display below the bar
    if (stabilityIndex !== null) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        stabilityIndex.toFixed(3),
        width / 2,
        barY + barHeight + 10
      );
    }

    // Draw label at top
    ctx.fillStyle = "#000000";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Stability", width / 2, barY - 5);

  }, [stabilityIndex, width, height]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} />
    </div>
  );
}