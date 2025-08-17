import React, {useState, useRef, useEffect, useMemo} from "react";
import "./ActivityTimeline.css";
import balanceIcon from "../../assets/balance-icon.svg";

/**
 * Dynamic image loading system for activity timeline blocks
 * Uses Vite's import.meta.glob to dynamically find SVG images from the assets folder
 */
const activityImageModules = import.meta.glob("/src/assets/activities/**/*.svg", {
  eager: true,
  as: "url",
});

/**
 * Image item structure used by the image loader functions
 */
interface ImageItem {
  path: string; // File path of the image
  image: string; // URL of the image
}

/**
 * Retrieves all SVG images for a specific activity from the assets folder
 *
 * @param activityName - The identifier of the activity (e.g., 'tandem-stance', 'tug')
 * @returns Array of image URLs for the activity, sorted by sequence number
 */
export function getActivityImages(activityName: string): string[] {
  if (!activityName) return [];

  const images: ImageItem[] = [];

  // Match activity images by name pattern
  const regex = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}[\\d\\w-]+\\.svg$`);

  // Sort function to order by number in filename
  const sortByNumber = (a: string, b: string) => {
    // Extract the number after the activity name
    const aMatch = a.match(new RegExp(`${activityName}(\\d+)`));
    const bMatch = b.match(new RegExp(`${activityName}(\\d+)`));

    if (aMatch && bMatch) {
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    }
    return a.localeCompare(b);
  };

  // Find all matching SVGs for this activity
  Object.entries(activityImageModules).forEach(([path, imageUrl]) => {
    if (regex.test(path)) {
      images.push({
        path: path,
        image: imageUrl,
      });
    }
  });

  // Sort images by their number
  const sortedImages = images.sort((a, b) => sortByNumber(a.path, b.path));

  return sortedImages.map((item) => item.image);
}

/**
 * Retrieves images for a specific action within an activity
 *
 * This function tries to find images that match the specific action first,
 * then falls back to general activity images if none are found.
 *
 * @param activityName - The identifier of the activity (e.g., 'tandem-stance')
 * @param actionLabel - The identifier of the action (e.g., 'tandem-stand')
 * @returns Array of image URLs for the specific action, sorted by sequence
 */
export function getActionImages(activityName: string, actionLabel: string): string[] {
  if (!activityName || !actionLabel) return [];

  const images: ImageItem[] = [];

  // Define patterns to match action-specific images
  // Pattern 1: activityName-actionLabel.svg or activityName-actionLabel-N.svg
  const regex1 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}-${actionLabel}(-\\d+)?\.svg$`);

  // Pattern 2: activityNameN-actionLabel.svg
  const regex2 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}\\d+-${actionLabel}\\.svg$`);

  // Pattern 3: activityNameN.svg (general sequence images)
  const regex3 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}\\d+\\.svg$`);

  // Sort function to order by number in filename
  const sortByNumber = (a: string, b: string) => {
    const aMatch = a.match(/(\d+)\.svg$/) || a.match(/(\d+)-/);
    const bMatch = b.match(/(\d+)\.svg$/) || b.match(/(\d+)-/);
    if (aMatch && bMatch) {
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    }
    return a.localeCompare(b);
  };

  // Find matching images, prioritizing action-specific ones
  Object.entries(activityImageModules).forEach(([path, imageUrl]) => {
    // First prioritize action-specific images (Pattern 1 & 2)
    if (regex1.test(path) || regex2.test(path)) {
      images.push({
        path: path,
        image: imageUrl,
      });
    }
    // If no action-specific images found yet, include general sequence images
    else if (images.length === 0 && regex3.test(path)) {
      images.push({
        path: path,
        image: imageUrl,
      });
    }
  });

  // If no images found, try using general sequence images
  if (images.length === 0) {
    Object.entries(activityImageModules).forEach(([path, imageUrl]) => {
      if (regex3.test(path)) {
        images.push({
          path: path,
          image: imageUrl,
        });
      }
    });
  }

  // Sort images by their sequence number
  const sortedImages = images.sort((a, b) => sortByNumber(a.path, b.path));

  return sortedImages.map((item) => item.image);
}

/**
 * Gets a single image for a specific action block
 *
 * This function attempts to find an image specifically matching the action label.
 * If not found, it falls back to a general activity image.
 *
 * @param activityName - The identifier of the activity (e.g., 'tandem-stance')
 * @param actionLabel - The identifier of the action (e.g., 'tandem-stand')
 * @returns The image URL or undefined if no image was found
 */
export function getActionImage(activityName: string, actionLabel: string): string | undefined {
  if (!activityName || !actionLabel) {
    return undefined;
  }

  const actionSpecificImages: ImageItem[] = [];

  // Pattern 1: activityName-actionLabel.svg or activityName-actionLabel-N.svg
  const regex1 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}-${actionLabel}(-\\d+)?\.svg$`);

  // Pattern 2: activityNameN-actionLabel.svg
  const regex2 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}\\d+-${actionLabel}\\.svg$`);

  // Find all matching action-specific images
  Object.entries(activityImageModules).forEach(([path, imageUrl]) => {
    if (regex1.test(path) || regex2.test(path)) {
      actionSpecificImages.push({
        path: path,
        image: imageUrl,
      });
    }
  });

  // If action-specific images found, sort and return the first one
  if (actionSpecificImages.length > 0) {
    const sortedImages = actionSpecificImages.sort((a, b) => {
      const aMatch = a.path.match(/(\d+)\.svg$/) || a.path.match(/(\d+)-/);
      const bMatch = b.path.match(/(\d+)\.svg$/) || b.path.match(/(\d+)-/);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      return a.path.localeCompare(b.path);
    });
    return sortedImages[0].image;
  }

  // If no specific action image found, fall back to general activity images
  const defaultImages = getActivityImages(activityName);
  return defaultImages.length > 0 ? defaultImages[0] : undefined;
}

/**
 * Represents a single block in the activity timeline
 */
export interface TimelineBlock {
  id: number; // Unique identifier for the block
  title: string; // Human-readable title for display
  label: string; // Machine-readable identifier for the action
  start: number; // Start time in seconds
  duration: number; // Duration in seconds
  image?: string; // Path to the image for this action block
}

/**
 * Props for the ActivityTimeline component
 */
interface ActivityTimelineProps {
  blocks: TimelineBlock[]; // Array of timeline blocks to display
  onChange: (blocks: TimelineBlock[]) => void; // Callback when blocks are modified
  onBlockSelect?: (block: TimelineBlock) => void; // Optional callback when a block is selected
  activityName?: string; // Activity name for finding images
}

/**
 * Minimum allowed duration for a timeline block (in seconds)
 */
const MIN_DURATION = 1;

/**
 * ActivityTimeline component
 *
 * Displays a draggable, resizable timeline of action blocks for an activity.
 * Each block represents a specific action in the balance assessment protocol.
 */
export default function ActivityTimeline({ blocks, onChange, onBlockSelect, activityName }: ActivityTimelineProps) {
  // Drag & drop state
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);
  const dragBlockIdx = useRef<number | null>(null);

  const blocksWithImages = useMemo(() => {
    return blocks.map((block) => {
      if (!block.image) {
        const image = getActionImage(activityName, block.label);
        return image ? { ...block, image } : block;
      }
      return block;
    });
  }, [blocks, activityName]);

  // Resize state
  const [resizeInfo, setResizeInfo] = useState<{
    id: number;
    direction: "left" | "right";
    startX: number;
    startDuration: number;
  } | null>(null);

  // Duration editing state
  const [editingDurationId, setEditingDurationId] = useState<number | null>(null);
  const [durationInputValue, setDurationInputValue] = useState<string>("");

  /**
   * Handles deletion of a timeline block
   */
  const handleDeleteBlock = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from propagating to parent

    // Filter out the deleted block
    const newBlocks = blocks.filter((b) => b.id !== id);

    // Recalculate start times to keep blocks contiguous
    let currentStart = 0;
    const contiguousBlocks = newBlocks.map((b) => {
      const updated = { ...b, start: currentStart };
      currentStart += b.duration;
      return updated;
    });

    onChange(contiguousBlocks);
  };

  /**
   * Starts a resize operation on a block
   */
  const onResizeStart = (id: number, direction: "left" | "right", e: React.MouseEvent) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;

    setResizeInfo({
      id,
      direction,
      startX: e.clientX,
      startDuration: block.duration,
    });

    e.stopPropagation();
  };

  /**
   * Handles resize during mouse movement
   */
  const onResize = (e: MouseEvent) => {
    if (!resizeInfo) return;

    const { id, direction, startX, startDuration } = resizeInfo;
    const delta = e.clientX - startX;
    const scale = 2; // Pixels per second scaling factor

    // Calculate new duration based on direction and mouse movement
    let newDuration = startDuration;
    if (direction === "right") {
      newDuration = Math.max(MIN_DURATION, startDuration + Math.round(delta / scale));
    } else {
      newDuration = Math.max(MIN_DURATION, startDuration - Math.round(delta / scale));
    }

    // Update the block with new duration
    onChange(blocks.map((b) => (b.id === id ? { ...b, duration: newDuration } : b)));
  };

  /**
   * Ends a resize operation
   */
  const onResizeEnd = () => setResizeInfo(null);

  /**
   * Set up and clean up resize event listeners
   */
  useEffect(() => {
    if (!resizeInfo) return;

    // Set up event listeners when resize starts
    const onMouseMove = (e: MouseEvent) => onResize(e);
    const onMouseUp = () => onResizeEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Clean up event listeners when resize ends or component unmounts
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizeInfo]);

  /**
   * Handles the start of a block drag operation
   */
  const handleBlockMouseDown = (idx: number, e: React.MouseEvent) => {
    // Don't start dragging if we're already resizing or clicked on a resize handle
    if (resizeInfo || (e.target as HTMLElement).classList.contains("resize-handle")) {
      return;
    }

    // Set up dragging state
    dragBlockIdx.current = idx;
    setDraggedId(blocks[idx].id);
    setDragPreview({ x: e.clientX, y: e.clientY });

    // Add global event listeners for mouse movement and release
    window.addEventListener("mousemove", handleBlockMouseMove);
    window.addEventListener("mouseup", handleBlockMouseUp);

    e.preventDefault();
  };

  /**
   * Handles mouse movement during block dragging
   */
  const handleBlockMouseMove = (e: MouseEvent) => {
    if (dragBlockIdx.current === null) return;

    // Update the drag preview position
    setDragPreview({ x: e.clientX, y: e.clientY });

    // Get the timeline container dimensions
    const timelineRect = (document.querySelector(".activity-timeline") as HTMLElement)?.getBoundingClientRect();
    if (!timelineRect) return;

    // Calculate cursor position relative to timeline
    const x = e.clientX - timelineRect.left;

    // Get all block elements
    const timelineBlocks = Array.from(document.querySelectorAll(".timeline-block")) as HTMLElement[];

    // Calculate positions of all block boundaries
    const positions: number[] = [0]; // Start with position 0
    let accWidth = 0;
    for (let i = 0; i < timelineBlocks.length; i++) {
      accWidth += timelineBlocks[i].offsetWidth;
      positions.push(accWidth);
    }

    // Find the closest boundary position
    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < positions.length; i++) {
      const dist = Math.abs(x - positions[i]);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    // Update the drag target index
    setDragOverIdx(closestIdx);
    dragOverIdxRef.current = closestIdx;
  };

  /**
   * Handles the end of a block drag operation
   */
  const handleBlockMouseUp = () => {
    const currentDragOverIdx = dragOverIdxRef.current;
    const fromIdx = dragBlockIdx.current;

    // If we have valid drag indexes, process the reordering
    if (fromIdx !== null && currentDragOverIdx !== null) {
      const toIdx = currentDragOverIdx;

      // Only reorder if the block is dropped in a different position
      // and not adjacent to its original position
      if (fromIdx !== toIdx && fromIdx + 1 !== toIdx) {
        // Create a copy of the blocks array
        const newBlocks = [...blocks];

        // Remove the dragged block
        const [removed] = newBlocks.splice(fromIdx, 1);

        // Adjust target index if moving forward in the list
        let adjustedToIdx = toIdx;
        if (fromIdx < toIdx) adjustedToIdx--;

        // Insert the block at the new position
        newBlocks.splice(adjustedToIdx, 0, removed);

        // Recalculate start times to maintain contiguous blocks
        let currentStart = 0;
        const contiguousBlocks = newBlocks.map((b) => {
          const updated = { ...b, start: currentStart };
          currentStart += b.duration;
          return updated;
        });

        onChange(contiguousBlocks);
      }
    }

    // Clean up drag state
    cleanupDrag();
  };

  /**
   * Cleans up drag state and removes event listeners
   */
  const cleanupDrag = () => {
    setDraggedId(null);
    setDragOverIdx(null);
    dragOverIdxRef.current = null;
    setDragPreview(null);
    dragBlockIdx.current = null;
    window.removeEventListener("mousemove", handleBlockMouseMove);
    window.removeEventListener("mouseup", handleBlockMouseUp);
  };

  return (
    <>
      <div
        className="flex flex-col h-20"
        style={{
          cursor: draggedId !== null ? "grabbing" : "default",
        }}
      >
        {/* Main timeline blocks container */}
        <div className="flex h-full" >
          {blocksWithImages.map((block, idx) => (
            <React.Fragment key={block.id}>
              {/* Drop indicator when dragging */}
              {draggedId !== null && dragOverIdx === idx && (
                <div
                  style={{
                    width: 0,
                    height: 48,
                    borderLeft: "3px solid var(--primary)",
                    margin: "0 2px",
                    position: "relative",
                    zIndex: 10,
                    background: "none",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Timeline block */}
              <div
                className="timeline-block flex flex-row"
                tabIndex={0}
                data-block-id={block.id}
                onMouseDown={(e) => handleBlockMouseDown(idx, e)}
                onClick={() => {
                  if (onBlockSelect) {
                    onBlockSelect(block);
                  }
                }}
                style={{
                  flex: block.duration,
                  minWidth: 40,
                  margin: 0,
                  opacity: draggedId === block.id ? 0.2 : 1,
                  cursor: resizeInfo ? "default" : draggedId === block.id ? "grabbing" : "grab",
                  userSelect: "none",
                  pointerEvents: "auto",
                  position: "relative",
                  zIndex: draggedId === block.id ? 2 : 1,
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  padding: "0.3vw 0.2vw",
                  height: "100%",
                  maxHeight: "10vh",
                  boxSizing: "border-box",
                }}
              >
                <button
                  className="delete-block-btn"
                  onClick={(e) => handleDeleteBlock(block.id, e)}
                  title="Delete block"
                  tabIndex={-1}
                  aria-label="Delete block"
                  type="button"
                >
                  ×
                </button>
                <div
                  className="resize-handle left"
                  onMouseDown={(e) => onResizeStart(block.id, "left", e)}
                  style={{ cursor: "ew-resize", pointerEvents: "auto" }}
                />
                <div
                  className="block-title"
                  style={{
                    width: "100%",
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: "0.95vw",
                    marginBottom: "0.2vw",
                    color: "var(--text-dark)",
                  }}
                >
                  {block.title}
                </div>
                <div
                  className="block-svg"
                  style={{
                    flex: 1,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 0,
                  }}
                  data-block-id={block.id}
                  data-block-label={block.label}
                >
                  {/* Block image - uses provided image or falls back to default */}
                  <img
                    src={block.image || balanceIcon}
                    alt={block.title}
                    style={{
                      width: "auto",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                    }}
                    onError={(e) => {
                      // Fall back to default icon if image fails to load
                      e.currentTarget.src = balanceIcon;
                    }}
                  />
                </div>
                <div
                  className="resize-handle right"
                  onMouseDown={(e) => onResizeStart(block.id, "right", e)}
                  style={{ cursor: "ew-resize", pointerEvents: "auto" }}
                />
              </div>
            </React.Fragment>
          ))}
          {draggedId !== null && dragOverIdx === blocks.length && (
            <div
              style={{
                width: 0,
                height: 48,
                borderLeft: "3px solid var(--primary)",
                margin: "0 2px",
                position: "relative",
                zIndex: 10,
                background: "none",
                pointerEvents: "none",
              }}
            />
          )}
          {draggedId !== null &&
            dragPreview &&
            (() => {
              const block = blocks.find((b) => b.id === draggedId);
              if (!block) return null;
              return (
                <div
                  className="timeline-block drag-preview"
                  style={{
                    position: "fixed",
                    left: dragPreview.x + 8,
                    top: dragPreview.y + 8,
                    width: 120,
                    minWidth: 40,
                    pointerEvents: "none",
                    opacity: 0.85,
                    zIndex: 9999,
                    background: "var(--primary-light, #e0e7ff)",
                    border: "2px solid var(--primary)",
                    borderRadius: "var(--radius-lg)",
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    boxShadow: "var(--shadow-medium)",
                  }}
                >
                  <span
                    className="block-label"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      color: "var(--primary-dark, #3730a3)",
                      fontWeight: 500,
                    }}
                  >
                    {block.title}
                  </span>
                </div>
              );
            })()}
        </div>

        {/* Durations row - shows and allows editing of block durations */}
        <div
          className="activity-timeline-durations"
          style={{
            display: "flex",
            width: "100%",
            marginTop: 4,
            alignItems: "flex-start",
            minHeight: 20,
          }}
        >
          {blocks.map((block) => (
            <div
              key={block.id}
              style={{
                flex: block.duration,
                minWidth: 40,
                textAlign: "center",
                fontSize: "0.85vw",
                color: "var(--primary-dark, #3730a3)",
                fontWeight: 500,
                userSelect: "none",
                cursor: "pointer",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                columnGap: 2,
              }}
              onClick={() => {
                setEditingDurationId(block.id);
                setDurationInputValue(block.duration.toString());
              }}
            >
              {editingDurationId === block.id ? (
                <>
                  <input
                    type="number"
                    min={MIN_DURATION}
                    value={durationInputValue}
                    autoFocus
                    style={{
                      width: 40,
                      fontSize: "0.85vw",
                      textAlign: "center",
                      border: "1px solid var(--primary)",
                      borderRadius: 4,
                      outline: "none",
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) setDurationInputValue(val);
                    }}
                    onBlur={() => {
                      const val = parseInt(durationInputValue, 10);
                      if (!isNaN(val) && val >= MIN_DURATION) {
                        onChange(blocks.map((b) => (b.id === block.id ? { ...b, duration: val } : b)));
                      }
                      setEditingDurationId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(durationInputValue, 10);
                        if (!isNaN(val) && val >= MIN_DURATION) {
                          onChange(blocks.map((b) => (b.id === block.id ? { ...b, duration: val } : b)));
                        }
                        setEditingDurationId(null);
                      } else if (e.key === "Escape") {
                        setEditingDurationId(null);
                      }
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.8vw",
                      color: "var(--primary-dark, #3730a3)",
                      marginLeft: 0,
                    }}
                  >
                    s
                  </span>
                </>
              ) : (
                <>
                  {block.duration}
                  <span
                    style={{
                      fontSize: "0.8vw",
                      color: "var(--primary-dark, #3730a3)",
                      marginLeft: 0,
                    }}
                  >
                    s
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
