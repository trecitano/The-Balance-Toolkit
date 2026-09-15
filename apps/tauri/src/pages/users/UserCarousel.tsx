import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import type { User } from "@/types";
import PersonIcon from "@/assets/user-icon.svg?react";
import CarouselIndicators from "@/components/CarouselIndicators";

export default function UserCarousel({
  users,
  selectedId,
  onSelect,
  disabled,
  editing,
}: {
  users: User[];
  selectedId: number;
  onSelect: (id: number) => void;
  disabled: boolean;
  editing: boolean;
}) {
  const list = useRef<HTMLUListElement>(null);
  const previousSelection = useRef(selectedId);
  const lastWheelNavigation = useRef(0);
  const sorted = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [users],
  );
  const index = sorted.findIndex((user) => user.id === selectedId);
  useLayoutEffect(() => {
    const track = list.current;
    const selected = track?.querySelector<HTMLElement>(`[data-userid="${selectedId}"]`);
    if (track && selected) {
      track.scrollTo({
        left: selected.offsetLeft - (track.clientWidth - selected.offsetWidth) / 2,
        behavior:
          previousSelection.current === selectedId || window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
      });
    }
    previousSelection.current = selectedId;
  }, [selectedId, sorted]);
  useEffect(() => {
    const track = list.current;
    if (!track) return;
    const observer = new ResizeObserver(() => {
      const selected = track.querySelector<HTMLElement>("li:has(button[aria-pressed='true'])");
      if (selected) track.scrollLeft = selected.offsetLeft - (track.clientWidth - selected.offsetWidth) / 2;
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const track = list.current;
    if (!track) return;
    const canNavigate = () =>
      !disabled &&
      !editing &&
      sorted.length > 1 &&
      !document.querySelector("dialog[open]") &&
      !document.activeElement?.closest("input, textarea, select, [contenteditable='true']");
    const navigate = (step: number) => {
      const next = sorted[(index + step + sorted.length) % sorted.length];
      if (next) {
        onSelect(next.id);
        if (track.contains(document.activeElement))
          track.querySelector<HTMLButtonElement>(`[data-userid="${next.id}"] button`)?.focus({ preventScroll: true });
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canNavigate() || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      // Search results and editor controls keep their own keyboard behavior.
      if (document.activeElement?.closest("header, form")) return;
      event.preventDefault();
      navigate(event.key === "ArrowRight" ? 1 : -1);
    };
    const onWheel = (event: WheelEvent) => {
      const delta = event.deltaY || event.deltaX;
      if (!canNavigate() || Math.abs(delta) < 10) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelNavigation.current < 200) return;
      lastWheelNavigation.current = now;
      navigate(delta < 0 ? 1 : -1);
    };
    document.addEventListener("keydown", onKeyDown);
    track.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      track.removeEventListener("wheel", onWheel);
    };
  }, [disabled, editing, index, onSelect, sorted]);
  return (
    <section className="users-list-panel flex min-h-64 min-w-0 flex-1 flex-col justify-center" aria-label="Users">
      <ul ref={list} className="user-carousel-track mask-horizontal-fade">
        {sorted.map((user) => (
          <li key={user.id} data-userid={user.id}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={user.id === selectedId}
              onClick={() => onSelect(user.id)}
              className={clsx(
                "user-carousel-item flex h-full w-full flex-col items-center gap-2 px-4 py-3",
                user.id === selectedId && "selected",
              )}
            >
              <span
                className={clsx(
                  "rounded-lg px-2 py-1 text-xs",
                  user.id === selectedId ? "bg-(--primary) text-white" : "invisible",
                  user.isDefault && "default-user",
                )}
              >
                {user.isDefault ? "Default" : "Selected"}
              </span>
              <span
                className="flex aspect-square h-3/10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: user.color ?? "#999" }}
              >
                <PersonIcon className="h-6/10 w-6/10 text-white" />
              </span>
              <span className="w-full truncate" title={user.name}>
                {user.name}
              </span>
              <span className="mt-auto text-xs text-gray-500">
                Updated
                <br />
                {new Date(user.updatedAt).toLocaleDateString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <CarouselIndicators
        className="mt-5"
        entries={sorted.map((user) => `${user.name} (ID ${user.id})`)}
        selectedIndex={index}
        onSelect={
          disabled
            ? undefined
            : (next) => {
                const user = sorted[next];
                if (user) onSelect(user.id);
              }
        }
      />
    </section>
  );
}
