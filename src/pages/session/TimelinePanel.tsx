import clsx from "clsx";
import ActivityTimeline from "@/pages/activities/ActivityTimeline";
import { ProgressTimer } from "@/pages/session/ProgressTimer";
import { Activity } from "@/types.ts";
import { useRef, useState, useEffect } from "react";

import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import popout from "@/assets/pop-out-icon.svg";

export async function openPopup() {
  new WebviewWindow("session-activity-pop-up", {
    url: "/session-activity-pop-up",
    width: 1000,
    height: 800,
    title: "Activity",
  });
}

// Utility function to format seconds to MM:SS
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

type TimelinePanelProps = {
  activity?: Activity;
  placeholderMessage?: string;
  hasOngoingSession: boolean;
  canStart: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
};

export function TimelinePanel({
  activity,
  placeholderMessage,
  hasOngoingSession,
  canStart,
  onStart,
  onStop,
}: TimelinePanelProps) {
  const timerRef = useRef<ProgressTimer>(new ProgressTimer());
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const timer = timerRef.current;

  const [progressInfo, setProgressInfo] = useState({
    currentLoop: 1,
    totalLoops: 1,
    currentSeconds: 0,
    totalSeconds: 0,
  });

  const singleLoopDuration = activity?.timelineBlocks?.reduce((acc, block) => acc + block.duration, 0) || 0;
  const totalLoops = activity?.loops || 1;

  useEffect(() => {
    timer.registerProgressCallback(setProgressInfo);
    if (playheadRef.current) {
      timer.registerPlayhead(playheadRef.current);
    }
  }, [playheadRef.current]);

  const displayLoop = hasOngoingSession ? progressInfo.currentLoop : 1;
  const displayTotalLoops = hasOngoingSession ? progressInfo.totalLoops : totalLoops;
  const displayCurrentSeconds = hasOngoingSession ? progressInfo.currentSeconds : 0;
  const displayTotalSeconds = hasOngoingSession ? progressInfo.totalSeconds : singleLoopDuration * totalLoops;

  return (
    <div className="relative mt-auto flex min-h-38 w-full items-center justify-between rounded-lg bg-gray-100 shadow-sm">
      <img src={popout} onClick={openPopup} className="absolute top-3 right-3 size-4 object-contain transition-all hover:-translate-y-[1px]" />
      {activity ? (
        <div className="mx-10 mt-2 mb-1 w-9/10">
          <div className="mb-3 flex justify-end text-sm font-medium text-gray-700">
            Loop {displayLoop}/{displayTotalLoops}, {formatTime(displayCurrentSeconds)}/
            {formatTime(displayTotalSeconds)}
          </div>
          <div className={"relative"}>
            <ActivityTimeline blocks={activity.timelineBlocks} height={"h-20"} />
            <div
              ref={playheadRef}
              className={clsx(
                "absolute top-[-14px] z-10 h-[110%] w-[2px] bg-[var(--red)]",
                !hasOngoingSession && "hidden",
              )}
            >
              <div className="absolute left-1/2 h-4 w-5 -translate-x-1/2 bg-[var(--red)] shadow-[var(--shadow-light)] [clip-path:polygon(91.6%_0%,100%_37.5%,50%_100%,0%_37.5%,8.3%_0%)]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-20 w-9/10 flex-1 items-center justify-center">
          <p className="text-xl text-gray-500/80">{placeholderMessage}</p>
        </div>
      )}

      <div>
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
              if (singleLoopDuration) {
                await timer.startTimeline(singleLoopDuration * 1000, totalLoops);
              }
            } else {
              await timer.stopTimeline();
              await onStop();
            }
          }}
          disabled={!canStart}
        >
          <span className={`h-6 w-6 ${hasOngoingSession ? "rounded-sm bg-white" : "rounded-full bg-[#e50012]"}`} />
        </button>
      </div>
    </div>
  );
}