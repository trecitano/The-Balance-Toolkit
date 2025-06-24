import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const data = [12, 5, 6, 6, 9, 10];

export const SessionGraph: React.FC = () => {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove(); // Clear previous renders

    svg
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (_, i) => i * 35)
      .attr("y", d => 120 - d * 10)
      .attr("width", 30)
      .attr("height", d => d * 10)
      .attr("fill", "#007bff");
  }, []);

  return (
    <svg ref={ref} width={220} height={130} />
  );
};