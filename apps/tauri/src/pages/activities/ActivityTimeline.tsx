import { TimelineBlock } from "@/types.ts";
import { getBlockImage, showLogoInstead } from "@/utils/activityImages.ts";

/**
 * An activity's actions as one bar, each as wide as its share of the time, with its duration
 * underneath. Read-only: the Activities page edits the bar with TimelineEditor.
 */
export default function ActivityTimeline({ blocks }: { blocks: TimelineBlock[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col opacity-75">
      <div className="flex min-h-0 flex-1">
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className="rounded-md border-2 border-(--primary) bg-(--primary-light) select-none"
            style={{ flex: block.duration }}
          >
            {/* The timeline is short, so the picture sits beside the title rather than under it,
                the two centred together in the block. */}
            <div className="flex h-full min-w-0 items-center justify-center gap-1.5 px-1">
              <img
                src={getBlockImage(block.id)}
                onError={showLogoInstead}
                alt=""
                className="h-4/5 w-auto max-w-10 shrink-0 object-contain"
              />
              <span className="min-w-0 truncate font-semibold text-gray-800">{block.title}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Durations row. TimelinePanel pads above the blocks by this row's height (mt-1 + min-h-5,
          its pt-6) to centre them on the Session page; keep the two in step. */}
      <div className="mt-1 flex min-h-5 w-full items-start">
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className="text-center text-xs font-medium text-(--primary-dark) select-none"
            style={{ flex: block.duration, minWidth: 40 }}
          >
            {block.duration} s
          </div>
        ))}
      </div>
    </div>
  );
}
