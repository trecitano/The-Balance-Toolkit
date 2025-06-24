import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

interface CopYGraphProps {
  data: number[];
}

const CopYGraph: React.FC<CopYGraphProps> = ({ data }) => {
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

    const padding = { top: 1, right: 30, bottom: 1, left: 40 }; 
    const graphWidth = size.width - padding.left - padding.right;
    const graphHeight = size.height - padding.top - padding.bottom;
    const MAX_POINTS = 200;

    
    const paddedData =
      data.length < MAX_POINTS
        ? data.concat(Array(MAX_POINTS - data.length).fill(0))
        : data.slice(-MAX_POINTS);

    
    const y = d3.scaleLinear()
      .domain([-1, 1])
      .range([padding.top + graphHeight, padding.top]);

    
    const x = d3.scaleLinear()
      .domain([0, MAX_POINTS - 1])
      .range([padding.left, padding.left + graphWidth]);

    
    svg.append("line")
      .attr("x1", padding.left)
      .attr("y1", padding.top)
      .attr("x2", padding.left)
      .attr("y2", padding.top + graphHeight)
      .attr("stroke", "#222")
      .attr("stroke-width", 1);

    
    svg.append("line")
      .attr("x1", padding.left)
      .attr("y1", y(0))
      .attr("x2", padding.left + graphWidth)
      .attr("y2", y(0))
      .attr("stroke", "#222")
      .attr("stroke-width", 1);

    
    const yTicks = [-1, 0, 1];
    const yLabels = { "-1": "Back", "0": "CoPy", "1": "Front" };
    yTicks.forEach(val => {
      let baseline = "middle";
      if (val === 1) baseline = "hanging";      
      if (val === -1) baseline = "baseline";    
      svg.append("text")
        .attr("x", padding.left - 8)
        .attr("y", y(val))
        .attr("text-anchor", "end")
        .attr("font-size", 10)
        .attr("fill", "#222")
        .attr("dominant-baseline", baseline)
        .text(yLabels[val]);
      svg.append("line")
        .attr("x1", padding.left -  5)
        .attr("y1", y(val))
        .attr("x2", padding.left)
        .attr("y2", y(val))
        .attr("stroke", "#222")
        .attr("stroke-width", 1);
    });

    
    if (data.length > 1) {
      const line = d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#007bff")
        .attr("stroke-width", 2)
        .attr("d", line);
    }

    
    if (data.length > 0) {
      const lastIdx = data.length - 1;
      svg.append("circle")
        .attr("cx", x(lastIdx))
        .attr("cy", y(data[lastIdx]))
        .attr("r", 5)
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
        className="copy-graph-svg"
      />
    </div>
  );
};

export default CopYGraph;