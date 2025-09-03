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
    <div className={clsx("flex w-full list-none justify-center gap-3", className)} role="list">
      {entries.map((entry, index) => {
        const distance = Math.abs(index - selectedIndex);

        let dotClass = `w-[12px] h-[12px] rounded-full bg-[var(--border)] opacity-50 transition ${onSelect && "cursor-pointer"}`;

        if (index === selectedIndex) {
          dotClass += " bg-[var(--primary)] opacity-100 scale-125";
        } else if (distance <= nearbyThreshold) {
          dotClass += " bg-[var(--secondary-dark)] opacity-80";
        }

        return (
          <div
            key={entry}
            className={dotClass}
            onClick={() => onSelect?.(index)}
            title={entry}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (onSelect && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelect(index);
              }
            }}
          />
        );
      })}
    </div>
  );
}
