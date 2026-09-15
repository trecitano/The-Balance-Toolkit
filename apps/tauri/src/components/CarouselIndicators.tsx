import clsx from "clsx";

type Props = {
  entries: string[];
  selectedIndex: number;
  onSelect?: (index: number) => void | Promise<void>;
  nearbyThreshold?: number;
  className?: string;
};

export default function CarouselIndicators({
  entries,
  selectedIndex,
  onSelect,
  nearbyThreshold = 2,
  className,
}: Props) {
  return (
    <div className={clsx("flex w-full justify-center gap-3", className)} role="group" aria-label="Choose an item">
      {entries.map((entry, index) => {
        const distance = Math.abs(index - selectedIndex);
        const selected = index === selectedIndex;
        return (
          <button
            type="button"
            key={entry}
            className={clsx(
              "size-3 rounded-full bg-(--border) opacity-50 transition",
              onSelect && "cursor-pointer",
              selected && "scale-125 bg-(--primary) opacity-100",
              !selected && distance <= nearbyThreshold && "bg-(--secondary-dark) opacity-80",
            )}
            onClick={() => onSelect?.(index)}
            title={entry}
            aria-label={entry}
            aria-pressed={selected}
            disabled={!onSelect}
          />
        );
      })}
    </div>
  );
}
