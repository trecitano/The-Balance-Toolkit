import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import "./Session.css";
import wbbIconLineBlue from "../../assets/wbb-icon-line-blue.svg";
import userIcon from "../../assets/user-icon.svg";
import folderIcon from "../../assets/folder-icon.svg";
import wbbTopdownIcon from "../../assets/wbb-topdown.svg";

import CopXGraph from "./CopXGraph";
import CopYGraph from "./CopYGraph";
import VCopXGraph from "./VCopXGraph";
import VCopYGraph from "./VCopYGraph";
import WBBTopGraph from "./WBBTopGraph";
import {Device, UserType} from "@/types.ts";

declare global {
  interface Window {
    showDirectoryPicker?: (options?: any) => Promise<any>;
  }
}

interface SessionUser {
  id: string;
  name: string;
  color: string;
}

interface StabilityGaugeProps {
  value: number;
  maxValue: number;
}

const StabilityGauge: React.FC<StabilityGaugeProps> = ({ value, maxValue }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = (Math.min(width, height) / 2) * 0.85;

    ctx.clearRect(0, 0, width, height);

    ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#f3f4f6";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const totalTicks = 20;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngleRange = endAngle - startAngle;

    for (let i = 0; i <= totalTicks; i++) {
      const ratio = i / totalTicks;
      const angle = startAngle + ratio * totalAngleRange;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(radius * 0.8, 0);
      ctx.lineTo(radius, 0);
      ctx.lineWidth = radius * 0.1;
      if (ratio <= 0.3) {
        ctx.strokeStyle = "#b71c1c";
      } else if (ratio <= 0.6) {
        ctx.strokeStyle = "#ffc107";
      } else {
        ctx.strokeStyle = "#28a745";
      }
      ctx.stroke();
      ctx.restore();
    }

    const valueRatio = Math.min(value / maxValue, 1);
    const needleAngle = startAngle + valueRatio * totalAngleRange;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(needleAngle);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.15, 0);
    ctx.lineTo(radius * 0.75, 0);
    ctx.lineWidth = Math.max(2, radius * 0.07);
    ctx.strokeStyle = "#b71c1c";
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.1, 0, 2 * Math.PI);
    ctx.fillStyle = "#990000";
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.font = `bold ${radius * 0.25}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value.toFixed(2), centerX, centerY + radius * 0.5);
  }, [value, maxValue]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      drawCanvas();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [drawCanvas]);

  return (
    <div ref={containerRef} className="stability-gauge-container">
      <canvas ref={canvasRef} className="stability-gauge-canvas"></canvas>
    </div>
  );
};

const DEFAULT_SAVE_LOCATION = "Documents\\TheBalanceToolkit";
const COPY_GRAPH_MAX_POINTS = 200;

const formatDisplayPath = (path: string, maxLength: number): string => {
  const parts = path
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0);
  let displayString: string;

  if (parts.length === 0) {
    displayString = path;
  } else if (parts.length === 1) {
    displayString = `.../${parts[0]}`;
  } else {
    displayString = parts.slice(-2).join("/");
  }

  if (displayString.length > maxLength) {
    const lastSlash = displayString.lastIndexOf("/");
    if (lastSlash !== -1 && lastSlash > 0 && lastSlash < displayString.length - 1) {
      let firstPart = displayString.substring(0, lastSlash);
      const lastPart = displayString.substring(lastSlash + 1);

      const availableForFirstPart = maxLength - lastPart.length - 4;

      if (lastPart.length >= maxLength - 4) {
        if (maxLength <= 4) displayString = "...";
        else displayString = "..." + displayString.substring(displayString.length - maxLength + 3);
      } else if (firstPart.length > availableForFirstPart) {
        if (availableForFirstPart < 0) {
          if (lastPart.length > maxLength - 3) {
            displayString = "..." + lastPart.substring(lastPart.length - (maxLength - 3));
          } else if (lastPart.length > 0 && maxLength > 3) {
            displayString = "..." + lastPart;
          } else {
            displayString = "...";
          }
        } else {
          firstPart = firstPart.substring(0, availableForFirstPart);
          displayString = firstPart + ".../" + lastPart;
        }
      }
    } else {
      if (displayString.length > maxLength) {
        if (maxLength >= 3) displayString = displayString.substring(0, maxLength - 3) + "...";
        else if (maxLength > 0) displayString = ".".repeat(maxLength);
        else displayString = "";
      }
    }
  }
  return displayString;
};

let lastStabilityIndex = 5.0;
const getStabilityIndexFromBackend = (): number => {
  const change = (Math.random() - 0.5) * 0.2;
  let newIndex = lastStabilityIndex + change;

  newIndex = Math.max(0, Math.min(10, newIndex));

  lastStabilityIndex = newIndex;
  return newIndex;
};

let lastVCopX = 0;
let lastVCopY = 0;
const getMockStabilityData = () => {
  const changeX = (Math.random() - 0.5) * 0.2;
  let newVCopX = lastVCopX + changeX;
  newVCopX = Math.max(-1, Math.min(1, newVCopX));
  lastVCopX = newVCopX;

  const changeY = (Math.random() - 0.5) * 0.2;
  let newVCopY = lastVCopY + changeY;
  newVCopY = Math.max(-1, Math.min(1, newVCopY));
  lastVCopY = newVCopY;

  return { vCopX: newVCopX, vCopY: newVCopY };
};

export default function Session() {
  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const boardToggleRef = useRef<HTMLButtonElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userToggleRef = useRef<HTMLButtonElement>(null);
  const stopAfterDropdownRef = useRef<HTMLDivElement>(null);
  const stopAfterToggleRef = useRef<HTMLButtonElement>(null);
  const stopAfterTimeTextRef = useRef<HTMLSpanElement>(null);
  const lslDropdownRef = useRef<HTMLDivElement>(null);
  const lslToggleRef = useRef<HTMLButtonElement>(null);
  const tcpDropdownRef = useRef<HTMLDivElement>(null);
  const tcpToggleRef = useRef<HTMLButtonElement>(null);

  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [initialBoardProcessed, setInitialBoardProcessed] = useState(false);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saveLocation, setSaveLocation] = useState<string>(DEFAULT_SAVE_LOCATION);
  const [stopAfterEnabled, setStopAfterEnabled] = useState(false);
  const [stopAfterTime, setStopAfterTime] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [showStopAfterDropdown, setShowStopAfterDropdown] = useState(false);
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(0);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [lslStreamEnabled, setLslStreamEnabled] = useState(false);
  const [lslStreamNameInput, setLslStreamNameInput] = useState("the-balance-toolkit");
  const [activeLslStreamName, setActiveLslStreamName] = useState<string | null>(null);
  const [lslStreamType, setLslStreamType] = useState("BalanceData");
  const [lslSourceId, setLslSourceId] = useState(`tbt-${Date.now().toString().slice(-6)}`);
  const [tcpStreamEnabled, setTcpStreamEnabled] = useState(false);
  const [tcpIpAddressInput, setTcpIpAddressInput] = useState("127.0.0.1");
  const [tcpPortInput, setTcpPortInput] = useState("12345");
  const [activeTcpIpAddress, setActiveTcpIpAddress] = useState<string | null>(null);
  const [activeTcpPort, setActiveTcpPort] = useState<string | null>(null);
  const [showLslDropdown, setShowLslDropdown] = useState(false);
  const [showTcpDropdown, setShowTcpDropdown] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const copyGraphContainerRef = useRef<HTMLDivElement>(null);
  const copxGraphContainerRef = useRef<HTMLDivElement>(null);
  const vCopXGraphContainerRef = useRef<HTMLDivElement>(null);
  const vCopYGraphContainerRef = useRef<HTMLDivElement>(null);

  const selectedUser = useRef<SessionUser | null>(null);

  const [copYDataSeries, setCopYDataSeries] = useState<number[]>([]);
  const [copXDataSeries, setCopXDataSeries] = useState<number[]>([]);
  const [vCopXDataSeries, setVCopXDataSeries] = useState<number[]>([]);
  const [vCopYDataSeries, setVCopYDataSeries] = useState<number[]>([]);
  const wbbTopdownContainerRef = useRef<HTMLDivElement>(null);
  const wbbTopdownImageRef = useRef<HTMLImageElement>(null);
  const [svgRenderedBounds, setSvgRenderedBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [copYCanvasSize, setCopYCanvasSize] = useState({ width: 0, height: 0 });
  const [copXCanvasSize, setCopXCanvasSize] = useState({ width: 0, height: 0 });
  const [vCopXCanvasSize, setVCopXCanvasSize] = useState({
    width: 0,
    height: 0,
  });
  const [vCopYCanvasSize, setVCopYCanvasSize] = useState({
    width: 0,
    height: 0,
  });

  const [stabilityIndex, setStabilityIndex] = useState(0);
  const MAX_STABILITY_INDEX = 10;

  const [actualCop, setActualCop] = useState<{ x: number; y: number } | null>(null);
  const [actualCopTrail, setActualCopTrail] = useState<
    Array<{ x: number; y: number; id: number; timestamp: number }>
  >([]);
  const lastActualCopTrailPointIdRef = useRef(0);
  const actualCopVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const TRAIL_MAX_AGE = 1500;

  const users: UserType[] = [];
  const devices: Device[] = [];


  const handleBoardSelect = (boardName: string) => {
    setSelectedBoard(boardName);
    setShowBoardDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        boardDropdownRef.current &&
        !boardDropdownRef.current.contains(event.target as Node) &&
        boardToggleRef.current &&
        !boardToggleRef.current.contains(event.target as Node)
      ) {
        setShowBoardDropdown(false);
      }

      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node) &&
        userToggleRef.current &&
        !userToggleRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }

      if (
        lslDropdownRef.current &&
        !lslDropdownRef.current.contains(event.target as Node) &&
        lslToggleRef.current &&
        !lslToggleRef.current.contains(event.target as Node)
      ) {
        setShowLslDropdown(false);
      }

      if (
        tcpDropdownRef.current &&
        !tcpDropdownRef.current.contains(event.target as Node) &&
        tcpToggleRef.current &&
        !tcpToggleRef.current.contains(event.target as Node)
      ) {
        setShowTcpDropdown(false);
      }

      if (
        stopAfterDropdownRef.current &&
        !stopAfterDropdownRef.current.contains(event.target as Node) &&
        (!stopAfterToggleRef.current ||
          !stopAfterToggleRef.current.contains(event.target as Node)) &&
        (!stopAfterTimeTextRef.current ||
          !stopAfterTimeTextRef.current.contains(event.target as Node))
      ) {
        setShowStopAfterDropdown(false);
      }
    };

    if (
      showBoardDropdown ||
      showUserDropdown ||
      showLslDropdown ||
      showTcpDropdown ||
      showStopAfterDropdown
    ) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showBoardDropdown,
    showUserDropdown,
    showLslDropdown,
    showTcpDropdown,
    showStopAfterDropdown,
  ]);

  useEffect(() => {
    const calculateBounds = () => {
      if (
        wbbTopdownContainerRef.current &&
        wbbTopdownImageRef.current &&
        wbbTopdownImageRef.current.complete
      ) {
        const img = wbbTopdownImageRef.current;
        const containerWidth = img.offsetWidth;
        const containerHeight = img.offsetHeight;

        const { naturalWidth: imageNaturalWidth, naturalHeight: imageNaturalHeight } = img;

        if (
          containerWidth === 0 ||
          containerHeight === 0 ||
          imageNaturalWidth === 0 ||
          imageNaturalHeight === 0
        ) {
          setSvgRenderedBounds(null);
          return;
        }

        const imageAspectRatio = imageNaturalWidth / imageNaturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let renderedImageWidth = containerWidth;
        let renderedImageHeight = containerHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (imageAspectRatio > containerAspectRatio) {
          renderedImageWidth = containerWidth;
          renderedImageHeight = containerWidth / imageAspectRatio;
          offsetY = (containerHeight - renderedImageHeight) / 2;
        } else {
          renderedImageHeight = containerHeight;
          renderedImageWidth = containerHeight * imageAspectRatio;
          offsetX = (containerWidth - renderedImageWidth) / 2;
        }

        setSvgRenderedBounds({
          x: img.offsetLeft + offsetX,
          y: img.offsetTop + offsetY,
          width: renderedImageWidth,
          height: renderedImageHeight,
        });
      } else {
        setSvgRenderedBounds(null);
      }
    };

    calculateBounds();

    const imgElement = wbbTopdownImageRef.current;
    if (imgElement) imgElement.addEventListener("load", calculateBounds);

    const resizeObserver = new ResizeObserver(calculateBounds);
    if (wbbTopdownContainerRef.current) resizeObserver.observe(wbbTopdownContainerRef.current);

    return () => {
      if (imgElement) imgElement.removeEventListener("load", calculateBounds);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = copyGraphContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCopYCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);

    const initialWidth = container.offsetWidth;
    const initialHeight = container.offsetHeight;
    if (
      initialWidth > 0 &&
      initialHeight > 0 &&
      (copYCanvasSize.width !== initialWidth || copYCanvasSize.height !== initialHeight)
    ) {
      setCopYCanvasSize({ width: initialWidth, height: initialHeight });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = copxGraphContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCopXCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);

    const initialWidth = container.offsetWidth;
    const initialHeight = container.offsetHeight;
    if (
      initialWidth > 0 &&
      initialHeight > 0 &&
      (copXCanvasSize.width !== initialWidth || copXCanvasSize.height !== initialHeight)
    ) {
      setCopXCanvasSize({ width: initialWidth, height: initialHeight });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = vCopXGraphContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setVCopXCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);

    const initialWidth = container.offsetWidth;
    const initialHeight = container.offsetHeight;
    if (
      initialWidth > 0 &&
      initialHeight > 0 &&
      (vCopXCanvasSize.width !== initialWidth || vCopXCanvasSize.height !== initialHeight)
    ) {
      setVCopXCanvasSize({ width: initialWidth, height: initialHeight });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = vCopYGraphContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setVCopYCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);

    const initialWidth = container.offsetWidth;
    const initialHeight = container.offsetHeight;
    if (
      initialWidth > 0 &&
      initialHeight > 0 &&
      (vCopYCanvasSize.width !== initialWidth || vCopYCanvasSize.height !== initialHeight)
    ) {
      setVCopYCanvasSize({ width: initialWidth, height: initialHeight });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = copyGraphContainerRef.current;
    const svgElement = document.getElementById("svg-cop-trail");

    if (!container || !svgElement) {
      return;
    }

    const updateSvgPosition = () => {
      const { x, y, width, height } = svgRenderedBounds || {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };

      svgElement.setAttribute("x", `${x}px`);
      svgElement.setAttribute("y", `${y}px`);
      svgElement.setAttribute("width", `${width}px`);
      svgElement.setAttribute("height", `${height}px`);
    };

    updateSvgPosition();

    const resizeObserver = new ResizeObserver(() => {
      updateSvgPosition();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [svgRenderedBounds]);

  const MAX_TRAIL_POINTS = 50;
  useEffect(() => {
    if (recording) {
      const DAMPING_FACTOR = 0.9;
      const ACCELERATION_SCALE = 0.03;
      const MAX_VELOCITY = 0.1;
      const BOUNDARY_LIMIT = 1.0;

      const intervalId = setInterval(() => {
        setActualCop((prevActualCop) => {
          let currentX = 0;
          let currentY = 0;

          if (prevActualCop) {
            currentX = prevActualCop.x;
            currentY = prevActualCop.y;
          }

          let vx = actualCopVelocityRef.current.x;
          let vy = actualCopVelocityRef.current.y;

          vx += (Math.random() * 2 - 1) * ACCELERATION_SCALE;
          vy += (Math.random() * 2 - 1) * ACCELERATION_SCALE;

          vx *= DAMPING_FACTOR;
          vy *= DAMPING_FACTOR;

          vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, vx));
          vy = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, vy));

          actualCopVelocityRef.current = { x: vx, y: vy };

          let newCOPx = currentX + vx;
          let newCOPy = currentY + vy;

          if (newCOPx > BOUNDARY_LIMIT || newCOPx < -BOUNDARY_LIMIT) {
            vx *= -0.5;
            actualCopVelocityRef.current.x = vx;
            newCOPx = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, newCOPx));
          }
          if (newCOPy > BOUNDARY_LIMIT || newCOPy < -BOUNDARY_LIMIT) {
            vy *= -0.5;
            actualCopVelocityRef.current.y = vy;
            newCOPy = Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, newCOPy));
          }

          const newCopData = { x: newCOPx, y: newCOPy };
          const { vCopX, vCopY } = getMockStabilityData();

          const instability = Math.sqrt(vCopX ** 2 + vCopY ** 2);
          const maxInstability = Math.sqrt(2);
          const currentStabilityIndex = Math.max(
            0,
            (1 - instability / maxInstability) * MAX_STABILITY_INDEX,
          );
          setStabilityIndex(currentStabilityIndex);

          setCopYDataSeries((prevData) => [
            ...prevData.slice(-COPY_GRAPH_MAX_POINTS + 1),
            newCopData.y,
          ]);
          setCopXDataSeries((prevData) => [
            ...prevData.slice(-COPY_GRAPH_MAX_POINTS + 1),
            newCopData.x,
          ]);
          setVCopXDataSeries((prevData) => [...prevData.slice(-COPY_GRAPH_MAX_POINTS + 1), vCopX]);
          setVCopYDataSeries((prevData) => [...prevData.slice(-COPY_GRAPH_MAX_POINTS + 1), vCopY]);

          setActualCopTrail((currentTrail) => {
            const now = Date.now();
            const newPoint = {
              ...newCopData,
              id: lastActualCopTrailPointIdRef.current++,
              timestamp: now,
            };
            const updatedTrail = [...currentTrail, newPoint]
              .filter((p) => now - p.timestamp < TRAIL_MAX_AGE)
              .slice(-MAX_TRAIL_POINTS);
            return updatedTrail;
          });

          return newCopData;
        });
      }, 50);

      return () => clearInterval(intervalId);
    } else {
      actualCopVelocityRef.current = { x: 0, y: 0 };
      setStabilityIndex(0);
    }
  }, [recording]);

  const handleRecord = () => {
    setRecording(true);
    setCopYDataSeries([]);
    setCopXDataSeries([]);
    setVCopXDataSeries([]);
    setVCopYDataSeries([]);

    setActualCop(null);
    actualCopVelocityRef.current = { x: 0, y: 0 };
    setActualCopTrail([]);
    lastActualCopTrailPointIdRef.current = 0;
  };

  const handleStop = useCallback(() => {
    setRecording(false);
  }, [setRecording]);

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
      setStopAfterTime({
        hours: inputHours,
        minutes: inputMinutes,
        seconds: inputSeconds,
      });
      setStopAfterEnabled(true);
    } else {
      setStopAfterTime({ hours: 0, minutes: 0, seconds: 0 });
      setStopAfterEnabled(false);
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

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (recording && stopAfterEnabled) {
      const totalDurationInSeconds =
        stopAfterTime.hours * 3600 + stopAfterTime.minutes * 60 + stopAfterTime.seconds;
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

  const handleNumericInputChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    value: string,
    min: number,
    max?: number,
  ) => {
    let num = parseInt(value, 10);
    if (isNaN(num)) {
      setter(min);
      return;
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
    max?: number,
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

  const handleLslToggleClick = () => {
    if (!lslStreamEnabled && !showLslDropdown) {
      setLslSourceId(`tbt-${Date.now().toString().slice(-6)}`);
    }
    setShowLslDropdown((prev) => !prev);
  };

  const handleEnableLslStream = () => {
    console.log("Enabling LSL Stream with:", {
      streamName: lslStreamNameInput,
      streamType: lslStreamType,
      sourceId: lslSourceId,
    });
    setLslStreamEnabled(true);
    setActiveLslStreamName(lslStreamNameInput);
    setShowLslDropdown(false);
  };

  const handleDisableLslStream = () => {
    console.log("Disabling LSL Stream");
    setLslStreamEnabled(false);
    setActiveLslStreamName(null);
    setShowLslDropdown(false);
  };

  const handleTcpToggleClick = () => {
    setShowTcpDropdown((prev) => !prev);
  };

  const handleEnableTcpStream = () => {
    if (!tcpIpAddressInput.trim() || !tcpPortInput.trim() || isNaN(parseInt(tcpPortInput))) {
      alert("Please enter a valid IP Address and Port.");
      return;
    }
    console.log("Enabling TCP Stream with:", {
      ip: tcpIpAddressInput,
      port: tcpPortInput,
    });
    setTcpStreamEnabled(true);
    setActiveTcpIpAddress(tcpIpAddressInput);
    setActiveTcpPort(tcpPortInput);
    setShowTcpDropdown(false);
  };

  const handleDisableTcpStream = () => {
    console.log("Disabling TCP Stream");
    setTcpStreamEnabled(false);
    setActiveTcpIpAddress(null);
    setActiveTcpPort(null);
    setShowTcpDropdown(false);
  };

  const handleUserSelect = (userId: string) => {
    commands.session
  };

  const handleGoToUsers = () => {
    //onViewChange("users");
    setShowUserDropdown(false);
  };

  const handleChangeSaveLocation = async () => {
    if (window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker();
        setSaveLocation(handle.name);
      } catch (err) {
        console.error("Error picking directory:", err);
      }
    } else {
      const newPath = prompt(
        "Enter new save location (showDirectoryPicker not supported):",
        saveLocation,
      );
      if (newPath !== null) {
        setSaveLocation(newPath.trim() === "" ? DEFAULT_SAVE_LOCATION : newPath);
      }
    }
  };

  const selectedUserName =
    users.find((u) => u.id === selectedUser.current)?.name ||
    selectedUser.current ||
    "Select User";

  return (
    <div className="inside-page">
      <header className="page-header">
        <h1 className="page-title">Session</h1>
        <div className="settings-container">
          <div className="control-group control-group--wide">
            <span className="control-label">Board</span>
            <div className="relative w-full">
              <button
                ref={boardToggleRef}
                className="control-toggle control-toggle--full-width"
                onClick={() => !recording && setShowBoardDropdown(!showBoardDropdown)}
                aria-haspopup="true"
                aria-expanded={showBoardDropdown}
                disabled={recording}
                title={
                  recording
                    ? "Settings cannot be changed during recording."
                    : selectedBoard ||
                      (devices.length === 0 ? "No boards available" : "Select Board")
                }
              >
                <img src={wbbIconLineBlue} alt="Board Icon" className="icon" />
                <span className="control-name">{selectedBoard || "Select Board"}</span>
              </button>
              {showBoardDropdown && !recording && (
                <div ref={boardDropdownRef} className="dropdown">
                  {devices.length > 0 ? (
                    <ul className="list">
                      {devices.map((board) => (
                        <li
                          key={board}
                          className={`list-item ${
                            board === selectedBoard ? "list-item--selected" : ""
                          }`}
                          onClick={() => handleBoardSelect(board)}
                        >
                          {board}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dropdown-message">No boards available.</p>
                  )}
                  <button className="btn btn--secondary" onClick={() => onViewChange("devices")}>
                    Go to Devices
                    <span className="go-to-devices-icon" aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="control-group control-group--medium">
            <span className="control-label">User</span>
            <div className="relative w-full">
              <button
                ref={userToggleRef}
                className="control-toggle control-toggle--full-width"
                onClick={() => !recording && setShowUserDropdown(!showUserDropdown)}
                aria-haspopup="true"
                aria-expanded={showUserDropdown}
                disabled={recording}
                title={
                  recording ? "Settings cannot be changed during recording." : selectedUserName
                }
              >
                <img src={userIcon} alt="User Icon" className="icon" />
                <span className="control-name">{selectedUserName}</span>
              </button>
              {showUserDropdown && !recording && (
                <div ref={userDropdownRef} className="dropdown">
                  {users.length > 0 ? (
                    <ul className="list">
                      {users.map((user) => (
                        <li
                          key={user.id}
                          className={`list-item ${
                            user.id === selectedUser.current ? "list-item--selected" : ""
                          }`}
                          onClick={() => handleUserSelect(user.id)}
                        >
                          <span
                            className="icon--small"
                            style={{ backgroundColor: user.color }}
                          ></span>
                          {user.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dropdown-message">No users available.</p>
                  )}
                  <button className="btn btn--secondary" onClick={handleGoToUsers}>
                    Go to Users
                    <span className="go-to-users-icon" aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="control-group flex-grow">
            <span className="control-label">Save Location</span>
            <button
              className="control-toggle control-toggle--full-width"
              onClick={handleChangeSaveLocation}
              disabled={recording}
              title={recording ? "Settings cannot be changed during recording." : saveLocation}
            >
              <img src={folderIcon} alt="Folder Icon" className="icon" />
              <span className="control-name">{saveLocation}</span>
            </button>
          </div>

          <div className="control-group control-group--narrow">
            <label className="control-label">LSL</label>
            <div className="relative w-full">
              <button
                ref={lslToggleRef}
                className={`control-toggle control-toggle--center ${lslStreamEnabled ? "control-toggle--active" : ""}`}
                onClick={handleLslToggleClick}
                aria-haspopup="true"
                aria-expanded={showLslDropdown}
                disabled={recording}
                title={
                  recording
                    ? "Settings cannot be changed during recording."
                    : lslStreamEnabled
                      ? "LSL Stream is ON. Click to manage."
                      : "LSL Stream is OFF. Click to configure."
                }
              >
                {lslStreamEnabled ? "ON" : "OFF"}
              </button>
              {showLslDropdown && !recording && (
                <div ref={lslDropdownRef} className="dropdown dropdown--right dropdown--medium">
                  {lslStreamEnabled ? (
                    <>
                      <div className="form-group">
                        <label htmlFor="activeLslStreamNameDisplay" className="form-label">
                          Stream Name:
                        </label>
                        <span id="activeLslStreamNameDisplay" className="form-display">
                          {activeLslStreamName || "N/A"}
                        </span>
                      </div>
                      <div className="form-group">
                        <label htmlFor="lslSourceIdDisplayWhenOn" className="form-label">
                          Source ID:
                        </label>
                        <span id="lslSourceIdDisplayWhenOn" className="form-display">
                          {lslSourceId}
                        </span>
                      </div>
                      <button
                        onClick={handleDisableLslStream}
                        className="btn btn--danger"
                        disabled={recording}
                      >
                        Disable LSL
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label htmlFor="lslStreamNameInputControl" className="form-label">
                          Stream Name:
                        </label>
                        <input
                          type="text"
                          id="lslStreamNameInputControl"
                          className="input"
                          value={lslStreamNameInput}
                          onChange={(e) => setLslStreamNameInput(e.target.value)}
                          placeholder="e.g., MyBalanceStream"
                          disabled={recording}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="lslSourceIdDisplayWhenOff" className="form-label">
                          Source ID:
                        </label>
                        <span id="lslSourceIdDisplayWhenOff" className="form-display">
                          {lslSourceId}
                        </span>
                      </div>
                      <button
                        onClick={handleEnableLslStream}
                        className="btn btn--primary"
                        disabled={recording}
                      >
                        Enable LSL
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="control-group control-group--narrow">
            <label className="control-label">TCP</label>
            <div className="relative w-full">
              <button
                ref={tcpToggleRef}
                className={`control-toggle control-toggle--center ${tcpStreamEnabled ? "control-toggle--active" : ""}`}
                onClick={handleTcpToggleClick}
                aria-haspopup="true"
                aria-expanded={showTcpDropdown}
                disabled={recording}
                title={
                  recording
                    ? "Settings cannot be changed during recording."
                    : tcpStreamEnabled
                      ? "TCP Stream is ON"
                      : "TCP Stream is OFF"
                }
              >
                {tcpStreamEnabled ? "ON" : "OFF"}
              </button>
              {showTcpDropdown && !recording && (
                <div ref={tcpDropdownRef} className="dropdown dropdown--right dropdown--small">
                  {tcpStreamEnabled ? (
                    <>
                      <div className="form-group">
                        <label htmlFor="activeTcpIpDisplay" className="form-label">
                          IP Address:
                        </label>
                        <span id="activeTcpIpDisplay" className="form-display">
                          {activeTcpIpAddress || "N/A"}
                        </span>
                      </div>
                      <div className="form-group">
                        <label htmlFor="activeTcpPortDisplay" className="form-label">
                          Port:
                        </label>
                        <span id="activeTcpPortDisplay" className="form-display">
                          {activeTcpPort || "N/A"}
                        </span>
                      </div>
                      <button
                        onClick={handleDisableTcpStream}
                        className="btn btn--danger"
                        disabled={recording}
                      >
                        Disable TCP
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label htmlFor="tcpIpInputControl" className="form-label">
                          IP Address:
                        </label>
                        <input
                          type="text"
                          id="tcpIpInputControl"
                          className="input"
                          value={tcpIpAddressInput}
                          onChange={(e) => setTcpIpAddressInput(e.target.value)}
                          placeholder="e.g., 127.0.0.1"
                          disabled={recording}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="tcpPortInputControl" className="form-label">
                          Port:
                        </label>
                        <input
                          type="text"
                          id="tcpPortInputControl"
                          className="input"
                          value={tcpPortInput}
                          onChange={(e) => setTcpPortInput(e.target.value)}
                          placeholder="e.g., 12345"
                          disabled={recording}
                        />
                      </div>
                      <button
                        onClick={handleEnableTcpStream}
                        className="btn btn--primary"
                        disabled={recording}
                      >
                        Enable TCP
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="column column--narrow">
          <div className="wbb-container" ref={wbbTopdownContainerRef}>
            <img
              src={wbbTopdownIcon}
              alt="WBB Topdown"
              className="wbb-image"
              ref={wbbTopdownImageRef}
              onLoad={() => {
                const img = wbbTopdownImageRef.current;
                if (img) {
                  const containerWidth = img.offsetWidth;
                  const containerHeight = img.offsetHeight;

                  const { naturalWidth: imageNaturalWidth, naturalHeight: imageNaturalHeight } =
                    img;

                  if (
                    containerWidth === 0 ||
                    containerHeight === 0 ||
                    imageNaturalWidth === 0 ||
                    imageNaturalHeight === 0
                  ) {
                    setSvgRenderedBounds(null);
                    return;
                  }

                  const imageAspectRatio = imageNaturalWidth / imageNaturalHeight;
                  const containerAspectRatio = containerWidth / containerHeight;

                  let renderedImageWidth = containerWidth;
                  let renderedImageHeight = containerHeight;
                  let offsetX = 0;
                  let offsetY = 0;

                  if (imageAspectRatio > containerAspectRatio) {
                    renderedImageWidth = containerWidth;
                    renderedImageHeight = containerWidth / imageAspectRatio;
                    offsetY = (containerHeight - renderedImageHeight) / 2;
                  } else {
                    renderedImageHeight = containerHeight;
                    renderedImageWidth = containerHeight * imageAspectRatio;
                    offsetX = (containerWidth - renderedImageWidth) / 2;
                  }

                  setSvgRenderedBounds({
                    x: img.offsetLeft + offsetX,
                    y: img.offsetTop + offsetY,
                    width: renderedImageWidth,
                    height: renderedImageHeight,
                  });
                }
              }}
            />

            {recording && actualCop && svgRenderedBounds && (
              <WBBTopGraph trail={actualCopTrail} current={actualCop} bounds={svgRenderedBounds} />
            )}
          </div>
          <div className="w-full box-border h-4/10">
            <CopXGraph data={copXDataSeries} />
          </div>
          <div className="w-full box-border h-3/10 min-h-[60px]">
            <VCopXGraph data={vCopXDataSeries} />
          </div>
        </div>

        <div className="column column--narrow">
          <div className="w-full box-border h-1/4" ref={copyGraphContainerRef}>
            <CopYGraph data={copYDataSeries} />
          </div>
        </div>

        <div className="column column--narrow">
          <div className="w-full box-border h-1/4">
            <VCopYGraph data={vCopYDataSeries} />
          </div>
        </div>

        <div className="column column--wide">
          <div className="column--quarter h-full">
            <div className="gauge-wrapper">
              <div className="gauge-title">Stability Index</div>
              <StabilityGauge value={stabilityIndex} maxValue={MAX_STABILITY_INDEX} />
            </div>
          </div>
        </div>
      </main>

      <div className="stop-after-controls">
        <span className="stop-after-label">Stop after:</span>
        {!stopAfterEnabled ? (
          <button
            ref={stopAfterToggleRef}
            onClick={!recording ? handleOpenStopAfterDropdown : undefined}
            className="stop-after-toggle"
            disabled={recording}
            title={
              recording
                ? "Settings cannot be changed during recording."
                : "Configure automatic stop time"
            }
          >
            OFF
          </button>
        ) : (
          <div className="stop-after-display">
            <span
              ref={stopAfterTimeTextRef}
              onClick={!recording ? handleOpenStopAfterDropdown : undefined}
              className={`stop-after-time ${recording ? "stop-after-time--disabled" : ""}`}
              role="button"
              tabIndex={recording ? -1 : 0}
              onKeyDown={(e) => !recording && e.key === "Enter" && handleOpenStopAfterDropdown()}
              aria-disabled={recording}
              title={
                recording
                  ? "Settings cannot be changed during recording."
                  : "Edit automatic stop time"
              }
            >
              {`${stopAfterTime.hours}h ${stopAfterTime.minutes}min ${stopAfterTime.seconds}sec`}
            </span>
            <button
              onClick={!recording ? handleResetStopAfter : undefined}
              className="stop-after-reset"
              aria-label="Reset stop after time"
              disabled={recording}
              title={
                recording
                  ? "Settings cannot be changed during recording."
                  : "Reset automatic stop time"
              }
            >
              &times;
            </button>
          </div>
        )}
        {showStopAfterDropdown && !recording && (
          <div ref={stopAfterDropdownRef} className="stop-after-dropdown">
            <div className="number-input-group">
              <label>
                <span>Hours:</span>
                <div className="number-input">
                  <button
                    type="button"
                    onClick={() => adjustTimeValue(setInputHours, -1, 0)}
                    className="number-btn number-btn--decrement"
                    aria-label="Decrement hours"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={inputHours}
                    onChange={(e) => handleNumericInputChange(setInputHours, e.target.value, 0)}
                    aria-label="Input hours for stop after"
                  />
                  <button
                    type="button"
                    onClick={() => adjustTimeValue(setInputHours, 1, 0)}
                    className="number-btn number-btn--increment"
                    aria-label="Increment hours"
                  >
                    +
                  </button>
                </div>
              </label>
              <label>
                <span>Minutes:</span>
                <div className="number-input">
                  <button
                    type="button"
                    onClick={() => adjustTimeValue(setInputMinutes, -1, 0, 59)}
                    className="number-btn number-btn--decrement"
                    aria-label="Decrement minutes"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputMinutes}
                    onChange={(e) =>
                      handleNumericInputChange(setInputMinutes, e.target.value, 0, 59)
                    }
                    aria-label="Input minutes for stop after"
                  />
                  <button
                    type="button"
                    onClick={() => adjustTimeValue(setInputMinutes, 1, 0, 59)}
                    className="number-btn number-btn--increment"
                    aria-label="Increment minutes"
                  >
                    +
                  </button>
                </div>
              </label>
              <label>
                <span>Seconds:</span>
                <div className="number-input">
                  <button
                    type="button"
                    onClick={() => adjustTimeValue(setInputSeconds, -1, 0, 59)}
                    className="number-btn number-btn--decrement"
                    aria-label="Decrement seconds"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={inputSeconds}
                    onChange={(e) =>
                      handleNumericInputChange(setInputSeconds, e.target.value, 0, 59)
                    }
                    aria-label="Input seconds for stop after"
                  />
                  <button
                    type="button"
                    onClick={() => adjustTimeValue(setInputSeconds, 1, 0, 59)}
                    className="number-btn number-btn--increment"
                    aria-label="Increment seconds"
                  >
                    +
                  </button>
                </div>
              </label>
            </div>
            <div className="stop-after-dropdown-buttons">
              <button
                type="button"
                onClick={handleResetInputs}
                className="btn btn--secondary"
                aria-label="Reset time inputs"
              >
                &#x21BA;
              </button>
              <button onClick={handleSubmitStopAfter} className="btn btn--primary">
                Submit
              </button>
              <button
                onClick={() => setShowStopAfterDropdown(false)}
                className="btn btn--secondary"
              >
                Cancel
              </button>
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
          className={`record-btn ${recording ? "record-btn--stop" : "record-btn--record"}`}
          onClick={recording ? handleStop : handleRecord}
          aria-label={recording ? "Stop" : "Record"}
        >
          <span className="record-icon" />
        </button>
      </div>
    </div>
  );
}
