import clsx from "clsx";
import ActivityTimeline from "@/pages/activities/ActivityTimeline";
import { ProgressTimer } from "@/pages/session/ProgressTimer";
import { Activity } from "@/types.ts";
import { useState, useEffect, useCallback } from "react";

import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { QueryStatus } from "@/components/QueryStatus";
import { useAction } from "@/hooks/useAction";
import popout from "@/assets/pop-out-icon.svg";

const POPUP_LABEL = "session-activity-pop-up";
const POPUP_TIMEOUT_MS = 10_000;

/**
 * Opens the activity pop-out, or focuses it if it is already open. The window constructor
 * never rejects: creation failures arrive on the `tauri://error` event, so wait for one of
 * the two outcomes explicitly.
 */
export async function openPopup() {
  const existing = await WebviewWindow.getByLabel(POPUP_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  const popup = new WebviewWindow(POPUP_LABEL, {
    url: "/session-activity-pop-up",
    width: 1000,
    height: 800,
    title: "Activity",
  });
  let settle: (error?: Error) => void = () => {};
  const created = popup.once("tauri://created", () => settle());
  const failed = popup.once("tauri://error", (event) => settle(new Error(String(event.payload))));
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out opening the activity window")), POPUP_TIMEOUT_MS);
      settle = (error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };
    });
  } finally {
    // Whichever outcome did not fire still holds a listener; drop both.
    for (const unlisten of await Promise.allSettled([created, failed])) {
      if (unlisten.status === "fulfilled") unlisten.value();
    }
  }
}

// Utility function to format seconds to MM:SS
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

type TimelinePanelProps = {
  activity?: Activity | null;
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
  const [timer] = useState(() => new ProgressTimer());
  const action = useAction();
  const registerPlayhead = useCallback((element: HTMLDivElement | null) => timer.registerPlayhead(element), [timer]);
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
    return () => timer.dispose();
  }, [timer]);
  useEffect(() => {
    if (hasOngoingSession) timer.startTimeline(singleLoopDuration * 1000, totalLoops);
    else timer.stopTimeline();
    return () => timer.stopTimeline();
  }, [timer, hasOngoingSession, singleLoopDuration, totalLoops]);
  // A failed Start or Stop should not outlive the state it complained about.
  const resetAction = action.reset;
  useEffect(() => resetAction(), [resetAction, hasOngoingSession]);

  const displayLoop = hasOngoingSession ? progressInfo.currentLoop : 1;
  const displayTotalLoops = hasOngoingSession ? progressInfo.totalLoops : totalLoops;
  const displayCurrentSeconds = hasOngoingSession ? progressInfo.currentSeconds : 0;
  const displayTotalSeconds = hasOngoingSession ? progressInfo.totalSeconds : singleLoopDuration * totalLoops;

  return (
    <div className="relative flex min-h-29 w-full items-center gap-3 rounded-lg bg-gray-100 px-2 text-xs shadow-sm">
      <QueryStatus error={action.error} />
      <div className="flex flex-col items-center gap-2">
        <button
          className={clsx(
            "ml-3 flex size-12 cursor-pointer items-center justify-center rounded-full transition-all duration-100",
            hasOngoingSession
              ? "border-2 border-[#e50012] bg-[#e50012] text-white"
              : "border-2 border-[#e50012] bg-white text-black",
            "disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-50",
          )}
          type="button"
          aria-label={hasOngoingSession ? "Stop" : "Start"}
          onClick={() => action.run(hasOngoingSession ? onStop : onStart)}
          disabled={action.isPending || (!hasOngoingSession && !canStart)}
        >
          {hasOngoingSession ? (
            // Stop icon (square)
            <span className="size-5 rounded bg-white" />
          ) : (
            // Play icon (triangle). Using border trick for a crisp triangle.
            <span className={playButtonClass} />
          )}
        </button>
        {activity && (
          <div className="flex flex-col items-center font-medium text-gray-700">
            <p>
              Loop {displayLoop}/{displayTotalLoops}
            </p>
            <p>
              {formatTime(displayCurrentSeconds)}/{formatTime(displayTotalSeconds)}
            </p>
          </div>
        )}
      </div>
      {activity ? (
        <div className="mt-3 flex w-full gap-2">
          <div className="flex h-25 grow">
            <ActivityTimeline blocks={activity.timelineBlocks} />
          </div>
          <div
            ref={registerPlayhead}
            className={clsx("absolute top-[-14px] z-10 h-[110%] w-[2px] bg-(--red)", !hasOngoingSession && "hidden")}
          >
            <div className="absolute left-1/2 h-4 w-5 -translate-x-1/2 bg-(--red) shadow-(--shadow-light) [clip-path:polygon(91.6%_0%,100%_37.5%,50%_100%,0%_37.5%,8.3%_0%)]" />
          </div>
          <button
            type="button"
            aria-label="Open activity in a separate window"
            className="mb-3 ml-auto size-5"
            onClick={() => action.run(openPopup)}
          >
            <img src={popout} alt="" />
          </button>
        </div>
      ) : (
        <div className="pointer-events-none absolute w-full justify-center text-center">
          <p className="text-xl text-gray-500/80">{placeholderMessage}</p>
        </div>
      )}
    </div>
  );
}
