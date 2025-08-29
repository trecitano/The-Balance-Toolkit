import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import "./ActivityTimeline.css";
import balanceIcon from "../../assets/balance-icon.svg";
import { TimelineBlock } from "@/types.ts";
import { getActionImage } from "@/utils/activityImages.ts";

interface ActivityTimelineProps {
  activityId: string;
  blocks: TimelineBlock[];
  editable?: boolean;
  onChange?: (blocks: TimelineBlock[]) => void;
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

type DragState = {
  type: 'drag';
  blockIdx: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  dropIdx: number | null;
};

type ResizeState = {
  type: 'resize';
  blockIdx: number;
  direction: 'left' | 'right';
  startX: number;
  startDuration: number;
};

type InteractionState = DragState | ResizeState | null;

export default function ActivityTimeline({
                                           activityId,
                                           blocks,
                                           editable,
                                           onChange,
                                           onBlockSelect
                                         }: ActivityTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>(null);
  const [editingDurationIdx, setEditingDurationIdx] = useState<number | null>(null);
  const [durationInputValue, setDurationInputValue] = useState<string>("");

  const blocksWithImages = useMemo(() => {
    return blocks.map((b) => {
      if (b.image) return b;
      const image = getActionImage(activityId, b.label);
      return image ? { ...b, image } : b;
    });
  }, [activityId, blocks]);

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
      if (interaction.type === 'drag') {
        const dropIdx = computeDropIndex(e.clientX);
        setInteraction({
          ...interaction,
          currentX: e.clientX,
          currentY: e.clientY,
          dropIdx
        });
      } else if (interaction.type === 'resize') {
        const { blockIdx, direction, startX, startDuration } = interaction;
        const delta = e.clientX - startX;
        const scale = 2; // px per second

        let newDuration = direction === 'right'
          ? startDuration + Math.round(delta / scale)
          : startDuration - Math.round(delta / scale);
        newDuration = Math.max(MIN_DURATION, newDuration);

        const updated = blocks.map((b, idx) =>
          idx === blockIdx ? { ...b, duration: newDuration } : b
        );
        onChange(recalcStartTimes(updated));
      }
    };

    const handleMouseUp = () => {
      if (interaction.type === 'drag') {
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

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interaction, blocks, onChange, computeDropIndex, editable]);

  const handleBlockMouseDown = (idx: number, e: React.MouseEvent) => {
    if (!editable || interaction || (e.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }
    e.preventDefault();
    setInteraction({
      type: 'drag',
      blockIdx: idx,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      dropIdx: null
    });
  };

  const handleResizeStart = (blockIdx: number, direction: 'left' | 'right', e: React.MouseEvent) => {
    if (!editable) return;
    const block = blocks[blockIdx];
    if (!block) return;
    e.stopPropagation();
    setInteraction({
      type: 'resize',
      blockIdx,
      direction,
      startX: e.clientX,
      startDuration: block.duration
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
      const updated = blocks.map((b, i) =>
        i === idx ? { ...b, duration: val } : b
      );
      onChange(recalcStartTimes(updated));
    }
    setEditingDurationIdx(null);
  };

  const isDragging = interaction?.type === 'drag';
  const draggedIdx = isDragging ? interaction.blockIdx : null;
  const dragOverIdx = isDragging ? interaction.dropIdx : null;
  const isResizing = interaction?.type === 'resize';

  // Determine cursor based on state
  const getBlockCursor = (idx: number) => {
    if (!editable) return 'default';
    if (isResizing) return 'default';
    if (draggedIdx === idx) return 'grabbing';
    return 'grab';
  };

  return (
    <div
      ref={containerRef}
      className={`activity-timeline flex h-20 flex-col ${!editable ? 'opacity-75' : ''}`}
      style={{ cursor: isDragging && editable ? 'grabbing' : 'default' }}
    >
      <div className="flex h-full">
        {blocksWithImages.map((block, idx) => (
          <React.Fragment key={idx}>
            {editable && dragOverIdx === idx && (
              <div className="w-0 h-12 border-l-2 border-blue-500 mx-0.5 relative z-10 pointer-events-none" />
            )}

            <div
              className={`timeline-block flex flex-col justify-start items-center px-1 py-1 h-full max-h-24 box-border relative select-none
                ${!editable ? 'pointer-events-none' : 'pointer-events-auto'}
                ${draggedIdx === idx ? 'opacity-20 z-20' : 'z-10'}
                ${editable ? 'hover:bg-gray-50 transition-colors' : ''}
              `}
              tabIndex={0}
              data-block-id={idx}
              onMouseDown={(e) => handleBlockMouseDown(idx, e)}
              onClick={() => onBlockSelect?.(block)}
              style={{
                flex: block.duration,
                minWidth: 40,
                cursor: getBlockCursor(idx),
              }}
            >
              {/* Delete button - only show when editable */}
              {editable && (
                <button
                    className="delete-block-btn absolute w-5 h-5 bg-red-500 text-white rounded-full text-sm"
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
                    className="resize-handle left absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-blue-400 hover:opacity-50"
                    onMouseDown={(e) => handleResizeStart(idx, 'left', e)}
                  />
                  <div
                    className="resize-handle right absolute right-0 top-0 h-full w-1 cursor-ew-resize hover:bg-blue-400 hover:opacity-50"
                    onMouseDown={(e) => handleResizeStart(idx, 'right', e)}
                  />
                </>
              )}

              <div className="block-title w-full text-center font-semibold text-sm mb-0.5 text-gray-800">
                {block.title}
              </div>

              <div
                className="block-svg flex-1 w-full flex items-center justify-center min-h-0"
                data-block-id={idx}
                data-block-label={block.label}
              >
                <img
                  src={block.image}
                  alt={block.title}
                  className="w-auto h-full object-contain block"
                  onError={(e) => {
                    e.currentTarget.src = balanceIcon;
                  }}
                />
              </div>
            </div>
          </React.Fragment>
        ))}

        {editable && dragOverIdx === blocks.length && (
          <div className="w-0 h-12 border-l-2 border-blue-500 mx-0.5 relative z-10 pointer-events-none" />
        )}

        {/* Drag preview */}
        {editable && isDragging && interaction && (() => {
          const block = blocks[interaction.blockIdx];
          if (!block) return null;
          return (
            <div
              className="timeline-block fixed w-30 min-w-10 pointer-events-none opacity-85 z-50 bg-blue-100 border-2 border-blue-500 rounded-lg h-12 flex items-center shadow-lg"
              style={{
                left: interaction.currentX + 8,
                top: interaction.currentY + 8,
              }}
            >
              <span className="block-label flex-1 text-center text-blue-800 font-medium">
                {block.title}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Durations row */}
      <div className="activity-timeline-durations flex w-full mt-1 items-start min-h-5">
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className={`text-center text-sm text-blue-800 font-medium select-none relative flex items-center justify-center gap-0.5
              ${editable ? 'cursor-pointer rounded px-1' : 'cursor-default'}
            `}
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
                  className="w-15 text-sm text-center border border-blue-500 rounded outline-none focus:ring-2 focus:ring-blue-300"
                  min={MIN_DURATION}
                  value={durationInputValue}
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) setDurationInputValue(val);
                  }}
                  onBlur={() => handleDurationSave(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDurationSave(idx);
                    } else if (e.key === 'Escape') {
                      setEditingDurationIdx(null);
                    }
                  }}
                />
                <span className="text-sm text-blue-800">s</span>
              </>
            ) : (
              <span className="text-sm text-blue-800">{block.duration} s</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}