import { useRef, useState, useEffect, useCallback } from "react";
import "./Session.css";

function Session() {
  const [recording, setRecording] = useState(false);
  const [data, setData] = useState<number[]>([]);
  const [data2, setData2] = useState<number[]>([]);
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);

  // State for "Stop After" feature
  const [stopAfterEnabled, setStopAfterEnabled] = useState(false);
  const [stopAfterTime, setStopAfterTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [showStopAfterDropdown, setShowStopAfterDropdown] = useState(false);
  // State for dropdown inputs
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(0);
  const [inputSeconds, setInputSeconds] = useState(0);

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

  const handleStop = useCallback(() => {
    setRecording(false);
  }, [setRecording]);

  // "Stop After" feature handlers
  const handleOpenStopAfterDropdown = () => {
    if (stopAfterEnabled) {
      setInputHours(stopAfterTime.hours);
      setInputMinutes(stopAfterTime.minutes);
      setInputSeconds(stopAfterTime.seconds);
    } else {
      setInputHours(0);
      setInputMinutes(0);
      setInputSeconds(0);
    }
    setShowStopAfterDropdown(true);
  };

  const handleSubmitStopAfter = () => {
    const totalSeconds = inputHours * 3600 + inputMinutes * 60 + inputSeconds;
    if (totalSeconds > 0) {
      setStopAfterTime({ hours: inputHours, minutes: inputMinutes, seconds: inputSeconds });
      setStopAfterEnabled(true);
    } else {
      setStopAfterTime({ hours: 0, minutes: 0, seconds: 0 });
      setStopAfterEnabled(false); // Show "OFF" if submitted time is zero
    }
    setShowStopAfterDropdown(false);
  };

  const handleResetStopAfter = () => {
    setStopAfterEnabled(false);
    setStopAfterTime({ hours: 0, minutes: 0, seconds: 0 });
    setInputHours(0);
    setInputMinutes(0);
    setInputSeconds(0);
    setShowStopAfterDropdown(false);
  };

  // Effect for "Stop After" timer
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (recording && stopAfterEnabled) {
      const totalDurationInSeconds = stopAfterTime.hours * 3600 + stopAfterTime.minutes * 60 + stopAfterTime.seconds;
      if (totalDurationInSeconds > 0) {
        timerId = setTimeout(() => {
          handleStop();
        }, totalDurationInSeconds * 1000);
      }
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [recording, stopAfterEnabled, stopAfterTime, handleStop]);

  const handleResetInputs = () => {
    setInputHours(0);
    setInputMinutes(0);
    setInputSeconds(0);
  };

  const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<number>>, value: string, min: number, max?: number) => {
    let num = parseInt(value, 10);
    if (isNaN(num)) {
      num = min; // Or handle as an empty string allowing temporary invalid state
    }
    num = Math.max(min, num);
    if (max !== undefined) {
      num = Math.min(max, num);
    }
    setter(num);
  };

  const adjustTimeValue = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    delta: number,
    min: number,
    max?: number
  ) => {
    setter((prev) => {
      let newValue = prev + delta;
      newValue = Math.max(min, newValue);
      if (max !== undefined) {
        newValue = Math.min(max, newValue);
      }
      return newValue;
    });
  };


  return (
    <div className="session-page">
      <div className="page-title">Session</div>
      <div className="session-content" style={{ flex: 1 }} />

      {/* Stop After Controls */}
      <div className="stop-after-controls">
        <span className="stop-after-label">Stop after:</span>
        {!stopAfterEnabled ? (
          <button onClick={handleOpenStopAfterDropdown} className="stop-after-toggle">
            OFF
          </button>
        ) : (
          <div className="stop-after-display">
            <span onClick={handleOpenStopAfterDropdown} className="stop-after-time-text" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleOpenStopAfterDropdown()}>
              {`${stopAfterTime.hours}h ${stopAfterTime.minutes}min ${stopAfterTime.seconds}sec`}
            </span>
            <button onClick={handleResetStopAfter} className="stop-after-reset-btn" aria-label="Reset stop after time">
              &times;
            </button>
          </div>
        )}
        {showStopAfterDropdown && (
          <div className="stop-after-dropdown">
            <div className="stop-after-inputs">
              <label>
                <span>Hours:</span>
                <div className="custom-number-input">
                  <button type="button" onClick={() => adjustTimeValue(setInputHours, -1, 0)} className="custom-number-btn decrement-btn" aria-label="Decrement hours">-</button>
                  <input
                    type="number"
                    min="0"
                    value={inputHours}
                    onChange={(e) => handleNumericInputChange(setInputHours, e.target.value, 0)}
                    aria-label="Input hours for stop after"
                  />
                  <button type="button" onClick={() => adjustTimeValue(setInputHours, 1, 0)} className="custom-number-btn increment-btn" aria-label="Increment hours">+</button>
                </div>
              </label>
              <label>
                <span>Minutes:</span>
                <div className="custom-number-input">
                  <button type="button" onClick={() => adjustTimeValue(setInputMinutes, -1, 0, 59)} className="custom-number-btn decrement-btn" aria-label="Decrement minutes">-</button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputMinutes}
                    onChange={(e) => handleNumericInputChange(setInputMinutes, e.target.value, 0, 59)}
                    aria-label="Input minutes for stop after"
                  />
                  <button type="button" onClick={() => adjustTimeValue(setInputMinutes, 1, 0, 59)} className="custom-number-btn increment-btn" aria-label="Increment minutes">+</button>
                </div>
              </label>
              <label>
                <span>Seconds:</span>
                <div className="custom-number-input">
                  <button type="button" onClick={() => adjustTimeValue(setInputSeconds, -1, 0, 59)} className="custom-number-btn decrement-btn" aria-label="Decrement seconds">-</button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputSeconds}
                    onChange={(e) => handleNumericInputChange(setInputSeconds, e.target.value, 0, 59)}
                    aria-label="Input seconds for stop after"
                  />
                  <button type="button" onClick={() => adjustTimeValue(setInputSeconds, 1, 0, 59)} className="custom-number-btn increment-btn" aria-label="Increment seconds">+</button>
                </div>
              </label>
            </div>
            <div className="stop-after-dropdown-buttons">
              <button type="button" onClick={handleResetInputs} className="stop-after-reset-inputs-btn" aria-label="Reset time inputs">
                &#x21BA; {/* Unicode for anticlockwise open circle arrow */}
              </button>
              <button onClick={handleSubmitStopAfter} className="stop-after-submit-btn">Submit</button>
              <button onClick={() => setShowStopAfterDropdown(false)} className="stop-after-cancel-btn">Cancel</button>
            </div>
          </div>
        )}
      </div>

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