import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import "./ActivityTimeline.css";
import balanceIcon from "../../assets/balance-icon.svg";
import { TimelineBlock } from "@/types.ts";
import { getActionImage } from "@/utils/activityImages.ts";

interface ActivityTimelineProps {
  activityId: string;
  blocks: TimelineBlock[];
  onChange: (blocks: TimelineBlock[]) => void;
  onBlockSelect?: (block: TimelineBlock) => void;
}

const MIN_DURATION = 1;

function recalcStartTimes(arr: TimelineBlock[]): TimelineBlock[] {
  let start = 0;
  return arr.map((b) => {
    const out = { ...b, start };
    start += b.duration;
    return out;
  });
}

export default function ActivityTimeline({
                                           activityId,
                                           blocks,
                                           onChange,
                                           onBlockSelect,
                                         }: ActivityTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const blocksWithImages = useMemo(() => {
    return blocks.map((b) => {
      if (b.image) return b;
      const image = getActionImage(activityId, b.label);
      return image ? { ...b, image } : b;
    });
  }, [activityId, blocks]);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(
    null
  );

  const [resizeInfo, setResizeInfo] = useState<{
    blockIdx: number;
    direction: "left" | "right";
    startX: number;
    startDuration: number;
  } | null>(null);

  const [editingDurationIdx, setEditingDurationIdx] = useState<number | null>(null);
  const [durationInputValue, setDurationInputValue] = useState<string>("");

  const totalDuration = useMemo(
    () => blocks.reduce((sum, b) => sum + b.duration, 0),
    [blocks]
  );

  const computeDropIndex = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || totalDuration === 0) return 0;

      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const xSeconds = (x / rect.width) * totalDuration;

      // Positions in seconds at each boundary
      const boundaries: number[] = [0];
      blocks.forEach((b) =>
        boundaries.push(boundaries[boundaries.length - 1] + b.duration)
      );

      // Find nearest boundary
      let idx = 0;
      let best = Infinity;
      boundaries.forEach((pos, i) => {
        const d = Math.abs(xSeconds - pos);
        if (d < best) {
          best = d;
          idx = i;
        }
      });
      return idx;
    },
    [blocks, totalDuration]
  );

  const handleDeleteBlock = (blockIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = blocks.filter((_b, idx) => idx !== blockIdx);
    onChange(recalcStartTimes(remaining));
  };

  const onResizeStart = (
    blockIdx: number,
    direction: "left" | "right",
    e: React.MouseEvent
  ) => {
    const blk = blocks.find((_b, idx) => idx === blockIdx);
    if (!blk) return;
    e.stopPropagation();
    setResizeInfo({
      blockIdx,
      direction,
      startX: e.clientX,
      startDuration: blk.duration,
    });
  };

  const onResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeInfo) return;
      const { blockIdx, direction, startX, startDuration } = resizeInfo;
      const delta = e.clientX - startX;
      const scale = 2; // px per second

      let newDuration =
        direction === "right"
          ? startDuration + Math.round(delta / scale)
          : startDuration - Math.round(delta / scale);
      newDuration = Math.max(MIN_DURATION, newDuration);

      const updated = blocks.map((b, idx) =>
        blockIdx === idx ? { ...b, duration: newDuration } : b
      );
      onChange(recalcStartTimes(updated));
    },
    [blocks, onChange, resizeInfo]
  );

  const onResizeEnd = useCallback(() => setResizeInfo(null), []);

  useEffect(() => {
    if (!resizeInfo) return;
    const mm = (e: MouseEvent) => onResizeMove(e);
    const mu = () => onResizeEnd();
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, [resizeInfo, onResizeMove, onResizeEnd]);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartIdxRef = useRef<number | null>(null);

  const handleBlockMouseDown = (idx: number, e: React.MouseEvent) => {
    if (
      resizeInfo ||
      (e.target as HTMLElement).classList.contains("resize-handle")
    ) {
      return;
    }
    e.preventDefault();
    dragStartIdxRef.current = idx;
    setDraggedIdx(idx);
    setDragPreview({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

// fresh handlers live inside the effect
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      setDragPreview({ x: e.clientX, y: e.clientY });
      const idx = computeDropIndex(e.clientX);
      setDragOverIdx(idx);
    };

    const onUp = () => {
      const fromIdx = dragStartIdxRef.current;
      const toIdx = dragOverIdx;
      if (fromIdx != null && toIdx != null && fromIdx !== toIdx && fromIdx + 1 !== toIdx) {
        const copy = [...blocks];
        const [removed] = copy.splice(fromIdx, 1);
        const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
        copy.splice(insertIdx, 0, removed);
        onChange(recalcStartTimes(copy));
      }
      setDraggedIdx(null);
      setDragOverIdx(null);
      setDragPreview(null);
      dragStartIdxRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, computeDropIndex, blocks, onChange, dragOverIdx]);

  return (
    <div
      ref={containerRef}
      className="activity-timeline flex flex-col h-20"
      style={{ cursor: draggedIdx !== null ? "grabbing" : "default" }}
    >
      <div className="flex h-full">
        {blocksWithImages.map((block, idx) => (
          <React.Fragment key={idx}>
            {draggedIdx !== null && dragOverIdx === idx && (
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

            <div
              className="timeline-block flex flex-row"
              tabIndex={0}
              data-block-id={idx}
              onMouseDown={(e) => handleBlockMouseDown(idx, e)}
              onClick={() => onBlockSelect?.(block)}
              style={{
                flex: block.duration,
                minWidth: 40,
                margin: 0,
                opacity: draggedIdx === idx ? 0.2 : 1,
                cursor:
                  resizeInfo != null
                    ? "default"
                    : draggedIdx === idx
                      ? "grabbing"
                      : "grab",
                userSelect: "none",
                pointerEvents: "auto",
                position: "relative",
                zIndex: draggedIdx === idx ? 2 : 1,
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
                onClick={(e) => handleDeleteBlock(idx, e)}
                title="Delete block"
                tabIndex={-1}
                aria-label="Delete block"
                type="button"
              >
                ×
              </button>
              <div
                className="resize-handle left"
                onMouseDown={(e) => onResizeStart(idx, "left", e)}
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
                data-block-id={idx}
                data-block-label={block.label}
              >
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
                    e.currentTarget.src = balanceIcon;
                  }}
                />
              </div>
              <div
                className="resize-handle right"
                onMouseDown={(e) => onResizeStart(idx, "right", e)}
                style={{ cursor: "ew-resize", pointerEvents: "auto" }}
              />
            </div>
          </React.Fragment>
        ))}

        {draggedIdx !== null && dragOverIdx === blocks.length && (
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

        {draggedIdx !== null &&
          dragPreview &&
          (() => {
            const block = blocks.find((b, idx) => idx === draggedIdx);
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

      {/* Durations row */}
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
        {blocks.map((block, idx) => (
          <div
            key={idx}
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
              setEditingDurationIdx(idx);
              setDurationInputValue(block.duration.toString());
            }}
          >
            {editingDurationIdx === idx ? (
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
                      const updated = blocks.map((b, innerIdx) =>
                        idx === innerIdx ? { ...b, duration: val } : b
                      );
                      onChange(recalcStartTimes(updated));
                    }
                    setEditingDurationIdx(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(durationInputValue, 10);
                      if (!isNaN(val) && val >= MIN_DURATION) {
                        const updated = blocks.map((b, innerIdx) =>
                          idx === innerIdx ? { ...b, duration: val } : b
                        );
                        onChange(recalcStartTimes(updated));
                      }
                      setEditingDurationIdx(null);
                    } else if (e.key === "Escape") {
                      setEditingDurationIdx(null);
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
  );
}