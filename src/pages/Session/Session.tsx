import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Session.css";
import wbbIconLineBlue from "../../assets/wbb-icon-line-blue.svg";
import userIcon from "../../assets/user-icon.svg";
import folderIcon from '../../assets/folder-icon.svg';
import wbbTopdownIcon from '../../assets/wbb-topdown.svg';


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

const DEFAULT_SAVE_LOCATION = "Documents\\TheBalanceToolkit";
const COPY_GRAPH_MAX_POINTS = 200; 

const formatDisplayPath = (path: string, maxLength: number): string => {
  const parts = path.replace(/\\/g, '/').split('/').filter(part => part.length > 0);
  let displayString: string;

  if (parts.length === 0) {
    displayString = path; 
  } else if (parts.length === 1) {
    displayString = parts[0]; 
  } else { 
    displayString = parts.slice(-2).join('/'); 
  }

  if (displayString.length > maxLength) {
    const availableLength = maxLength - 3;
    if (availableLength < 1) {
        return displayString.substring(0, maxLength > 3 ? maxLength -3 : maxLength) + (maxLength > 3 ? "..." : "");
    }
    return "..." + displayString.substring(displayString.length - availableLength);
  }
  return displayString;
};

interface SessionProps {
  availableBoards: string[];
  onViewChange: (view: string) => void;
  onInitialBoardConsumed: () => void;
  usersForDropdown: SessionUser[];
  currentSelectedUserId: string | null;
  onSelectUserInSession: (userId: string | null) => void;
}

function Session({
  availableBoards,
  onViewChange,
  onInitialBoardConsumed,
  usersForDropdown,
  currentSelectedUserId,
  onSelectUserInSession
}: SessionProps) {
  const location = useLocation();
  const navigate = useNavigate(); 
  const initialSelectedBoardFromRoute = location.state?.initialSelectedBoard as string | null || null;

  console.log("[Session.tsx] Component rendered. availableBoards prop:", availableBoards, "initialSelectedBoardFromRoute:", initialSelectedBoardFromRoute);

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
  const [stopAfterTime, setStopAfterTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [showStopAfterDropdown, setShowStopAfterDropdown] = useState(false);
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(0);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [lslStreamEnabled, setLslStreamEnabled] = useState(false);
  const [tcpStreamEnabled, setTcpStreamEnabled] = useState(false);
  const [showLslDropdown, setShowLslDropdown] = useState(false);
  const [showTcpDropdown, setShowTcpDropdown] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const copYCanvasRef = useRef<HTMLCanvasElement>(null);
  const copyGraphContainerRef = useRef<HTMLDivElement>(null);
  const copXCanvasRef = useRef<HTMLCanvasElement>(null); 
  const copxGraphContainerRef = useRef<HTMLDivElement>(null); 

  const [copYDataSeries, setCopYDataSeries] = useState<number[]>([]);
  const [copXDataSeries, setCopXDataSeries] = useState<number[]>([]); 
  const wbbTopdownContainerRef = useRef<HTMLDivElement>(null);
  const wbbTopdownImageRef = useRef<HTMLImageElement>(null);
  const [svgRenderedBounds, setSvgRenderedBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [copYCanvasSize, setCopYCanvasSize] = useState({ width: 0, height: 0 });
  const [copXCanvasSize, setCopXCanvasSize] = useState({ width: 0, height: 0 }); 

  const [actualCop, setActualCop] = useState<{ x: number; y: number } | null>(null);
  const [actualCopTrail, setActualCopTrail] = useState<Array<{ x: number; y: number; id: number; timestamp: number }>>([]);
  const lastActualCopTrailPointIdRef = useRef(0);
  const actualCopVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); 

  const CIRCLE_DIAMETER = 10; 
  const TRAIL_MAX_AGE = 1500; 
  const MAX_TRAIL_POINTS = 50; 

  useEffect(() => {
    if (initialSelectedBoardFromRoute && !initialBoardProcessed) {
      if (availableBoards.length > 0) {
        if (availableBoards.includes(initialSelectedBoardFromRoute)) {
          console.log(`[Session.tsx] Initial board from route: ${initialSelectedBoardFromRoute}. Setting as selected.`);
          setSelectedBoard(initialSelectedBoardFromRoute);
        } else {
          console.warn(`[Session.tsx] Initial board from route "${initialSelectedBoardFromRoute}" not found in available boards. Will attempt to select default.`);
          if (!selectedBoard && availableBoards.length > 0) {
            setSelectedBoard(availableBoards[0]);
          } else if (!selectedBoard && availableBoards.length === 0) {
            setSelectedBoard(null); 
          }
        }
        setInitialBoardProcessed(true); 
        if (onInitialBoardConsumed) {
          onInitialBoardConsumed(); 
        }
      }
    } else if (initialBoardProcessed || !initialSelectedBoardFromRoute) {
      if (!selectedBoard && availableBoards.length > 0) {
        console.log("[Session.tsx] No board selected or initial processed, selecting first available board:", availableBoards[0]);
        setSelectedBoard(availableBoards[0]);
      } else if (selectedBoard && !availableBoards.includes(selectedBoard)) {
        console.warn(`[Session.tsx] Selected board "${selectedBoard}" no longer available. Reselecting.`);
        setSelectedBoard(availableBoards.length > 0 ? availableBoards[0] : null);
      } else if (availableBoards.length === 0 && selectedBoard !== null) {
        setSelectedBoard(null);
      }
    }
  }, [
    initialSelectedBoardFromRoute,
    availableBoards,
    selectedBoard,
    initialBoardProcessed,
    onInitialBoardConsumed,
  ]);

  const handleBoardSelect = (boardName: string) => {
    setSelectedBoard(boardName);
    setShowBoardDropdown(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (copXDataSeries.length > 1) {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2 - (copXDataSeries[0] * (canvas.height / 2)));

      copXDataSeries.forEach((value, i) => {
        const x = (i / (COPY_GRAPH_MAX_POINTS - 1)) * canvas.width;
        const y = canvas.height / 2 - (value * (canvas.height / 2));
        ctx.lineTo(x, y);
      });

      ctx.strokeStyle = "#007bff"; 
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [copXDataSeries, canvasRef.current]); 

  useEffect(() => {
    const canvas = canvasRef2.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (copYDataSeries.length > 1) {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2 - (copYDataSeries[0] * (canvas.height / 2)));
      
      copYDataSeries.forEach((value, i) => {
        const x = (i / (COPY_GRAPH_MAX_POINTS - 1)) * canvas.width;
        const y = canvas.height / 2 - (value * (canvas.height / 2));
        ctx.lineTo(x, y);
      });

      ctx.strokeStyle = "#007bff"; 
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [copYDataSeries, canvasRef2.current]); 

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
    };

    if (showBoardDropdown || showUserDropdown ) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showBoardDropdown, showUserDropdown ]);

  useEffect(() => {
    const calculateBounds = () => {
      if (wbbTopdownContainerRef.current && wbbTopdownImageRef.current && wbbTopdownImageRef.current.complete) {
        const img = wbbTopdownImageRef.current;
        const containerWidth = img.offsetWidth;  
        const containerHeight = img.offsetHeight; 

        const { naturalWidth: imageNaturalWidth, naturalHeight: imageNaturalHeight } = img;

        if (containerWidth === 0 || containerHeight === 0 || imageNaturalWidth === 0 || imageNaturalHeight === 0) {
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
    if (imgElement) imgElement.addEventListener('load', calculateBounds);

    const resizeObserver = new ResizeObserver(calculateBounds);
    if (wbbTopdownContainerRef.current) resizeObserver.observe(wbbTopdownContainerRef.current);

    return () => {
      if (imgElement) imgElement.removeEventListener('load', calculateBounds);
      resizeObserver.disconnect();
    };
  }, []); 

  useEffect(() => {
    const container = copyGraphContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCopYCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    
    const initialWidth = container.offsetWidth;
    const initialHeight = container.offsetHeight;
    if (initialWidth > 0 && initialHeight > 0 && (copYCanvasSize.width !== initialWidth || copYCanvasSize.height !== initialHeight)) {
        setCopYCanvasSize({ width: initialWidth, height: initialHeight });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []); 

  useEffect(() => {
    const container = copxGraphContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCopXCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    
    const initialWidth = container.offsetWidth;
    const initialHeight = container.offsetHeight;
    if (initialWidth > 0 && initialHeight > 0 && (copXCanvasSize.width !== initialWidth || copXCanvasSize.height !== initialHeight)) {
        setCopXCanvasSize({ width: initialWidth, height: initialHeight });
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []); 

  useEffect(() => {
    const canvas = copYCanvasRef.current;
    if (!canvas || !copYCanvasSize || copYCanvasSize.width === 0 || copYCanvasSize.height === 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = copYCanvasSize.width * dpr;
    canvas.height = copYCanvasSize.height * dpr;
    ctx.scale(dpr, dpr);
    
    const canvasLogicalWidth = copYCanvasSize.width;
    const canvasLogicalHeight = copYCanvasSize.height;
    
    ctx.clearRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);

    const padding = { top: 0, right: 20, bottom: 0, left: 35 }; 
    const graphWidth = canvasLogicalWidth - padding.left - padding.right;
    const graphHeight = canvasLogicalHeight - padding.top - padding.bottom; 
    const graphOriginX = padding.left;
    const graphOriginY = padding.top; 

    if (graphWidth <= 0 || graphHeight <= 0) {
        return;
    }

    ctx.strokeStyle = "black"; 
    ctx.lineWidth = 1;
    ctx.fillStyle = "black"; 
    ctx.font = "10px Arial";
    ctx.textAlign = "right"; 

    ctx.beginPath();
    ctx.moveTo(graphOriginX, graphOriginY);
    ctx.lineTo(graphOriginX, graphOriginY + graphHeight);
    ctx.stroke(); 

    ctx.beginPath();
    ctx.moveTo(graphOriginX, graphOriginY + graphHeight / 2); 
    ctx.lineTo(graphOriginX + graphWidth, graphOriginY + graphHeight / 2);
    ctx.stroke(); 

    const yTickValues = [-1, 0, 1];
    const yLabelText: { [key: number]: string } = {
        1: "Front",
        0: "0",
        [-1]: "Back"
    };

    yTickValues.forEach(value => {
      const yPos = graphOriginY + graphHeight / 2 - (value * (graphHeight / 2));
      
      ctx.beginPath(); 
      ctx.moveTo(graphOriginX - 5, yPos); 
      ctx.lineTo(graphOriginX, yPos);
      ctx.stroke(); 

      let baseline: CanvasTextBaseline = "middle";
      if (value === 1) { 
        baseline = "top";
      } else if (value === -1) { 
        baseline = "bottom";
      }
      ctx.textBaseline = baseline;
      ctx.fillText(yLabelText[value], graphOriginX - 8, yPos);
    });
    ctx.textBaseline = "middle"; 

    if (copYDataSeries.length > 1) {
      ctx.save(); 
      ctx.beginPath(); 
      ctx.rect(graphOriginX, graphOriginY, graphWidth, graphHeight); 
      ctx.clip();     

      ctx.beginPath(); 
      ctx.strokeStyle = "#007bff"; 
      ctx.lineWidth = 2;

      copYDataSeries.forEach((value, i) => {
        const x = graphOriginX + (i / (COPY_GRAPH_MAX_POINTS - 1)) * graphWidth;
        const y = graphOriginY + graphHeight / 2 - (value * (graphHeight / 2)); 
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke(); 
      ctx.restore(); 

      if (copYDataSeries.length > 0) { 
        const lastIndex = copYDataSeries.length - 1;
        const lastValue = copYDataSeries[lastIndex];
        const tipX = graphOriginX + (lastIndex / (COPY_GRAPH_MAX_POINTS - 1)) * graphWidth;
        const tipY = graphOriginY + graphHeight / 2 - (lastValue * (graphHeight / 2));
        
        if (tipX >= graphOriginX && tipX <= graphOriginX + graphWidth &&
            tipY >= graphOriginY && tipY <= graphOriginY + graphHeight) {
          ctx.beginPath(); 
          ctx.arc(tipX, tipY, CIRCLE_DIAMETER / 2, 0, 2 * Math.PI); 
          ctx.fillStyle = "#007bff"; 
          ctx.fill();
        }
      }
    } else if (copYDataSeries.length === 1) {
      const lastValue = copYDataSeries[0];
      const tipX = graphOriginX + (0 / (COPY_GRAPH_MAX_POINTS - 1)) * graphWidth; 
      const tipY = graphOriginY + graphHeight / 2 - (lastValue * (graphHeight / 2));

      if (tipX >= graphOriginX && tipX <= graphOriginX + graphWidth &&
          tipY >= graphOriginY && tipY <= graphOriginY + graphHeight) {
        ctx.beginPath();
        ctx.arc(tipX, tipY, CIRCLE_DIAMETER / 2, 0, 2 * Math.PI);
        ctx.fillStyle = "#007bff";
        ctx.fill();
      }
    }
  }, [copYDataSeries, copYCanvasSize]); 

  useEffect(() => {
    const canvas = copXCanvasRef.current;
    if (!canvas || !copXCanvasSize || copXCanvasSize.width === 0 || copXCanvasSize.height === 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = copXCanvasSize.width * dpr;
    canvas.height = copXCanvasSize.height * dpr;
    ctx.scale(dpr, dpr);
    
    const canvasLogicalWidth = copXCanvasSize.width;
    const canvasLogicalHeight = copXCanvasSize.height;
    
    ctx.clearRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);

    const padding = { top: 25, right: 10, bottom: 10, left: 10 }; 
    const graphAreaWidth = canvasLogicalWidth - padding.left - padding.right; 
    const graphAreaHeight = canvasLogicalHeight - padding.top - padding.bottom; 
    const graphOriginX = padding.left;
    const graphOriginY = padding.top; 

    if (graphAreaWidth <= 0 || graphAreaHeight <= 0) {
        return;
    }

    ctx.strokeStyle = "black"; 
    ctx.lineWidth = 1;
    ctx.fillStyle = "black"; 
    ctx.font = "10px Arial";
    
    ctx.beginPath();
    ctx.moveTo(graphOriginX, graphOriginY);
    ctx.lineTo(graphOriginX + graphAreaWidth, graphOriginY);
    ctx.stroke(); 

    const timeAxisX = graphOriginX + graphAreaWidth / 2;
    ctx.beginPath();
    ctx.moveTo(timeAxisX, graphOriginY);
    ctx.lineTo(timeAxisX, graphOriginY + graphAreaHeight);
    ctx.stroke(); 

    const copxTickValues = [-1, 0, 1];
    const copxLabelText: { [key: number]: string } = {
        1: "Right",
        0: "0",
        [-1]: "Left"
    };

    ctx.textAlign = "center";
    copxTickValues.forEach(value => {
      const xPos = graphOriginX + (value + 1) / 2 * graphAreaWidth; 
      
      ctx.beginPath(); 
      ctx.moveTo(xPos, graphOriginY); 
      ctx.lineTo(xPos, graphOriginY - 5); 
      ctx.stroke(); 

      ctx.textBaseline = "bottom";
      ctx.fillText(copxLabelText[value], xPos, graphOriginY - 7);
    });

    if (copXDataSeries.length > 1) {
      ctx.save(); 
      ctx.beginPath(); 
      ctx.rect(graphOriginX, graphOriginY, graphAreaWidth, graphAreaHeight);
      ctx.clip();     

      ctx.beginPath(); 
      ctx.strokeStyle = "#007bff"; 
      ctx.lineWidth = 2;

      copXDataSeries.forEach((copXValue, i) => {
        const pointY = graphOriginY + (i / (COPY_GRAPH_MAX_POINTS - 1)) * graphAreaHeight; 
        const pointX = graphOriginX + (copXValue + 1) / 2 * graphAreaWidth;
        
        if (i === 0) {
          ctx.moveTo(pointX, pointY);
        } else {
          ctx.lineTo(pointX, pointY);
        }
      });
      ctx.stroke(); 
      ctx.restore(); 

      if (copXDataSeries.length > 0) { 
        const lastIndex = copXDataSeries.length - 1;
        const lastCopXValue = copXDataSeries[lastIndex];
        
        const tipY = graphOriginY + (lastIndex / (COPY_GRAPH_MAX_POINTS - 1)) * graphAreaHeight;
        const tipX = graphOriginX + (lastCopXValue + 1) / 2 * graphAreaWidth;
        
        if (tipX >= graphOriginX && tipX <= graphOriginX + graphAreaWidth &&
            tipY >= graphOriginY && tipY <= graphOriginY + graphAreaHeight) {
          ctx.beginPath(); 
          ctx.arc(tipX, tipY, CIRCLE_DIAMETER / 2, 0, 2 * Math.PI); 
          ctx.fillStyle = "#007bff"; 
          ctx.fill();
        }
      }
    } else if (copXDataSeries.length === 1) { 
      const lastCopXValue = copXDataSeries[0];
      const tipY = graphOriginY; 
      const tipX = graphOriginX + (lastCopXValue + 1) / 2 * graphAreaWidth;

      if (tipX >= graphOriginX && tipX <= graphOriginX + graphAreaWidth &&
          tipY >= graphOriginY && tipY <= graphOriginY + graphAreaHeight) {
        ctx.beginPath();
        ctx.arc(tipX, tipY, CIRCLE_DIAMETER / 2, 0, 2 * Math.PI);
        ctx.fillStyle = "#007bff"; 
        ctx.fill();
      }
    }
  }, [copXDataSeries, copXCanvasSize]);

  useEffect(() => {
    if (recording) {
      const DAMPING_FACTOR = 0.9; 
      const ACCELERATION_SCALE = 0.03; 
      const MAX_VELOCITY = 0.1; 
      const BOUNDARY_LIMIT = 1.0; 

      const intervalId = setInterval(() => {
        setActualCop(prevActualCop => {
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

          setCopYDataSeries(prevData => [...prevData.slice(-COPY_GRAPH_MAX_POINTS + 1), newCopData.y]);
          setCopXDataSeries(prevData => [...prevData.slice(-COPY_GRAPH_MAX_POINTS + 1), newCopData.x]); 

          setActualCopTrail(currentTrail => {
            const now = Date.now();
            const newPoint = { ...newCopData, id: lastActualCopTrailPointIdRef.current++, timestamp: now };
            const updatedTrail = [...currentTrail, newPoint]
              .filter(p => now - p.timestamp < TRAIL_MAX_AGE)
              .slice(-MAX_TRAIL_POINTS);
            return updatedTrail;
          });

          return newCopData;
        });
      }, 50); 

      return () => clearInterval(intervalId);
    } else {
      actualCopVelocityRef.current = { x: 0, y: 0 }; 
    }
  }, [recording]);

  const handleRecord = () => {
    setRecording(true);
    setCopYDataSeries([]);
    setCopXDataSeries([]); 
    
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
      setStopAfterTime({ hours: inputHours, minutes: inputMinutes, seconds: inputSeconds });
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

  const handleLslToggleClick = () => {
    if (lslStreamEnabled) { 
      setLslStreamEnabled(false);
      setShowLslDropdown(false);
    } else { 
      setShowLslDropdown(prev => !prev);
    }
  };

  const handleTcpToggleClick = () => {
    if (tcpStreamEnabled) { 
      setTcpStreamEnabled(false);
      setShowTcpDropdown(false);
    } else { 
      setShowTcpDropdown(prev => !prev);
    }
  };

  const handleUserSelect = (userId: string) => {
    onSelectUserInSession(userId); 
    setShowUserDropdown(false);
  };

  const handleGoToUsers = () => {
    onViewChange('users'); 
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
      const newPath = prompt("Enter new save location (showDirectoryPicker not supported):", saveLocation);
      if (newPath !== null) {
        setSaveLocation(newPath.trim() === "" ? DEFAULT_SAVE_LOCATION : newPath);
      }
    }
  };

  const selectedUserName = usersForDropdown.find(u => u.id === currentSelectedUserId)?.name || currentSelectedUserId || "Select User";

  return (
    <div className="session-page">
      <header className="session-header">
        <h1 className="page-title">Session</h1>
        <div className="session-settings-container">
          <div className="toggle-label-wrapper">
            <span className="toggle-label">Board</span>
            <div className="board-selector-wrapper">
              <button
                ref={boardToggleRef}
                className="board-selector-toggle session-setting-toggle"
                onClick={() => !recording && setShowBoardDropdown(!showBoardDropdown)}
                aria-haspopup="true"
                aria-expanded={showBoardDropdown}
                disabled={recording || availableBoards.length === 0}
                title={
                  recording
                    ? "Settings cannot be changed during recording."
                    : selectedBoard || (availableBoards.length === 0 ? "No boards available" : "Select Board")
                }
              >
                <img src={wbbIconLineBlue} alt="Board Icon" className="board-selector-icon" />
                <span className="board-selector-name">
                  {selectedBoard || (availableBoards.length === 0 ? "No boards" : "Select Board")}
                </span>
              </button>
              {showBoardDropdown && !recording && (
                <div ref={boardDropdownRef} className="board-selector-dropdown">
                  {availableBoards.length > 0 ? (
                    <ul className="board-list">
                      {availableBoards.map((board) => (
                        <li
                          key={board}
                          className="board-list-item"
                          onClick={() => handleBoardSelect(board)}
                        >
                          {board}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="board-list-item" style={{ padding: '8px 12px', cursor: 'default' }}>No connected boards found.</p>
                  )}
                  <button className="go-to-devices-btn" onClick={() => onViewChange('devices')}>
                    Go to Devices
                    <span className="go-to-devices-icon" aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="toggle-label-wrapper">
            <span className="toggle-label">User</span>
            <div className="user-selector-wrapper">
              <button
                ref={userToggleRef}
                className="board-selector-toggle session-setting-toggle"
                onClick={() => !recording && setShowUserDropdown(!showUserDropdown)}
                aria-haspopup="true"
                aria-expanded={showUserDropdown}
                disabled={recording}
                title={recording ? "Settings cannot be changed during recording." : selectedUserName}
              >
                <img src={userIcon} alt="User Icon" className="board-selector-icon" />
                <span className="board-selector-name">{selectedUserName}</span>
              </button>
              {showUserDropdown && !recording && (
                <div ref={userDropdownRef} className="user-selector-dropdown">
                  {usersForDropdown.length > 0 ? (
                    <ul className="board-list">
                      {usersForDropdown.map((user) => (
                        <li
                          key={user.id}
                          className="board-list-item user-list-item" 
                          onClick={() => handleUserSelect(user.id)}
                        >
                          <span
                            className="user-color-dot"
                            style={{ backgroundColor: user.color }}
                          ></span>
                          {user.name} 
                        </li>
                      ))}
                    </ul>
                  ) : (
                     <p className="board-list-item" style={{ padding: '8px 12px', cursor: 'default' }}>No users available.</p>
                  )}
                  <button className="go-to-users-btn" onClick={handleGoToUsers}>
                    Go to Users
                    <span className="go-to-users-icon" aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="toggle-label-wrapper">
            <span className="toggle-label">Save Location</span>
            <button
              className={`board-selector-toggle session-setting-toggle save-location-toggle`}
              onClick={handleChangeSaveLocation}
              disabled={recording}
              title={recording ? "Settings cannot be changed during recording." : saveLocation}
            >
              <img src={folderIcon} alt="Folder Icon" className="board-selector-icon" />
              <span className="board-selector-name" style={{ flexGrow: 1, textAlign: 'left' }}>{saveLocation}</span>
            </button>
          </div>
          <div className="toggle-label-wrapper">
            <span className="toggle-label">LSL</span>
            <div className="lsl-selector-wrapper"> 
              <button
                ref={lslToggleRef} 
                className={`session-setting-toggle ${lslStreamEnabled ? "active" : ""}`}
                onClick={handleLslToggleClick} 
                aria-haspopup="true" 
                aria-expanded={showLslDropdown} 
                disabled={recording}
                title={recording ? "Settings cannot be changed during recording." : (lslStreamEnabled ? "LSL Stream is ON" : "LSL Stream is OFF")}
              >
                {lslStreamEnabled ? "ON" : "OFF"}
              </button>
              {showLslDropdown && !lslStreamEnabled && !recording && ( 
                <div ref={lslDropdownRef} className="lsl-selector-dropdown"> 
                  <p>LSL Placeholder Info:</p>
                  <ul>
                    <li>Setting 1</li>
                    <li>Setting 2</li>
                  </ul>
                  <button onClick={() => { setLslStreamEnabled(true); setShowLslDropdown(false); }} className="dropdown-action-button">Enable LSL</button>
                </div>
              )}
            </div>
          </div>

          <div className="toggle-label-wrapper">
            <span className="toggle-label">TCP</span>
            <div className="tcp-selector-wrapper"> 
              <button
                ref={tcpToggleRef} 
                className={`session-setting-toggle ${tcpStreamEnabled ? "active" : ""}`}
                onClick={handleTcpToggleClick} 
                aria-haspopup="true" 
                aria-expanded={showTcpDropdown} 
                disabled={recording}
                title={recording ? "Settings cannot be changed during recording." : (tcpStreamEnabled ? "TCP Stream is ON" : "TCP Stream is OFF")}
              >
                {tcpStreamEnabled ? "ON" : "OFF"}
              </button>
              {showTcpDropdown && !tcpStreamEnabled && !recording && ( 
                <div ref={tcpDropdownRef} className="tcp-selector-dropdown"> 
                  <p>TCP Placeholder Info:</p>
                  <input type="text" placeholder="Enter IP Address" style={{ marginBottom: '5px', width: 'calc(100% - 10px)' }} disabled={recording} />
                  <input type="text" placeholder="Enter Port" style={{ marginBottom: '5px', width: 'calc(100% - 10px)' }} disabled={recording} />
                  <button onClick={() => { setTcpStreamEnabled(true); setShowTcpDropdown(false); }} className="dropdown-action-button" disabled={recording}>Enable TCP</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="session-main">
        <div className="wbb-copx-stack">
          <div className="wbb-topdown-container" ref={wbbTopdownContainerRef}>
            <img 
              src={wbbTopdownIcon} 
              alt="WBB Topdown" 
              className="wbb-topdown-icon" 
              ref={wbbTopdownImageRef}
              onLoad={() => {
                const img = wbbTopdownImageRef.current;
                if (img) {
                  const containerWidth = img.offsetWidth;  
                  const containerHeight = img.offsetHeight; 

                  const { naturalWidth: imageNaturalWidth, naturalHeight: imageNaturalHeight } = img;

                  if (containerWidth === 0 || containerHeight === 0 || imageNaturalWidth === 0 || imageNaturalHeight === 0) {
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
            
            {recording && actualCop && svgRenderedBounds && actualCopTrail.length > 1 && (
              <svg
                style={{
                  position: 'absolute',
                  left: `${svgRenderedBounds.x}px`,
                  top: `${svgRenderedBounds.y}px`,
                  width: `${svgRenderedBounds.width}px`,
                  height: `${svgRenderedBounds.height}px`,
                  pointerEvents: 'none',
                  zIndex: 5 
                }}
              >
                <polyline
                  points={actualCopTrail.map(trailPoint => {
                    const copPixelX = (trailPoint.x + 1) / 2 * svgRenderedBounds.width;
                    const copPixelY = (1 - trailPoint.y) / 2 * svgRenderedBounds.height;
                    return `${copPixelX},${copPixelY}`;
                  }).join(' ')}
                  fill="none"
                  stroke="rgba(0, 100, 255, 0.6)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            {recording && actualCop && svgRenderedBounds && (
              (() => {
                const copPixelX = (actualCop.x + 1) / 2 * svgRenderedBounds.width;
                const copPixelY = (1 - actualCop.y) / 2 * svgRenderedBounds.height;
                
                return (
                  <div
                    className="cop-indicator-circle" 
                    style={{
                      left: `${svgRenderedBounds.x + copPixelX - (CIRCLE_DIAMETER / 2)}px`,
                      top: `${svgRenderedBounds.y + copPixelY - (CIRCLE_DIAMETER / 2)}px`,
                      width: `${CIRCLE_DIAMETER}px`,
                      height: `${CIRCLE_DIAMETER}px`,
                    }}
                  />
                );
              })()
            )}
          </div>
          <div className="copx-graph-container" ref={copxGraphContainerRef}> 
            <canvas ref={copXCanvasRef} className="copx-graph-canvas"></canvas>
          </div>
        </div>
        <div className="copy-graph-container" ref={copyGraphContainerRef}>
          <canvas ref={copYCanvasRef} className="copy-graph-canvas"></canvas>
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
            title={recording ? "Settings cannot be changed during recording." : "Configure automatic stop time"}
          >
            OFF
          </button>
        ) : (
          <div className="stop-after-display">
            <span
              ref={stopAfterTimeTextRef}
              onClick={!recording ? handleOpenStopAfterDropdown : undefined}
              className={`stop-after-time-text ${recording ? 'disabled' : ''}`}
              role="button"
              tabIndex={recording ? -1 : 0}
              onKeyDown={(e) => !recording && e.key === 'Enter' && handleOpenStopAfterDropdown()}
              aria-disabled={recording}
              title={recording ? "Settings cannot be changed during recording." : "Edit automatic stop time"}
            >
              {`${stopAfterTime.hours}h ${stopAfterTime.minutes}min ${stopAfterTime.seconds}sec`}
            </span>
            <button
              onClick={!recording ? handleResetStopAfter : undefined}
              className="stop-after-reset-btn"
              aria-label="Reset stop after time"
              disabled={recording}
              title={recording ? "Settings cannot be changed during recording." : "Reset automatic stop time"}
            >
              &times;
            </button>
          </div>
        )}
        {showStopAfterDropdown && !recording && (
          <div ref={stopAfterDropdownRef} className="stop-after-dropdown">
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
                &#x21BA; 
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