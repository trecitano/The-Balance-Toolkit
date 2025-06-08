import { useRef, useState, useEffect, useCallback } from "react";
import "./Session.css";
import wbbIconLineBlue from '../../assets/wbb-icon-line-blue.svg';
import userIcon from '../../assets/user-icon.svg';
import folderIcon from '../../assets/folder-icon.svg';
import wbbTopdownIcon from '../../assets/wbb-topdown.svg';

// Extend the Window interface to include showDirectoryPicker for TypeScript
declare global {
  interface Window {
    showDirectoryPicker?: (options?: any) => Promise<any>;
  }
}

interface User {
  id: string;
  color: string;
}

const DEFAULT_SAVE_LOCATION = "Documents\\TheBalanceToolkit";

const formatDisplayPath = (path: string, maxLength: number): string => {
  // Normalize path separators and split, filter out empty parts (e.g., from "folder//subfolder")
  const parts = path.replace(/\\/g, '/').split('/').filter(part => part.length > 0);

  let displayString: string;

  if (parts.length === 0) {
    // Handle empty or slash-only paths if necessary, otherwise, it might show nothing or "..."
    displayString = path; // Fallback to original path if it's unusual
  } else if (parts.length === 1) {
    displayString = parts[0]; // Single folder name
  } else { // parts.length >= 2
    displayString = parts.slice(-2).join('/'); // Get last two parts
  }

  if (displayString.length > maxLength) {
    // Ensure "..." fits, so maxLength for substring is maxLength - 3
    const availableLength = maxLength - 3;
    // If maxLength is too small for "...", just truncate the original displayString
    if (availableLength < 1) {
        return displayString.substring(0, maxLength > 3 ? maxLength -3 : maxLength) + (maxLength > 3 ? "..." : "");
    }
    return "..." + displayString.substring(displayString.length - availableLength);
  }
  return displayString;
};

// Constants for the moving circle and trail
const CIRCLE_DIAMETER = 10; // px
const TRAIL_DOT_DIAMETER = CIRCLE_DIAMETER / 1.5; // px, trail dots are slightly smaller
const TRAIL_MAX_AGE = 1500; // milliseconds, how long a trail point lasts
const TRAIL_UPDATE_INTERVAL = 75; // milliseconds, how often to update COP position and add to trail
const MAX_TRAIL_POINTS = 50; // Max number of trail points to keep for performance
const COP_TARGET_UPDATE_INTERVAL = 750; // ms, how often the COP's target moves
const COP_FOLLOW_SPEED = 0.1; // Factor for how quickly COP moves towards its target (0 to 1)

function Session() {
  const [recording, setRecording] = useState(false);
  const [data, setData] = useState<number[]>([]);
  const [data2, setData2] = useState<number[]>([]);
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);

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

  const [stopAfterEnabled, setStopAfterEnabled] = useState(false);
  const [stopAfterTime, setStopAfterTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [showStopAfterDropdown, setShowStopAfterDropdown] = useState(false);
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(0);
  const [inputSeconds, setInputSeconds] = useState(0);

  const [selectedBoard, setSelectedBoard] = useState<string | null>("Select Board");
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [connectedBoards, setConnectedBoards] = useState<string[]>(["Alpha", "Bravo", "Charlie"]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>("User-123");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([
    { id: "User-123", color: "#4CAF50" },
    { id: "User-456", color: "#2196F3" },
    { id: "User-789", color: "#FFC107" },
    { id: "Guest", color: "#9E9E9E" },
  ]);

  const [saveLocation, setSaveLocation] = useState<string>(DEFAULT_SAVE_LOCATION);
  const [lslStreamEnabled, setLslStreamEnabled] = useState(false);
  const [tcpStreamEnabled, setTcpStreamEnabled] = useState(false);
  const [showLslDropdown, setShowLslDropdown] = useState(false);
  const [showTcpDropdown, setShowTcpDropdown] = useState(false);

  // State and refs for the COP animation
  const [copPosition, setCopPosition] = useState<{ x: number; y: number } | null>(null);
  const [copTargetPosition, setCopTargetPosition] = useState<{ x: number; y: number } | null>(null); // Target for COP
  const [trailPoints, setTrailPoints] = useState<Array<{ x: number; y: number; id: number; timestamp: number }>>([]);
  const wbbTopdownContainerRef = useRef<HTMLDivElement>(null);
  const wbbTopdownImageRef = useRef<HTMLImageElement>(null);
  const [svgRenderedBounds, setSvgRenderedBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  const copAnimationIntervalIdRef = useRef<number | null>(null); // Renamed for clarity
  const copTargetAnimationIntervalIdRef = useRef<number | null>(null); // For target updates
  const lastTrailPointIdRef = useRef(0);
  // velocityXRef and velocityYRef are no longer needed for this movement model
  // const velocityXRef = useRef(0);
  // const velocityYRef = useRef(0);

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
    };

    if (showBoardDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showBoardDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node) &&
        userToggleRef.current &&
        !userToggleRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        lslDropdownRef.current &&
        !lslDropdownRef.current.contains(event.target as Node) &&
        lslToggleRef.current &&
        !lslToggleRef.current.contains(event.target as Node)
      ) {
        setShowLslDropdown(false);
      }
    };

    if (showLslDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLslDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tcpDropdownRef.current &&
        !tcpDropdownRef.current.contains(event.target as Node) &&
        tcpToggleRef.current &&
        !tcpToggleRef.current.contains(event.target as Node)
      ) {
        setShowTcpDropdown(false);
      }
    };

    if (showTcpDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTcpDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isOutsideDropdown = stopAfterDropdownRef.current && !stopAfterDropdownRef.current.contains(event.target as Node);
      const isOutsideOffToggle = stopAfterToggleRef.current && !stopAfterToggleRef.current.contains(event.target as Node);
      const isOutsideTimeText = stopAfterTimeTextRef.current && !stopAfterTimeTextRef.current.contains(event.target as Node);

      if (isOutsideDropdown) {
        const clickedOffToggle = stopAfterToggleRef.current && stopAfterToggleRef.current.contains(event.target as Node);
        const clickedTimeText = stopAfterTimeTextRef.current && stopAfterTimeTextRef.current.contains(event.target as Node);

        if (!clickedOffToggle && !clickedTimeText) {
            setShowStopAfterDropdown(false);
        }
      }
    };

    if (showStopAfterDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showStopAfterDropdown]);


  // Effect to calculate actual SVG rendered bounds
  useEffect(() => {
    const calculateBounds = () => {
      if (wbbTopdownContainerRef.current && wbbTopdownImageRef.current && wbbTopdownImageRef.current.complete) {
        const container = wbbTopdownContainerRef.current;
        const img = wbbTopdownImageRef.current;

        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const imgNaturalWidth = img.naturalWidth;
        const imgNaturalHeight = img.naturalHeight;

        if (containerWidth === 0 || containerHeight === 0 || imgNaturalWidth === 0 || imgNaturalHeight === 0) {
          setSvgRenderedBounds(null); return;
        }
        const imgAspectRatio = imgNaturalWidth / imgNaturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        let renderedWidth, renderedHeight, offsetX, offsetY;
        if (imgAspectRatio > containerAspectRatio) {
          // SVG is wider or less tall than container (letterboxed if container is taller)
          // Fit by width
          renderedWidth = containerWidth;
          renderedHeight = containerWidth / imgAspectRatio;
          offsetX = 0;
          offsetY = (containerHeight - renderedHeight) / 2;
        } else {
          // SVG is taller or less wide than container (pillarboxed if container is wider)
          // Fit by height
          renderedHeight = containerHeight;
          renderedWidth = containerHeight * imgAspectRatio;
          offsetY = 0;
          offsetX = (containerWidth - renderedWidth) / 2;
        }
        setSvgRenderedBounds({ x: offsetX, y: offsetY, width: renderedWidth, height: renderedHeight });
      } else {
        setSvgRenderedBounds(null);
      }
    };

    calculateBounds(); // Initial calculation

    const imgElement = wbbTopdownImageRef.current;
    if (imgElement) imgElement.addEventListener('load', calculateBounds);

    const resizeObserver = new ResizeObserver(calculateBounds);
    if (wbbTopdownContainerRef.current) resizeObserver.observe(wbbTopdownContainerRef.current);

    return () => {
      if (imgElement) imgElement.removeEventListener('load', calculateBounds);
      resizeObserver.disconnect();
    };
  }, []); // Runs once on mount, calculation re-triggered by observer or load event

  // Effect to manage the moving COP animation
  useEffect(() => {
    if (recording && svgRenderedBounds && copPosition && copTargetPosition) {
      const { width: svgWidth, height: svgHeight } = svgRenderedBounds;

      if (svgWidth === 0 || svgHeight === 0) {
        console.warn("SVG rendered bounds have zero dimensions. COP animation stopped/prevented.");
        if (copAnimationIntervalIdRef.current !== null) {
          clearInterval(copAnimationIntervalIdRef.current);
          copAnimationIntervalIdRef.current = null;
        }
        return;
      }
      
      const moveCop = () => {
        setCopPosition(prevCopPos => {
          if (!prevCopPos || !copTargetPosition) return prevCopPos; // Should not happen if guarded

          const dx = copTargetPosition.x - prevCopPos.x;
          const dy = copTargetPosition.y - prevCopPos.y;

          // Move a fraction of the distance towards the target
          let newX = prevCopPos.x + dx * COP_FOLLOW_SPEED;
          let newY = prevCopPos.y + dy * COP_FOLLOW_SPEED;
          
          // Ensure COP stays within SVG bounds (it should, as target is within bounds)
          // but good to clamp just in case of extreme speeds or floating point issues.
          const radius = CIRCLE_DIAMETER / 2;
          newX = Math.max(radius, Math.min(svgWidth - radius, newX));
          newY = Math.max(radius, Math.min(svgHeight - radius, newY));
          
          const nextPositionInSvg = { x: newX, y: newY };

          setTrailPoints(currentTrail => {
            const now = Date.now();
            const newPoint = { ...nextPositionInSvg, id: lastTrailPointIdRef.current++, timestamp: now };
            const updatedTrail = [...currentTrail, newPoint]
              .filter(p => now - p.timestamp < TRAIL_MAX_AGE)
              .slice(-MAX_TRAIL_POINTS); 
            return updatedTrail;
          });
          return nextPositionInSvg;
        });
      };

      if (copAnimationIntervalIdRef.current === null) {
        // Add initial trail point
        setTrailPoints(currentTrail => {
            const now = Date.now();
            const startPoint = copPosition;
            const newPoint = { ...startPoint, id: lastTrailPointIdRef.current++, timestamp: now };
            return [...currentTrail, newPoint].filter(p => now - p.timestamp < TRAIL_MAX_AGE).slice(-MAX_TRAIL_POINTS);
        });
        copAnimationIntervalIdRef.current = window.setInterval(moveCop, TRAIL_UPDATE_INTERVAL);
      }

    } else { // Not recording, or missing necessary data
      if (copAnimationIntervalIdRef.current !== null) {
        clearInterval(copAnimationIntervalIdRef.current);
        copAnimationIntervalIdRef.current = null;
      }
    }

    return () => { // Cleanup main COP animation interval
      if (copAnimationIntervalIdRef.current !== null) {
        clearInterval(copAnimationIntervalIdRef.current);
        copAnimationIntervalIdRef.current = null;
      }
    };
  }, [recording, copPosition, copTargetPosition, svgRenderedBounds]);


  // Effect to clean up old trail points periodically
  useEffect(() => {
    const trailCleanupTimer = setInterval(() => {
      if (trailPoints.length > 0) {
        const now = Date.now();
        setTrailPoints(currentTrail => currentTrail.filter(p => now - p.timestamp < TRAIL_MAX_AGE));
      }
    }, TRAIL_MAX_AGE / 2); // Clean up reasonably often

    return () => clearInterval(trailCleanupTimer);
  }, [trailPoints.length]); // Rerun only if trailPoints.length changes


  const handleRecord = () => {
    setRecording(true);
    setData([]);
    setData2([]);
    
    if (svgRenderedBounds) {
        const { width: svgWidth, height: svgHeight } = svgRenderedBounds;

        if (svgWidth > 0 && svgHeight > 0) {
            // Set initial COP position to center of SVG
            const initialCopX = svgWidth / 2;
            const initialCopY = svgHeight / 2;
            setCopPosition({ x: initialCopX, y: initialCopY });
            
            // Set initial target position randomly within SVG bounds
            const radius = CIRCLE_DIAMETER / 2;
            const targetX = Math.random() * (svgWidth - CIRCLE_DIAMETER) + radius;
            const targetY = Math.random() * (svgHeight - CIRCLE_DIAMETER) + radius;
            setCopTargetPosition({ x: targetX, y: targetY });

            setTrailPoints([]); 
            lastTrailPointIdRef.current = 0;

            // Start interval to update target position
            if (copTargetAnimationIntervalIdRef.current !== null) {
                clearInterval(copTargetAnimationIntervalIdRef.current);
            }
            copTargetAnimationIntervalIdRef.current = window.setInterval(() => {
                if (svgRenderedBounds) { // Ensure bounds are still valid
                    const newTargetX = Math.random() * (svgRenderedBounds.width - CIRCLE_DIAMETER) + radius;
                    const newTargetY = Math.random() * (svgRenderedBounds.height - CIRCLE_DIAMETER) + radius;
                    setCopTargetPosition({ x: newTargetX, y: newTargetY });
                }
            }, COP_TARGET_UPDATE_INTERVAL);

        } else {
            console.warn("Cannot start COP animation: SVG rendered bounds have zero dimensions in handleRecord.");
            setCopPosition(null);
            setCopTargetPosition(null);
        }
    } else {
        console.warn("Cannot start COP animation: SVG rendered bounds not available in handleRecord.");
        setCopPosition(null);
        setCopTargetPosition(null);
    }
  };

  const handleStop = useCallback(() => {
    setRecording(false);
    // Clear the target animation interval
    if (copTargetAnimationIntervalIdRef.current !== null) {
        clearInterval(copTargetAnimationIntervalIdRef.current);
        copTargetAnimationIntervalIdRef.current = null;
    }
    // Main COP animation interval is cleared by its own useEffect when recording becomes false.
    // Optionally reset COP and target positions:
    // setCopPosition(null);
    // setCopTargetPosition(null);
  }, [setRecording]); // Removed svgRenderedBounds from here as it's not directly used for stopping

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

  const handleSettingToggle = (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    dropdownSetter?: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setter((prev) => !prev);
    if (dropdownSetter) {
      dropdownSetter(false); // Close dropdown when toggling ON/OFF directly
    }
  };

  const handleLslToggleClick = () => {
    if (lslStreamEnabled) { // If already ON, turn it OFF
      setLslStreamEnabled(false);
      setShowLslDropdown(false);
    } else { // If OFF, open dropdown or turn ON
      setShowLslDropdown(prev => !prev);
    }
  };

  const handleTcpToggleClick = () => {
    if (tcpStreamEnabled) { // If already ON, turn it OFF
      setTcpStreamEnabled(false);
      setShowTcpDropdown(false);
    } else { // If OFF, open dropdown or turn ON
      setShowTcpDropdown(prev => !prev);
    }
  };

  const handleChangeSaveLocation = async () => {
    if (window.showDirectoryPicker) {
      try {
        const directoryHandle = await window.showDirectoryPicker({
          startIn: 'documents' // Suggest starting in the main Documents folder
        });
        setSaveLocation(directoryHandle.name || "Selected Folder");
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.log("User cancelled the directory selection.");
        } else {
          console.error("Error picking directory:", err);
          alert("Could not pick directory. You can try entering the path manually.");
          const currentPath = saveLocation === DEFAULT_SAVE_LOCATION ? "" : saveLocation;
          const newPath = prompt(
            "Enter new save location (e.g., C:\\MySessions).\nLeave blank or cancel to use Default.",
            currentPath
          );
          if (newPath === null) return;
          setSaveLocation(newPath.trim() === "" ? DEFAULT_SAVE_LOCATION : newPath);
        }
      }
    } else {
      alert("Your browser does not support native directory picking. Please enter the path manually.");
      const currentPath = saveLocation === DEFAULT_SAVE_LOCATION ? "" : saveLocation;
      const newPath = prompt(
        "Enter new save location (e.g., C:\\MySessions).\nLeave blank or cancel to use Default.",
        currentPath
      );
      if (newPath === null) {
        return;
      }
      if (newPath.trim() === "") {
        setSaveLocation(DEFAULT_SAVE_LOCATION);
      } else {
        setSaveLocation(newPath);
      }
    }
  };

  const handleBoardSelect = (boardName: string) => {
    setSelectedBoard(boardName);
    setShowBoardDropdown(false);
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserDropdown(false);
  };

  const handleGoToDevices = () => {
    console.log("Navigate to devices page");
    setShowBoardDropdown(false); 
  };

  const handleGoToUsers = () => {
    console.log("Navigate to users page/settings");
    setShowUserDropdown(false); 
  };


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
                disabled={recording}
                title={recording ? "Settings cannot be changed during recording." : (selectedBoard || "Select Board")}
              >
                <img src={wbbIconLineBlue} alt="Board Icon" className="board-selector-icon" />
                <span className="board-selector-name">{selectedBoard || "Select Board"}</span>
              </button>
              {showBoardDropdown && !recording && (
                <div ref={boardDropdownRef} className="board-selector-dropdown">
                  <ul className="board-list">
                    {connectedBoards.map((board) => (
                      <li
                        key={board}
                        className="board-list-item"
                        onClick={() => handleBoardSelect(board)}
                      >
                        {board}
                      </li>
                    ))}
                  </ul>
                  <button className="go-to-devices-btn" onClick={handleGoToDevices}>
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
                title={recording ? "Settings cannot be changed during recording." : (selectedUserId || "Select User")}
              >
                <img src={userIcon} alt="User Icon" className="board-selector-icon" />
                <span className="board-selector-name">{selectedUserId || "Select User"}</span>
              </button>
              {showUserDropdown && !recording && (
                <div ref={userDropdownRef} className="user-selector-dropdown">
                  <ul className="board-list">
                    {availableUsers.map((user) => (
                      <li
                        key={user.id}
                        className="board-list-item user-list-item"
                        onClick={() => handleUserSelect(user.id)}
                      >
                        <span 
                          className="user-color-dot" 
                          style={{ backgroundColor: user.color }}
                        ></span>
                        {user.id}
                      </li>
                    ))}
                  </ul>
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
              className={`board-selector-toggle session-setting-toggle save-location-toggle-wide`}
              onClick={handleChangeSaveLocation}
              title={recording ? "Settings cannot be changed during recording." : saveLocation} // Shows full path on hover or recording message
              disabled={recording}
            >
              <img src={folderIcon} alt="Folder" /> {/* Removed inline style */}
              <span className="board-selector-name">
                {saveLocation === DEFAULT_SAVE_LOCATION
                  ? "Default"
                  : formatDisplayPath(saveLocation, 27) /* Adjusted maxLength */}
              </span>
            </button>
          </div>

          <div className="toggle-label-wrapper">
            <span className="toggle-label">LSL</span>
            <div className="lsl-selector-wrapper"> {/* Added wrapper */}
              <button
                ref={lslToggleRef} // Added ref
                className={`session-setting-toggle ${lslStreamEnabled ? "active" : ""}`}
                onClick={handleLslToggleClick} // Modified onClick
                aria-haspopup="true" // Added aria attribute
                aria-expanded={showLslDropdown} // Added aria attribute
                disabled={recording}
                title={recording ? "Settings cannot be changed during recording." : (lslStreamEnabled ? "LSL Stream is ON" : "LSL Stream is OFF")}
              >
                {lslStreamEnabled ? "ON" : "OFF"}
              </button>
              {showLslDropdown && !lslStreamEnabled && !recording && ( /* Show dropdown only if LSL is OFF and not recording */
                <div ref={lslDropdownRef} className="lsl-selector-dropdown"> {/* Added dropdown */}
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
            <div className="tcp-selector-wrapper"> {/* Added wrapper */}
              <button
                ref={tcpToggleRef} // Added ref
                className={`session-setting-toggle ${tcpStreamEnabled ? "active" : ""}`}
                onClick={handleTcpToggleClick} // Modified onClick
                aria-haspopup="true" // Added aria attribute
                aria-expanded={showTcpDropdown} // Added aria attribute
                disabled={recording}
                title={recording ? "Settings cannot be changed during recording." : (tcpStreamEnabled ? "TCP Stream is ON" : "TCP Stream is OFF")}
              >
                {tcpStreamEnabled ? "ON" : "OFF"}
              </button>
              {showTcpDropdown && !tcpStreamEnabled && !recording && ( /* Show dropdown only if TCP is OFF and not recording */
                <div ref={tcpDropdownRef} className="tcp-selector-dropdown"> {/* Added dropdown */}
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
      <div className="session-content" style={{ flex: 1 }}>
        <div className="wbb-topdown-container" ref={wbbTopdownContainerRef}>
          <img 
            src={wbbTopdownIcon} 
            alt="WBB Topdown" 
            className="wbb-topdown-icon" 
            ref={wbbTopdownImageRef}
            onLoad={() => { /* ... existing onLoad ... */ }}
          />
          {recording && copPosition && svgRenderedBounds && (
            <>
              {trailPoints.map(point => {
                const age = Date.now() - point.timestamp;
                // relativeAge goes from 0 (new) to 1 (oldest)
                const relativeAge = Math.min(1, Math.max(0, age / TRAIL_MAX_AGE));
                
                // Opacity fades from 0.7 (for trail) to 0
                const opacity = 0.7 * (1 - relativeAge);
                // Lightness: blue (hsl(240, 100%, 50%)) lightens towards a very light blue (hsl(240, 100%, 85%))
                // Start at 60% lightness for trail, up to 85%
                const lightness = 60 + 25 * relativeAge; 

                return (
                  <div
                    key={point.id}
                    className="cop-indicator-trail" 
                    style={{
                      left: `${svgRenderedBounds.x + point.x - (TRAIL_DOT_DIAMETER / 2)}px`,
                      top: `${svgRenderedBounds.y + point.y - (TRAIL_DOT_DIAMETER / 2)}px`,
                      width: `${TRAIL_DOT_DIAMETER}px`,
                      height: `${TRAIL_DOT_DIAMETER}px`,
                      backgroundColor: `hsla(240, 100%, ${lightness}%, ${opacity})`,
                    }}
                  />
                );
              })}
              <div
                className="cop-indicator-circle" // Renamed class
                style={{
                  left: `${svgRenderedBounds.x + copPosition.x - (CIRCLE_DIAMETER / 2)}px`, // Changed circlePosition to copPosition
                  top: `${svgRenderedBounds.y + copPosition.y - (CIRCLE_DIAMETER / 2)}px`,  // Changed circlePosition to copPosition
                  width: `${CIRCLE_DIAMETER}px`,
                  height: `${CIRCLE_DIAMETER}px`,
                }}
              />
            </>
          )}
        </div>
        {/* Other future content of session-content will go here */}
      </div>

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