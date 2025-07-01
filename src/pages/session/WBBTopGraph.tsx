import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

interface CopPoint {
  x: number;
  y: number;
  id: number;
  timestamp: number;
}

interface WBBTopGraphProps {
  trail: CopPoint[];
  current: { x: number; y: number } | null;
  bounds: { width: number; height: number } | null;
}

const CIRCLE_DIAMETER = 5;

const WBBTopGraph: React.FC<WBBTopGraphProps> = ({
  trail,
  current,
  bounds,
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!bounds) return;
    setSize({ width: bounds.width, height: bounds.height });
  }, [bounds]);

  useEffect(() => {
    if (!ref.current || !bounds) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    if (trail.length > 1) {
      const points = trail.map((p) => [
        ((p.x + 1) / 2) * bounds.width,
        ((1 - p.y) / 2) * bounds.height,
      ]);
      svg
        .append("polyline")
        .attr("points", points.map((p) => p.join(",")).join(" "))
        .attr("fill", "none")
        .attr("stroke", "rgba(0, 100, 255, 0.6)")
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    }

    if (current) {
      const cx = ((current.x + 1) / 2) * bounds.width;
      const cy = ((1 - current.y) / 2) * bounds.height;
      svg
        .append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", CIRCLE_DIAMETER)
        .attr("fill", "#007bff")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
    }
  }, [trail, current, bounds]);

  if (!bounds) return null;

  return (
    <svg
      ref={ref}
      width={size.width}
      height={size.height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        zIndex: 5,
        width: size.width,
        height: size.height,
      }}
    />
  );
};

export default WBBTopGraph;
