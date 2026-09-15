import { useEffect, useRef, useState } from "react";
import { SessionStore } from "@/store/sessionDataStore.tsx";
import { Tooltip } from "@/components/Tooltip.tsx";

interface StabilityBarGaugeProps {
  macAddress: number;
  store: SessionStore;
  title?: string;
  tooltipId?: string;
  width?: number;
}

export function StabilityBarGauge({
  macAddress,
  store,
  title = "Stability",
  tooltipId,
  width = 60,
}: StabilityBarGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stabilityIndex, setStabilityIndex] = useState<number | null>(null);
  const [canvasHeight, setCanvasHeight] = useState(200);

  // Subscribe to stability index updates
  useEffect(() => {
    const unsub = store.subscribe(
      (s) => s.processedSingleFrameSessionData?.[macAddress],
      (lastFrameData) => {
        setStabilityIndex(lastFrameData?.stabilityIndex ?? null);
      },
    );

    return () => unsub();
  }, [macAddress, store]);

  // Calculate canvas height based on parent container
  useEffect(() => {
    const updateCanvasHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;

        // Account for title and value text heights
        // Approximate: title ~20px, value text ~16px, margins ~8px
        const reservedHeight = 44;
        const availableHeight = Math.max(containerHeight - reservedHeight, 50); // minimum 50px

        setCanvasHeight(availableHeight);
      }
    };

    // Initial calculation
    updateCanvasHeight();

    // Set up ResizeObserver to watch for parent size changes
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasHeight();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Draw the gauge
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Set canvas size with device pixel ratio
    canvas.width = width * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, canvasHeight);

    // Define bar dimensions (use more of the canvas now that title is external)
    const barWidth = width * 0.5;
    const barHeight = canvasHeight * 0.9;
    const barX = (width - barWidth) / 2;
    const barY = canvasHeight * 0.05;

    // Draw the filled portion if we have a value
    if (stabilityIndex !== null && stabilityIndex >= 0 && stabilityIndex <= 1) {
      // Invert the value since lower is better for stability
      const displayValue = 1 - stabilityIndex;

      const fillHeight = barHeight * displayValue;
      const fillY = barY + barHeight - fillHeight;

      ctx.fillStyle = "#397aac";
      ctx.fillRect(barX, fillY, barWidth, fillHeight);

      // Draw current value indicator (horizontal line)
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX - 5, fillY);
      ctx.lineTo(barX + barWidth + 5, fillY);
      ctx.stroke();
    }

    // Draw background border (empty bar)
    ctx.strokeStyle = "#1f2937"; // dark gray border
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }, [stabilityIndex, width, canvasHeight]);

  return (
    <div ref={containerRef} className="flex h-full flex-col items-center">
      <div className={"relative font-semibold"}>
        {title}
        {tooltipId && (
          <div className="absolute top-1/2 left-full ml-2.5 -translate-y-1/2">
            <Tooltip tooltipId={tooltipId} />
          </div>
        )}
      </div>
      <div className="flex flex-1 items-center">
        <canvas ref={canvasRef} />
      </div>
      <div className="mt-1 text-xs">{stabilityIndex !== null ? stabilityIndex.toFixed(2) : "--"}</div>
    </div>
  );
}
