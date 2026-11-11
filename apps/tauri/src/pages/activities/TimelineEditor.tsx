import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icons.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { TimelineBlock } from "@/types.ts";
import { getBlockImage, showLogoInstead } from "@/utils/activityImages.ts";
import { isValidDuration, MIN_DURATION, roundSeconds } from "@/utils/timeline.ts";

/** How far a press on a block must travel before it becomes a drag, so a click stays a click. */
const DRAG_THRESHOLD_PX = 5;
/** How long the notice offering Undo stays up after an action is removed. */
const UNDO_MS = 6000;

type Drag = {
  from: number;
  block: TimelineBlock;
  /** Where each gap is on screen, 0 being before the first block. Blocks keep their places
   *  during a drag, so they are measured once, when it starts. */
  gapXs: number[];
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** False until the pointer has passed DRAG_THRESHOLD_PX. */
  moving: boolean;
  /** The gap the block would be dropped into, 0 being before the first block. Null where the
   *  block would stay where it is. */
  gap: number | null;
};

type Resize = {
  index: number;
  startX: number;
  startDuration: number;
  /** Every block's width when the resize began, and the seconds each pixel stood for. */
  widths: number[];
  pxPerSecond: number;
  /** The width the blocks up to and including this one can take before its edge leaves the bar. */
  room: number;
  x: number;
  y: number;
};

type Removal = { before: TimelineBlock[]; after: TimelineBlock[]; title: string };

type EditResult = { seconds: number | null; returnFocus: boolean };

/** `blocks` with the one at `from` moved to index `to`. */
function moveBlock(blocks: TimelineBlock[], from: number, to: number) {
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  if (block) next.splice(to, 0, block);
  return next;
}

/** The gap nearest `x`, or null for the gaps either side of the dragged block, where it would stay. */
function nearestGap(x: number, { gapXs, from }: Drag) {
  const distances = gapXs.map((gapX) => Math.abs(x - gapX));
  const nearest = distances.indexOf(Math.min(...distances));
  return nearest === from || nearest === from + 1 ? null : nearest;
}

/**
 * The blocks' widths while one is resized. The bar keeps its scale, so the dragged edge stays under
 * the pointer and the blocks after it run off the end; only when the resized block itself would
 * run off does everything shrink to keep its edge in view. The bar fits itself again on release.
 */
function resizeWidths({ index, widths, startDuration, pxPerSecond, room }: Resize, seconds: number) {
  const next = widths.map((width, i) => (i === index ? width + (seconds - startDuration) * pxPerSecond : width));
  const throughResized = next.slice(0, index + 1).reduce((sum, width) => sum + width, 0);
  const scale = Math.min(1, room / throughResized);
  return next.map((width) => width * scale);
}

/**
 * The activity's actions as a bar that can be rearranged: drag a block to move it, drag its right
 * edge or type in its duration to retime it, and add or remove actions. Every change also has a
 * key, for the block that has the focus.
 */
export default function TimelineEditor({
  blocks,
  onChange,
  insertAt,
  onInsert,
}: {
  blocks: TimelineBlock[];
  onChange: (blocks: TimelineBlock[]) => void;
  /** While an action is being added, the gap it will go into; it is marked on the bar. */
  insertAt: number | null;
  onInsert: (gap: number) => void;
}) {
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [resize, setResize] = useState<Resize | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const hintId = useId();

  // Blocks are keyed by position, so after a move or a removal the focus is put on the block's
  // new place by hand.
  const focusAfterChange = useRef<number | null>(null);
  useEffect(() => {
    if (focusAfterChange.current === null) return;
    blockRefs.current[focusAfterChange.current]?.focus();
    focusAfterChange.current = null;
  }, [blocks]);

  // Undo is offered for a while after a removal, and only until anything else changes.
  const undoable = removal?.after === blocks ? removal : null;
  useEffect(() => {
    if (!removal) return;
    const timer = window.setTimeout(() => setRemoval(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [removal]);

  const change = (next: TimelineBlock[], focusIndex?: number) => {
    focusAfterChange.current = focusIndex ?? null;
    onChange(next);
  };
  const setDuration = (index: number, seconds: number) =>
    change(blocks.map((block, i) => (i === index ? { ...block, duration: Math.max(MIN_DURATION, seconds) } : block)));
  const remove = (index: number, focusIndex?: number) => {
    const block = blocks[index];
    if (!block) return;
    const next = blocks.filter((_, i) => i !== index);
    setRemoval({ before: blocks, after: next, title: block.title });
    change(next, focusIndex);
  };
  const undo = () => {
    if (undoable) change(undoable.before);
    setRemoval(null);
  };
  const finishEditing = (index: number, { seconds, returnFocus }: EditResult) => {
    setEditing(null);
    if (seconds !== null) setDuration(index, seconds);
    if (returnFocus) blockRefs.current[index]?.focus();
  };
  const measureBlocks = () => blocks.map((_, i) => blockRefs.current[i]?.getBoundingClientRect() ?? new DOMRect());

  const onBlockKeyDown = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
    const block = blocks[index];
    if (!block || event.target !== event.currentTarget) return;
    // While a block is dragged or resized the keys wait, except Escape, which drops a drag.
    if (drag || resize) {
      if (event.key === "Escape") setDrag(null);
      return;
    }
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        const neighbour = event.key === "ArrowLeft" ? index - 1 : index + 1;
        if (neighbour < 0 || neighbour >= blocks.length) break;
        if (event.shiftKey) change(moveBlock(blocks, index, neighbour), neighbour);
        else blockRefs.current[neighbour]?.focus();
        break;
      }
      case "Home":
        blockRefs.current[0]?.focus();
        break;
      case "End":
        blockRefs.current[blocks.length - 1]?.focus();
        break;
      case "+":
      case "=":
      case "ArrowUp":
        setDuration(index, block.duration + 1);
        break;
      case "-":
      case "ArrowDown":
        setDuration(index, block.duration - 1);
        break;
      case "Enter":
        setEditing(index);
        break;
      case "Delete":
      case "Backspace":
        remove(index, Math.min(index, blocks.length - 2));
        break;
      case "z":
        if (!(event.ctrlKey || event.metaKey)) return;
        undo();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onBlockPointerDown = (index: number, event: PointerEvent<HTMLDivElement>) => {
    const block = blocks[index];
    if (event.button !== 0 || !block) return;
    // No text selection or dragging of the picture; the press still selects the block.
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    // Before the first block, midway between each pair, and after the last.
    const rects = measureBlocks();
    const gapXs = [
      rects[0]?.left ?? 0,
      ...rects.slice(1).map((rect, i) => ((rects[i]?.right ?? 0) + rect.left) / 2),
      rects[rects.length - 1]?.right ?? 0,
    ];
    const { clientX: x, clientY: y } = event;
    setDrag({ from: index, block, gapXs, startX: x, startY: y, x, y, moving: false, gap: null });
  };
  const onBlockPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const { clientX: x, clientY: y } = event;
    const moving = drag.moving || Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD_PX;
    setDrag({ ...drag, x, y, moving, gap: moving ? nearestGap(x, drag) : null });
  };
  const onBlockPointerUp = () => {
    if (drag?.moving && drag.gap !== null) {
      const to = drag.gap > drag.from ? drag.gap - 1 : drag.gap;
      change(moveBlock(blocks, drag.from, to), to);
    }
    setDrag(null);
  };

  const onGripPointerDown = (index: number, event: PointerEvent<HTMLDivElement>) => {
    const block = blocks[index];
    if (event.button !== 0 || !block) return;
    event.preventDefault();
    event.stopPropagation(); // A resize, not a drag of the block.
    blockRefs.current[index]?.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rects = measureBlocks();
    const widths = rects.map((rect) => rect.width);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    // The bar's whole width, less the gaps up to the resized block's edge.
    const barWidth = (rects[rects.length - 1]?.right ?? 0) - (rects[0]?.left ?? 0);
    const gapWidth = (barWidth - totalWidth) / Math.max(1, blocks.length - 1);
    const { clientX: x, clientY: y } = event;
    setResize({
      index,
      startX: x,
      startDuration: block.duration,
      widths,
      pxPerSecond: totalWidth / roundSeconds(blocks),
      room: barWidth - index * gapWidth,
      x,
      y,
    });
  };
  const onGripPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!resize) return;
    const { clientX: x, clientY: y } = event;
    const seconds = Math.max(MIN_DURATION, resize.startDuration + Math.round((x - resize.startX) / resize.pxPerSecond));
    setResize({ ...resize, x, y });
    if (seconds !== blocks[resize.index]?.duration) setDuration(resize.index, seconds);
  };

  // Each block's share of the bar is its share of the time, except during a resize.
  const resizingWidths = resize ? resizeWidths(resize, blocks[resize.index]?.duration ?? 0) : null;
  const columnStyle = (index: number, block: TimelineBlock): CSSProperties =>
    resizingWidths ? { flex: `0 0 ${resizingWidths[index] ?? 0}px` } : { flex: block.duration };

  const dragging = drag?.moving ? drag : null;
  const gesture = dragging !== null || resize !== null;
  const markedGap = dragging ? dragging.gap : insertAt;
  const tabStop = Math.min(selected, blocks.length - 1);

  return (
    <div className="group/editor relative flex min-h-0 flex-1 flex-col gap-1">
      {blocks.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-(--border) text-gray-500">
          This activity has no actions yet.
          <ToolkitButton type="button" color="blue" onClick={() => onInsert(0)}>
            + Add Action
          </ToolkitButton>
        </div>
      ) : (
        // During a resize the blocks after the edge may run off the end, so the row clips them. Its
        // padding, cancelled by the negative margin, keeps the end blocks' rings and grips inside.
        <div className={clsx("-mx-2 flex min-h-0 flex-1 gap-2 px-2", resize && "overflow-x-clip")}>
          {blocks.map((block, index) => (
            <div key={index} className="relative flex min-w-12 flex-col" style={columnStyle(index, block)}>
              <div
                ref={(element) => {
                  blockRefs.current[index] = element;
                }}
                role="button"
                tabIndex={index === tabStop ? 0 : -1}
                aria-label={`${block.title}, ${block.duration} seconds, action ${index + 1} of ${blocks.length}`}
                aria-describedby={hintId}
                onFocus={() => setSelected(index)}
                onKeyDown={(event) => onBlockKeyDown(index, event)}
                onPointerDown={(event) => onBlockPointerDown(index, event)}
                onPointerMove={onBlockPointerMove}
                onPointerUp={onBlockPointerUp}
                // The capture ends with the press, released or cancelled, and so does the drag.
                onLostPointerCapture={() => setDrag(null)}
                onDoubleClick={() => setEditing(index)}
                className={clsx(
                  "group @container relative flex min-h-0 flex-1 touch-none flex-col rounded-md border-2 border-(--primary) bg-(--primary-light) outline-none select-none",
                  "transition-shadow hover:shadow-(--shadow-medium) focus:ring-2 focus:ring-(--primary) focus:ring-offset-2",
                  dragging?.from === index ? "cursor-grabbing border-dashed opacity-40" : "cursor-grab",
                )}
              >
                {/* The title fills the space above the picture, wrapping onto more lines and in
                    smaller type as the block narrows, so it stays readable. Its top padding keeps
                    it clear of the remove button. */}
                <span className="flex min-h-0 flex-1 items-center justify-center px-1 pt-7 pb-1">
                  <span className="line-clamp-4 text-center text-[0.6875rem] font-semibold text-balance wrap-anywhere text-gray-800 @[4rem]:text-xs @[6rem]:text-sm @[9rem]:text-base">
                    {block.title}
                  </span>
                </span>
                <img
                  src={getBlockImage(block.id)}
                  onError={showLogoInstead}
                  alt=""
                  draggable={false}
                  className="mt-auto h-7/10 w-full object-contain"
                />

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remove ${block.title}`}
                  title="Remove"
                  // A click here removes the block; it neither drags it nor takes the focus.
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => remove(index)}
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full text-gray-500 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--red) hover:text-white"
                >
                  <Icon name="close" className="size-4" />
                </button>

                {/* The grip straddles the block's right edge and the gap after it. */}
                <div
                  aria-hidden="true"
                  title="Drag to change the duration"
                  onPointerDown={(event) => onGripPointerDown(index, event)}
                  onPointerMove={onGripPointerMove}
                  onLostPointerCapture={() => setResize(null)}
                  className="absolute inset-y-0 -right-2 z-10 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                >
                  <span
                    className={clsx(
                      "h-10 w-1 rounded-full bg-(--primary) transition-opacity",
                      resize?.index === index ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                  />
                </div>

                {markedGap === index && <GapMarker side="left" />}
                {markedGap === blocks.length && index === blocks.length - 1 && <GapMarker side="right" />}
              </div>

              <div className="relative flex h-8 items-center justify-center">
                {editing === index ? (
                  <DurationInput seconds={block.duration} onDone={(result) => finishEditing(index, result)} />
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Change the duration of ${block.title}`}
                    onClick={() => setEditing(index)}
                    className={clsx(
                      "group/pill flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums",
                      resize?.index === index
                        ? "bg-(--primary) text-white"
                        : "text-(--primary-dark) hover:bg-(--primary-light)",
                    )}
                  >
                    {block.duration} s
                    <Icon name="pencil" className="size-3 opacity-50 group-hover/pill:opacity-100" />
                  </button>
                )}
                {!gesture && index === 0 && <InsertButton side="left" onClick={() => onInsert(0)} />}
                {!gesture && <InsertButton side="right" onClick={() => onInsert(index + 1)} />}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-gray-500">
        <p>Drag an action to move it, or drag its right edge to change how long it lasts.</p>
        <p
          id={hintId}
          className="flex flex-wrap items-center gap-x-4 opacity-0 transition-opacity group-focus-within/editor:opacity-100"
        >
          <span>
            <Key>←</Key> <Key>→</Key> choose
          </span>
          <span>
            <Key>Shift</Key> + <Key>←</Key> <Key>→</Key> move
          </span>
          <span>
            <Key>+</Key> <Key>−</Key> change by a second
          </span>
          <span>
            <Key>Enter</Key> type a duration
          </span>
          <span>
            <Key>Delete</Key> remove
          </span>
        </p>
      </div>

      {undoable && (
        <div
          role="status"
          className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-gray-800 py-1.5 pr-1.5 pl-4 text-sm whitespace-nowrap text-white shadow-(--shadow-medium)"
        >
          Removed “{undoable.title}”
          <button
            type="button"
            onClick={undo}
            className="rounded-md px-2 py-1 font-semibold text-(--primary-light) hover:bg-white/15"
          >
            Undo
          </button>
        </div>
      )}

      {/* While a gesture lasts its cursor holds over the whole window, and nothing else reacts to
          the pointer passing over it. */}
      {gesture && <div className={clsx("fixed inset-0 z-40", resize ? "cursor-ew-resize" : "cursor-grabbing")} />}
      {dragging && <DragPreview block={dragging.block} x={dragging.x} y={dragging.y} />}
      {resize && (
        <span
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-gray-800 px-2 py-1 text-xs font-semibold text-white tabular-nums shadow-(--shadow-medium)"
          style={{ left: resize.x, top: resize.y - 12 }}
        >
          {blocks[resize.index]?.duration} s
        </span>
      )}
    </div>
  );
}

/** The line marking the gap a block will go into: before this block, or after the last one. */
function GapMarker({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "pointer-events-none absolute -inset-y-1 z-20 w-1 rounded-full bg-(--primary)",
        side === "left" ? "-left-2" : "-right-2",
      )}
    />
  );
}

/** A small round "+" in the gap beside a block's duration, shown while the pointer is on the bar. */
function InsertButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Add an action here"
      title="Add an action here"
      onClick={onClick}
      className={clsx(
        "absolute top-1/2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 opacity-0 transition group-hover/editor:opacity-100",
        "hover:border-(--primary) hover:bg-(--primary) hover:text-white",
        side === "left" ? "-left-3.5" : "-right-3.5",
      )}
    >
      <Icon name="plus" className="size-3.5" />
    </button>
  );
}

/** What follows the pointer while a block is dragged: its picture and title. */
function DragPreview({ block, x, y }: { block: TimelineBlock; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none fixed z-50 flex w-36 -translate-x-1/2 translate-y-3 rotate-2 flex-col items-center gap-1 rounded-md border-2 border-(--primary) bg-(--primary-light) p-2 shadow-(--shadow-medium)"
      style={{ left: x, top: y }}
    >
      <img src={getBlockImage(block.id)} onError={showLogoInstead} alt="" className="h-20 w-full object-contain" />
      <span className="w-full truncate text-center text-sm font-semibold text-gray-800">{block.title}</span>
    </div>
  );
}

/** A block's duration being typed. Enter or clicking away keeps it; Escape leaves it as it was. */
function DurationInput({ seconds, onDone }: { seconds: number; onDone: (result: EditResult) => void }) {
  const [draft, setDraft] = useState(String(seconds));
  // Returning the focus to the block blurs the field; that blur must not finish it a second time.
  const finished = useRef(false);
  const finish = (result: EditResult) => {
    if (finished.current) return;
    finished.current = true;
    onDone(result);
  };
  const typed = () => (isValidDuration(Number(draft)) ? Number(draft) : null);
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-(--primary-dark)">
      <input
        type="number"
        min={MIN_DURATION}
        step={1}
        autoFocus
        aria-label="Duration in seconds"
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finish({ seconds: typed(), returnFocus: false })}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish({ seconds: typed(), returnFocus: true });
          if (event.key === "Escape") finish({ seconds: null, returnFocus: true });
        }}
        className="h-6 w-14 rounded-md border border-(--primary) bg-white text-center text-sm outline-none focus:ring-2 focus:ring-(--primary-light)"
      />
      s
    </span>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-gray-300 bg-white px-1 font-sans text-[0.7rem] text-gray-600">{children}</kbd>
  );
}
