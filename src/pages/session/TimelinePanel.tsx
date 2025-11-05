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
  playButtonClass: string;
  placeholderMessage?: string;
  hasOngoingSession: boolean;
  canStart: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
};

export function TimelinePanel({
  activity,
  playButtonClass,
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
    <div className="min-h-29 w-full items-center rounded-lg bg-gray-100 shadow-sm">
      {activity ? (
        <div className="flex mx-3 mt-3 mb-1 text-xs gap-2 ">
          <div className={"grow"}>
            <ActivityTimeline blocks={activity.timelineBlocks} height={"h-20"} />
          </div>
          <div
            ref={playheadRef}
            className={clsx(
              "absolute top-[-14px] z-10 h-[110%] w-[2px] bg-[var(--red)]",
              !hasOngoingSession && "hidden",
            )}
          >
            <div className="absolute left-1/2 h-4 w-5 -translate-x-1/2 bg-[var(--red)] shadow-[var(--shadow-light)] [clip-path:polygon(91.6%_0%,100%_37.5%,50%_100%,0%_37.5%,8.3%_0%)]" />
          </div>
          <div className={"font-medium text-gray-700"}>
            <img src={popout}
                 onClick={activity ? openPopup : undefined}
                 className={clsx(
                   "size-5 object-contain transition-all ml-auto mb-3",
                   activity ? "hover:-translate-y-[1px] cursor-pointer" : "opacity-40 pointer-events-none cursor-not-allowed"
                 )}/>
            <p> Loop {displayLoop}/{displayTotalLoops} </p>
            <p> {formatTime(displayCurrentSeconds)}/{formatTime(displayTotalSeconds)} </p>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-xl text-gray-500/80">{placeholderMessage}</p>
        </div>
      )}
    </div>
  );
}