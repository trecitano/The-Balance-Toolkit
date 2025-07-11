import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

interface CopXGraphProps {
  data: number[];
}

const CopXGraph: React.FC<CopXGraphProps> = ({ data }) => {
  const ref = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const CIRCLE_RADIUS = 5;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ref.current || size.width === 0 || size.height === 0) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const padding = { top: 40, right: 10, bottom: 15, left: 10 };
    const graphWidth = size.width - padding.left - padding.right;
    const graphHeight = size.height - padding.top - padding.bottom;

    const x = d3
      .scaleLinear()
      .domain([-1, 1])
      .range([padding.left, padding.left + graphWidth]);
    const MAX_POINTS = 200;

    const y = d3
      .scaleLinear()
      .domain([0, MAX_POINTS - 1])
      .range([padding.top, size.height - padding.bottom]);

    svg
      .append("line")
      .attr("x1", padding.left)
      .attr("y1", padding.top)
      .attr("x2", padding.left + graphWidth)
      .attr("y2", padding.top)
      .attr("stroke", "#222")
      .attr("stroke-width", 1);

    const centerX = x(0);
    svg
      .append("line")
      .attr("x1", centerX)
      .attr("y1", padding.top)
      .attr("x2", centerX)
      .attr("y2", size.height - padding.bottom)
      .attr("stroke", "#222")
      .attr("stroke-width", 1);

    const xTicks = [-1, 0, 1];
    const xLabels = { "-1": "Left", "0": "CoPx", "1": "Right" };
    xTicks.forEach((val) => {
      svg
        .append("text")
        .attr("x", x(val))
        .attr("y", padding.top - 8)
        .attr("text-anchor", val === 0 ? "middle" : val < 0 ? "start" : "end")
        .attr("font-size", 10)
        .attr("fill", "#222")
        .text(xLabels[val]);
      svg
        .append("line")
        .attr("x1", x(val))
        .attr("y1", padding.top)
        .attr("x2", x(val))
        .attr("y2", padding.top - 5)
        .attr("stroke", "#222")
        .attr("stroke-width", 1);
    });

    if (data.length > 1) {
      const line = d3
        .line<number>()
        .x((d) => x(d))
        .y((_, i) => y(i))
        .curve(d3.curveMonotoneY);

      svg
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#007bff")
        .attr("stroke-width", 2)
        .attr("d", line);
    }

    if (data.length > 0) {
      const lastIdx = data.length - 1;
      svg
        .append("circle")
        .attr("cx", x(data[lastIdx]))
        .attr("cy", y(lastIdx))
        .attr("r", CIRCLE_RADIUS)
        .attr("fill", "#007bff");
    }
  }, [data, size]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <svg
        ref={ref}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ display: "block", width: "100%", height: "100%" }}
        className="copx-graph-svg"
      />
    </div>
  );
};

export default CopXGraph;
