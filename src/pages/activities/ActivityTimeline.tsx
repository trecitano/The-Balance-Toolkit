

import React, { useState, useRef, useEffect } from "react";
import "./ActivityTimeline.css";
import balanceIcon from "../../assets/balance-icon.svg";

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

export default function ActivityTimeline({ blocks, onChange }: ActivityTimelineProps) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{
    id: number;
    direction: "left" | "right";
    startX: number;
    startDuration: number;
  } | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);
  const dragBlockIdx = useRef<number | null>(null);

  // --- Resize Handlers ---
  const onResizeStart = (id: number, direction: "left" | "right", e: React.MouseEvent) => {
    setResizeInfo({
      id,
      direction,
      startX: e.clientX,
      startDuration: blocks.find((b) => b.id === id)?.duration || MIN_DURATION,
    });
    e.stopPropagation();
  };
  const onResize = (e: MouseEvent) => {
    if (!resizeInfo) return;
    const { id, direction, startX, startDuration } = resizeInfo;
    const delta = e.clientX - startX;
    const scale = 2;
    let newDuration = startDuration;
    if (direction === "right") {
      newDuration = Math.max(MIN_DURATION, startDuration + Math.round(delta / scale));
    } else {
      newDuration = Math.max(MIN_DURATION, startDuration - Math.round(delta / scale));
    }
    onChange(
      blocks.map((b) => (b.id === id ? { ...b, duration: newDuration } : b))
    );
  };
  const onResizeEnd = () => setResizeInfo(null);

  useEffect(() => {
    if (!resizeInfo) return;
    const onMouseMove = (e: MouseEvent) => onResize(e);
    const onMouseUp = () => onResizeEnd();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizeInfo]);

  // --- Drag Handlers ---
  const handleBlockMouseDown = (idx: number, e: React.MouseEvent) => {
    if (resizeInfo || (e.target as HTMLElement).classList.contains("resize-handle")) return;
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
    const timelineRect = (document.querySelector(".activity-timeline") as HTMLElement)?.getBoundingClientRect();
    if (!timelineRect) return;
    const x = e.clientX - timelineRect.left;
    const timelineBlocks = Array.from(document.querySelectorAll(".timeline-block")) as HTMLElement[];
    let positions: number[] = [0];
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

  const handleBlockMouseUp = () => {
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
    dragBlockIdx.current = null;
    window.removeEventListener("mousemove", handleBlockMouseMove);
    window.removeEventListener("mouseup", handleBlockMouseUp);
  };

  return (
    <div
      className="activity-timeline"
      style={{ width: "100%", cursor: draggedId !== null ? "grabbing" : "default", position: "relative" }}
    >
      {blocks.map((block, idx) => (
        <React.Fragment key={block.id}>
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
          <div
            className="timeline-block"
            tabIndex={0}
            data-block-id={block.id}
            onMouseDown={(e) => handleBlockMouseDown(idx, e)}
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
              {block.label}
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
            >
              <img
                src={balanceIcon}
                alt="icon"
                style={{
                  width: "auto",
                  height: "60%",
                  maxHeight: "60%",
                  maxWidth: "80%",
                  objectFit: "contain",
                  display: "block",
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
      {draggedId !== null && dragPreview && (() => {
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
              {block.label}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
