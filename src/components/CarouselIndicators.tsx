import React from "react";

type Props = {
  entries: string[];
  currentIndex: number;
  selectedEntry: string;
  onSelect: (userName: string) => void | Promise<void>;
  nearbyThreshold?: number;
};

const CarouselIndicators: React.FC<Props> = React.memo(
  ({ entries, currentIndex, selectedEntry, onSelect, nearbyThreshold = 2 }) => {
    return (
      <div className="mt-[1.5vh] flex w-full list-none justify-center gap-[10px] p-0" role="list">
        {entries.map((entry, index) => {
          const distance = Math.abs(index - currentIndex);
          let dotClass = "w-[12px] h-[12px] rounded-full bg-[var(--border)] opacity-50 transition cursor-pointer";

          if (entry === selectedEntry) {
            dotClass += " bg-[var(--primary)] opacity-100 scale-125";
          } else if (distance <= nearbyThreshold) {
            dotClass += " bg-[var(--secondary-dark)] opacity-80";
          }

          return (
            <div
              key={entry}
              className={dotClass}
              onClick={() => onSelect(entry)}
              title={entry}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(entry);
                }
              }}
            />
          );
        })}
      </div>
    );
  },
);

export default CarouselIndicators;
