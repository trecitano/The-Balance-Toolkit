import { useRef, useState, useEffect } from "react";
import "./Session.css";

function Session() {
  const [recording, setRecording] = useState(false);
  const [data, setData] = useState<number[]>([]);
  const [data2, setData2] = useState<number[]>([]);
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);

  // Simulate timeseries data for both timelines
  useEffect(() => {
    if (!recording) return;
    const draw = () => {
      setData((prev) => [
        ...prev.slice(-199),
        50 + 40 * Math.sin((prev.length + 1) / 10) + Math.random() * 10,
      ]);
      setData2((prev) => [
        ...prev.slice(-199),
        50 + 40 * Math.cos((prev.length + 1) / 15) + Math.random() * 10,
      ]);
      animationRef.current = requestAnimationFrame(draw);
    };
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [recording]);

  // Draw on first canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (data.length > 1) {
      ctx.beginPath();
      ctx.moveTo(0, 100 - data[0]);
      data.forEach((y, i) => {
        ctx.lineTo((i / 200) * canvas.width, 100 - y);
      });
      ctx.strokeStyle = "#397aac";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [data]);

  // Draw on second canvas
  useEffect(() => {
    const canvas = canvasRef2.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (data2.length > 1) {
      ctx.beginPath();
      ctx.moveTo(0, 100 - data2[0]);
      data2.forEach((y, i) => {
        ctx.lineTo((i / 200) * canvas.width, 100 - y);
      });
      ctx.strokeStyle = "#e50012";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [data2]);

  // Clear timeseries 3 seconds after recording stops
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (!recording) {
      timeout = setTimeout(() => {
        setData([]);
        setData2([]);
      }, 3000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [recording]);

  const handleRecord = () => {
    setRecording(true);
    setData([]);
    setData2([]);
  };

  const handleStop = () => {
    setRecording(false);
  };

  return (
    <div className="session-page">
      <div className="page-title">Session</div>
      <div className="session-content" style={{ flex: 1 }} />
      <div className="timeline-bar">
        <div className="timeline-canvases">
          <canvas ref={canvasRef} width={400} height={100} className="timeline-canvas" />
          <canvas ref={canvasRef2} width={400} height={100} className="timeline-canvas" />
        </div>
        <button
          className={`timeline-btn timeline-btn--icon ${recording ? "stop" : "record"}`}
          onClick={recording ? handleStop : handleRecord}
          aria-label={recording ? "Stop" : "Record"}
        >
          <span className="record-icon" />
        </button>
      </div>
    </div>
  );
}

export default Session;