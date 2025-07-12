import React, { useState } from "react";
import "./ActivityTimeline.css";

export interface TimelineBlock {
  id: number;
  label: string;
  start: number;
  duration: number;
}

interface ActivityTimelineProps {
  blocks: TimelineBlock[];
  onChange: (blocks: TimelineBlock[]) => void;
}

const MIN_DURATION = 1;

export default function ActivityTimeline({
  blocks,
  onChange,
}: ActivityTimelineProps) {
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragOverIdxRef = React.useRef<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const dragStartX = React.useRef<number | null>(null);
  const dragStartY = React.useRef<number | null>(null);
  const dragBlockIdx = React.useRef<number | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{
    id: number;
    direction: "left" | "right";
    startX: number;
    startDuration: number;
  } | null>(null);

  const onResizeStart = (
    id: number,
    direction: "left" | "right",
    e: React.MouseEvent,
  ) => {
    setResizeInfo({
      id,
      direction,
      startX: e.clientX,
      startDuration: blocks.find((b) => b.id === id)?.duration || MIN_DURATION,
    });
    e.stopPropagation();
  };
  const onResize = (e: React.MouseEvent) => {
    if (!resizeInfo) return;
    const { id, direction, startX, startDuration } = resizeInfo;
    const delta = e.clientX - startX;
    const scale = 2;
    let newDuration = startDuration;
    if (direction === "right") {
      newDuration = Math.max(
        MIN_DURATION,
        startDuration + Math.round(delta / scale),
      );
    } else {
      newDuration = Math.max(
        MIN_DURATION,
        startDuration - Math.round(delta / scale),
      );
    }
    onChange(
      blocks.map((b) => (b.id === id ? { ...b, duration: newDuration } : b)),
    );
  };
  const onResizeEnd = () => setResizeInfo(null);

  React.useEffect(() => {
    if (!resizeInfo) return;
    const onMouseMove = (e: MouseEvent) => onResize(e as any);
    const onMouseUp = () => onResizeEnd();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizeInfo]);

  const handleBlockMouseDown = (idx: number, e: React.MouseEvent) => {
    if (
      resizeInfo ||
      (e.target as HTMLElement).classList.contains("resize-handle")
    )
      return;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragBlockIdx.current = idx;
    setDraggedId(blocks[idx].id);
    setDragPreview({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleBlockMouseMove);
    window.addEventListener("mouseup", handleBlockMouseUp);
    e.preventDefault();
  };

  const handleBlockMouseMove = (e: MouseEvent) => {
    if (dragBlockIdx.current === null) return;
    setDragPreview({ x: e.clientX, y: e.clientY });

    const timelineRect = (
      document.querySelector(".activity-timeline") as HTMLElement
    )?.getBoundingClientRect();
    if (!timelineRect) return;
    const x = e.clientX - timelineRect.left;
    const timelineBlocks = Array.from(
      document.querySelectorAll(".timeline-block"),
    ) as HTMLElement[];

    const positions: number[] = [0];
    let accWidth = 0;
    for (let i = 0; i < timelineBlocks.length; i++) {
      accWidth += timelineBlocks[i].offsetWidth;
      positions.push(accWidth);
    }

    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < positions.length; i++) {
      const dist = Math.abs(x - positions[i]);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    setDragOverIdx(closestIdx);
    dragOverIdxRef.current = closestIdx;
  };

  const handleBlockMouseUp = (e: MouseEvent) => {
    const currentDragOverIdx = dragOverIdxRef.current;
    if (dragBlockIdx.current === null || currentDragOverIdx === null) {
      cleanupDrag();
      return;
    }
    const from = dragBlockIdx.current;
    let to = currentDragOverIdx;

    if (to !== null && from !== to && from + 1 !== to) {
      const newBlocks = [...blocks];
      const [removed] = newBlocks.splice(from, 1);

      if (from < to) to--;

      newBlocks.splice(to, 0, removed);

      let currentStart = 0;
      const contiguousBlocks = newBlocks.map((b) => {
        const updated = { ...b, start: currentStart };
        currentStart += b.duration;
        return updated;
      });
      onChange(contiguousBlocks);
    }
    cleanupDrag();
  };

  const cleanupDrag = () => {
    setDraggedId(null);
    setDragOverIdx(null);
    dragOverIdxRef.current = null;
    setDragPreview(null);
    dragStartX.current = null;
    dragStartY.current = null;
    dragBlockIdx.current = null;
    window.removeEventListener("mousemove", handleBlockMouseMove);
    window.removeEventListener("mouseup", handleBlockMouseUp);
  };

  return (
    <div
      className="activity-timeline"
      style={{
        display: "flex",
        width: "100%",
        cursor: draggedId !== null ? "grabbing" : "default",
        position: "relative",
      }}
    >
      {blocks.map((block, idx) => (
        <React.Fragment key={block.id}>
          {}
          {draggedId !== null && dragOverIdx === idx && (
            <div
              style={{
                width: 0,
                height: 48,
                borderLeft: "3px solid #6366f1",
                margin: "0 2px",
                position: "relative",
                zIndex: 10,
                background: "none",
                pointerEvents: "none",
              }}
            />
          )}
          <div
            className={`timeline-block${draggedId === block.id ? " dragging" : ""}`}
            tabIndex={0}
            data-block-id={block.id}
            onMouseDown={(e) => handleBlockMouseDown(idx, e)}
            style={{
              flex: block.duration,
              minWidth: 40,
              margin: 0,
              opacity: draggedId === block.id ? 0.2 : 1,
              cursor: resizeInfo
                ? "default"
                : draggedId === block.id
                  ? "grabbing"
                  : "grab",
              userSelect: "none",
              pointerEvents: "auto",
              position: "relative",
              zIndex: draggedId === block.id ? 2 : 1,
            }}
          >
            <div
              className="resize-handle left"
              onMouseDown={(e) => onResizeStart(block.id, "left", e)}
              style={{ cursor: "ew-resize", pointerEvents: "auto" }}
            />
            <span className="block-label">{block.label}</span>
            <div
              className="resize-handle right"
              onMouseDown={(e) => onResizeStart(block.id, "right", e)}
              style={{ cursor: "ew-resize", pointerEvents: "auto" }}
            />
          </div>
        </React.Fragment>
      ))}
      {}
      {draggedId !== null && dragOverIdx === blocks.length && (
        <div
          style={{
            width: 0,
            height: 48,
            borderLeft: "3px solid #6366f1",
            margin: "0 2px",
            position: "relative",
            zIndex: 10,
            background: "none",
            pointerEvents: "none",
          }}
        />
      )}
      {}
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
                background: "#e0e7ff",
                border: "2px solid #6366f1",
                borderRadius: 6,
                height: 48,
                display: "flex",
                alignItems: "center",
                boxShadow: "0 4px 16px rgba(99,102,241,0.15)",
              }}
            >
              <span
                className="block-label"
                style={{
                  flex: 1,
                  textAlign: "center",
                  color: "#3730a3",
                  fontWeight: 500,
                }}
              >
                {block.label}
              </span>
            </div>
          );
        })()}
    </div>
  );
}
