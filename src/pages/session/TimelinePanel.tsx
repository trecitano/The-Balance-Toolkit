// TimelinePanel.tsx
import clsx from "clsx";
import ActivityTimeline from "@/pages/activities/ActivityTimeline";
import { createProgressTimer } from "@/pages/session/ProgressTimer";
import { Activity } from "@/types.ts";
import { useRef } from "react";

type TimelinePanelProps = {
  activity?: Activity;
  placeholderMessage?: string;
  hasOngoingSession: boolean;
  canStart: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
};

export function TimelinePanel({ activity, placeholderMessage, hasOngoingSession, canStart, onStart, onStop }: TimelinePanelProps) {
  const timerRef = useRef(createProgressTimer());
  const timer = timerRef.current;
  const activityDuration = activity?.timelineBlocks?.reduce((acc, block) => acc + block.duration, 0);

  return (
    <div className="mt-auto min-h-33 flex w-full items-center justify-between rounded-lg bg-gray-100 shadow-sm">
      {activity ? (
        <div className="relative mx-10 mt-5 mb-1 w-9/10">
          <ActivityTimeline activityId={activity.id} blocks={activity.timelineBlocks} height={"h-20"} />
          <div
            ref={(el) => {
              if (el) {
                el.style.transform = "translateX(0px)";
                timer.registerPlayhead(el);
              }
            }}
            className={clsx(
              "absolute top-0 bottom-0 z-10 h-full w-[2px] bg-[var(--red)]",
              !hasOngoingSession && "hidden",
            )}
          >
            <div className="absolute left-1/2 h-4 w-5 -translate-x-1/2 bg-[var(--red)] shadow-[var(--shadow-light)] [clip-path:polygon(91.6%_0%,100%_37.5%,50%_100%,0%_37.5%,8.3%_0%)]" />
          </div>
        </div>
      ) : (
        <div className="h-20 w-9/10 items-center flex-1 flex justify-center">
          <p className="text-xl text-gray-500/80">{placeholderMessage}</p>
        </div>
      )}

      <button
        className={clsx(
          "mr-2 flex h-12 min-h-[48px] w-12 min-w-[48px] cursor-pointer items-center justify-center rounded-full p-0 transition-all",
          hasOngoingSession
            ? "border-2 border-[#e50012] bg-[#e50012] text-white"
            : "border-2 border-[#e50012] bg-white text-black",
          "disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-50",
        )}
        onClick={async () => {
          if (!hasOngoingSession) {
            await onStart();
            if (activityDuration) await timer.startTimeline(activityDuration * 1000);
          } else {
            await onStop();
            await timer.stopTimeline();
          }
        }}
        disabled={!canStart}
      >
        <span className={`h-6 w-6 ${hasOngoingSession ? "rounded-sm bg-white" : "rounded-full bg-[#e50012]"}`} />
      </button>
    </div>
  );
}
