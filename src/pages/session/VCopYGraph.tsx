import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

interface VCopYGraphProps {
  data: number[];
  containerHeight?: number;
}

const CIRCLE_RADIUS = 5;

const VCopYGraph: React.FC<VCopYGraphProps> = ({ data, containerHeight }) => {
  const ref = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
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

    const MAX_POINTS = 200;
    const plotData = data.slice(-MAX_POINTS);

    const baseFontSize = Math.max(8, Math.min(14, Math.floor((containerHeight ?? size.height) * 0.07)));
    const dynamicGraphCircleDiameter = Math.max(4, Math.min(10, Math.floor((containerHeight ?? size.height) * 0.04)));
    const padding = {
      top: Math.max(1, baseFontSize * 0.1),
      right: Math.max(2, baseFontSize * 0.2) + (dynamicGraphCircleDiameter / 2),
      bottom: Math.max(1, baseFontSize * 0.1),
      left: baseFontSize * 4.5
    };

    const graphWidth = size.width - padding.left - padding.right;
    const graphHeight = size.height - padding.top - padding.bottom;

    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([padding.top + graphHeight, padding.top]);

    const x = d3.scaleLinear()
      .domain([0, MAX_POINTS - 1])
      .range([padding.left, padding.left + graphWidth - (dynamicGraphCircleDiameter / 2)]);

    // Y axis
    svg.append("line")
      .attr("x1", padding.left)
      .attr("y1", padding.top)
      .attr("x2", padding.left)
      .attr("y2", padding.top + graphHeight)
      .attr("stroke", "#222")
      .attr("stroke-width", 1);

    // X axis
    svg.append("line")
      .attr("x1", padding.left)
      .attr("y1", padding.top + graphHeight)
      .attr("x2", padding.left + graphWidth)
      .attr("y2", padding.top + graphHeight)
      .attr("stroke", "#222")
      .attr("stroke-width", 1);

    // Y ticks and labels
    const yTicks = [0, 0.5, 1];
    const yLabels: { [key: number]: string } = {
      1: "1",
      0.5: "vCoPy",
      0: "0"
    };
    yTicks.forEach(val => {
      const yPos = y(val);
      svg.append("line")
        .attr("x1", padding.left - 5)
        .attr("y1", yPos)
        .attr("x2", padding.left)
        .attr("y2", yPos)
        .attr("stroke", "#222")
        .attr("stroke-width", 1);

      svg.append("text")
        .attr("x", padding.left - 8)
        .attr("y", yPos)
        .attr("text-anchor", "end")
        .attr("font-size", 10)
        .attr("fill", "#222")
        .attr("dominant-baseline", val === 1 ? "hanging" : val === 0 ? "baseline" : "middle")
        .text(yLabels[val]);
    });

    // Line
    if (plotData.length > 1) {
      const line = d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y((d + 1) / 2))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(plotData)
        .attr("fill", "none")
        .attr("stroke", "#dc3545")
        .attr("stroke-width", 2)
        .attr("d", line);
    }

    // Circle at last data point
    if (plotData.length > 0) {
      const lastIdx = plotData.length - 1;
      svg.append("circle")
        .attr("cx", x(lastIdx))
        .attr("cy", y((plotData[lastIdx] + 1) / 2))
        .attr("r", CIRCLE_RADIUS)
        .attr("fill", "#dc3545");
    }
  }, [data, size, containerHeight]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <svg
        ref={ref}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ display: "block", width: "100%", height: "100%" }}
        className="vcopy-graph-svg"
      />
    </div>
  );
};

export default VCopYGraph;