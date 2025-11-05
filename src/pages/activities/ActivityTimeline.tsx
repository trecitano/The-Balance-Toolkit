import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import "./ActivityTimeline.css";
import { TimelineBlock } from "@/types.ts";
import { getBlockImage } from "@/utils/activityImages.ts";

interface ActivityTimelineProps {
  blocks: TimelineBlock[];
  editable?: boolean;
  onChange?: (blocks: TimelineBlock[]) => void;
  onBlockSelect?: (block: TimelineBlock) => void;
  height?: string;
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

type DragState = {
  type: "drag";
  blockIdx: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  dropIdx: number | null;
};

type ResizeState = {
  type: "resize";
  blockIdx: number;
  direction: "left" | "right";
  startX: number;
  startDuration: number;
};

type InteractionState = DragState | ResizeState | null;

export default function ActivityTimeline({
  blocks,
  editable = false,
  onChange,
  onBlockSelect,
  height = "h-100",
}: ActivityTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>(null);
  const [editingDurationIdx, setEditingDurationIdx] = useState<number | null>(null);
  const [durationInputValue, setDurationInputValue] = useState<string>("");

  const totalDuration = useMemo(() => blocks.reduce((sum, b) => sum + b.duration, 0), [blocks]);

  const computeDropIndex = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || totalDuration === 0) return 0;

      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const xSeconds = (x / rect.width) * totalDuration;

      const boundaries: number[] = [0];
      blocks.forEach((b) => boundaries.push(boundaries[boundaries.length - 1] + b.duration));

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
    [blocks, totalDuration],
  );

  // Mouse Interactions - only active when editable
  useEffect(() => {
    if (!interaction || !editable || !onChange || !onBlockSelect) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (interaction.type === "drag") {
        const dropIdx = computeDropIndex(e.clientX);
        setInteraction({
          ...interaction,
          currentX: e.clientX,
          currentY: e.clientY,
          dropIdx,
        });
      } else if (interaction.type === "resize") {
        const { blockIdx, direction, startX, startDuration } = interaction;
        const delta = e.clientX - startX;
        const scale = 2; // px per second

        let newDuration =
          direction === "right" ? startDuration + Math.round(delta / scale) : startDuration - Math.round(delta / scale);
        newDuration = Math.max(MIN_DURATION, newDuration);

        const updated = blocks.map((b, idx) => (idx === blockIdx ? { ...b, duration: newDuration } : b));
        onChange(recalcStartTimes(updated));
      }
    };

    const handleMouseUp = () => {
      if (interaction.type === "drag") {
        const { blockIdx, dropIdx } = interaction;
        if (dropIdx != null && blockIdx !== dropIdx && blockIdx + 1 !== dropIdx) {
          const copy = [...blocks];
          const [removed] = copy.splice(blockIdx, 1);
          const insertIdx = blockIdx < dropIdx ? dropIdx - 1 : dropIdx;
          copy.splice(insertIdx, 0, removed);
          onChange(recalcStartTimes(copy));
        }
      }
      setInteraction(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [interaction, blocks, onChange, computeDropIndex, editable]);

  const handleBlockMouseDown = (idx: number, e: React.MouseEvent) => {
    if (!editable || interaction || (e.target as HTMLElement).classList.contains("resize-handle")) {
      return;
    }
    e.preventDefault();
    setInteraction({
      type: "drag",
      blockIdx: idx,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      dropIdx: null,
    });
  };

  const handleResizeStart = (blockIdx: number, direction: "left" | "right", e: React.MouseEvent) => {
    if (!editable) return;
    const block = blocks[blockIdx];
    if (!block) return;
    e.stopPropagation();
    setInteraction({
      type: "resize",
      blockIdx,
      direction,
      startX: e.clientX,
      startDuration: block.duration,
    });
  };

  const handleDeleteBlock = (blockIdx: number, e: React.MouseEvent) => {
    if (!editable || !onChange || !onBlockSelect) return;

    e.stopPropagation();
    const remaining = blocks.filter((_, idx) => idx !== blockIdx);
    onChange(recalcStartTimes(remaining));
  };

  const handleDurationEdit = (idx: number) => {
    if (!editable || !onChange || !onBlockSelect) return;

    setEditingDurationIdx(idx);
    setDurationInputValue(blocks[idx].duration.toString());
  };

  const handleDurationSave = (idx: number) => {
    if (!editable || !onChange || !onBlockSelect) return;

    const val = parseInt(durationInputValue, 10);
    if (!isNaN(val) && val >= MIN_DURATION) {
      const updated = blocks.map((b, i) => (i === idx ? { ...b, duration: val } : b));
      onChange(recalcStartTimes(updated));
    }
    setEditingDurationIdx(null);
  };

  const isDragging = interaction?.type === "drag";
  const draggedIdx = isDragging ? interaction.blockIdx : null;
  const dragOverIdx = isDragging ? interaction.dropIdx : null;
  const isResizing = interaction?.type === "resize";

  // Determine cursor based on state
  const getBlockCursor = (idx: number) => {
    if (!editable) return "default";
    if (isResizing) return "default";
    if (draggedIdx === idx) return "grabbing";
    return "grab";
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${!editable ? "opacity-75" : ""}`}
      style={{ cursor: isDragging && editable ? "grabbing" : "default" }}
    >
      <div className={`flex h-full flex-1 ${editable ? "gap-1" : ""}`}>
        {blocks.map((block, idx) => (
          <React.Fragment key={idx}>
            {editable && dragOverIdx === idx && (
              <div className="pointer-events-none relative z-10 mx-0.5 h-12 w-0 border-l-2 border-blue-500" />
            )}

            <div
              className={`timeline-block relative select-none ${height} ${!editable ? "pointer-events-none" : "pointer-events-auto"} ${draggedIdx === idx ? "z-20 opacity-20" : "z-10"} ${editable ? "transition-colors hover:bg-gray-50" : ""} `}
              data-block-id={idx}
              onMouseDown={(e) => handleBlockMouseDown(idx, e)}
              onClick={() => onBlockSelect?.(block)}
              onDoubleClick={(_) => {
                handleDurationEdit(idx);
              }}
              style={{
                flex: block.duration,
                minWidth: 1,
                cursor: getBlockCursor(idx),
              }}
            >
              {/* Delete button - only show when editable */}
              {editable && (
                <button
                  className="delete-block-btn absolute h-5 w-5 rounded-full bg-red-500 text-sm text-white"
                  onClick={(e) => handleDeleteBlock(idx, e)}
                  title="Delete block"
                  tabIndex={-1}
                  aria-label="Delete block"
                  type="button"
                >
                  ×
                </button>
              )}

              {/* Resize handles - only show when editable */}
              {editable && (
                <>
                  <div
                    className="resize-handle left absolute top-0 left-0 h-full w-1 cursor-ew-resize hover:bg-blue-400 hover:opacity-50"
                    onMouseDown={(e) => handleResizeStart(idx, "left", e)}
                  />
                  <div
                    className="resize-handle right absolute top-0 right-0 h-full w-1 cursor-ew-resize hover:bg-blue-400 hover:opacity-50"
                    onMouseDown={(e) => handleResizeStart(idx, "right", e)}
                  />
                </>
              )}

              <div className={"flex h-full flex-col"}>
                <div className="w-full overflow-hidden px-1 text-center font-semibold text-ellipsis whitespace-nowrap text-gray-800">
                  {block.title}
                </div>

                <div className="mt-auto flex h-7/10 items-center justify-center">
                  <img src={getBlockImage(block.id)} alt={block.title} className="h-full object-cover" />
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}

        {editable && dragOverIdx === blocks.length && (
          <div className="pointer-events-none relative z-10 mx-0.5 h-12 w-0 border-l-2 border-blue-500" />
        )}

        {/* Drag preview */}
        {editable &&
          isDragging &&
          interaction &&
          (() => {
            const block = blocks[interaction.blockIdx];
            if (!block) return null;
            return (
              <div
                className="timeline-block pointer-events-none fixed z-50 flex h-12 w-30 min-w-10 items-center rounded-lg border-2 border-blue-500 bg-blue-100 opacity-85 shadow-lg"
                style={{
                  left: interaction.currentX + 8,
                  top: interaction.currentY + 8,
                }}
              >
                <span className="block-label flex-1 text-center font-medium text-blue-800">{block.title}</span>
              </div>
            );
          })()}
      </div>

      {/* Durations row */}
      <div className="mt-1 flex min-h-5 w-full items-start">
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className={`relative flex items-center justify-center gap-0.5 text-center text-sm font-medium text-blue-800 select-none ${editable ? "cursor-pointer rounded px-1" : "cursor-default"} `}
            style={{
              flex: block.duration,
              minWidth: 40,
            }}
            onClick={() => handleDurationEdit(idx)}
          >
            {editingDurationIdx === idx && editable ? (
              <>
                <input
                  type="number"
                  className="w-15 rounded border border-blue-500 text-center text-sm outline-none focus:ring-2 focus:ring-blue-300"
                  min={MIN_DURATION}
                  value={durationInputValue}
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) setDurationInputValue(val);
                  }}
                  onBlur={() => handleDurationSave(idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleDurationSave(idx);
                    } else if (e.key === "Escape") {
                      setEditingDurationIdx(null);
                    }
                  }}
                />
                <span className="text-sm text-blue-800">s</span>
              </>
            ) : (
              <span className="text-xs text-blue-800">{block.duration} s</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
