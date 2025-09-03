import {useEffect, useRef, useState} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBlockImage } from "@/utils/activityImages.ts";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/utils/requests.ts";

const SESSION_ACTIVITY_POP_UP_QUERY_KEY = ["session_activity_pop_up"];

// Utility function to format milliseconds to MM:SS
const formatMs = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

export default function Popup() {
  const queryClient = useQueryClient();
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const [localBlockIndex, setLocalBlockIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY,
    queryFn: async () => {
      const sessionActivityState = await commands.session.getActivityState();
      return { sessionActivityState };
    },
  });

  const sessionActivityState = data?.sessionActivityState;

  // Scroll to current block
  const scrollToBlock = (index: number) => {
    console.log("Scrolling to", index);
    const el = listRef.current?.querySelector(`[data-blockid="${index}"]`);
    console.log("Found element:", el);
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "center",
    });
  };


  // Initialize local state when data changes
  useEffect(() => {
    if (sessionActivityState?.ongoingState) {
      console.log("Initializing local state");
      setLocalTimeLeft(sessionActivityState.ongoingState.timeToNextBlockMs);
      setLocalBlockIndex(sessionActivityState.ongoingState.currentBlockIndex);
    }
  }, [
    sessionActivityState?.ongoingState?.timeToNextBlockMs,
    sessionActivityState?.ongoingState?.currentBlockIndex,
  ]);

  // Countdown timer with local block progression
  useEffect(() => {
    if (localTimeLeft === null || localTimeLeft <= 0) return;

    const interval = setInterval(() => {
      setLocalTimeLeft((prev) => {
        if (prev === null || prev <= 1000) {
          // Time's up - move to next block locally
          const blocks = sessionActivityState?.activity?.timelineBlocks ?? [];
          const currentIndex = localBlockIndex ?? 0;
          const nextIndex = currentIndex + 1;

          if (nextIndex < blocks.length) {
            // Move to next block
            setLocalBlockIndex(nextIndex);
            const nextBlock = blocks[nextIndex];
            // Assuming duration is in milliseconds, adjust if needed
            return nextBlock.duration * 1000;
          } else {
            // Session completed
            return null;
          }
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localTimeLeft, localBlockIndex, sessionActivityState?.activity?.timelineBlocks]);

  // Auto-scroll to current block when it changes
  useEffect(() => {
    if (localBlockIndex !== null && sessionActivityState?.activity?.timelineBlocks) {
      scrollToBlock(localBlockIndex);
    }
  }, [localBlockIndex, sessionActivityState?.activity?.timelineBlocks]);

  useEffect(() => {
    const sessionStartedListener = listen<void>("session_started", (_) => {
      console.log("Session started");
      queryClient.invalidateQueries({queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY});
    });
    const sessionActivityChangedListener = listen<void>("session_activity_changed", (_) => {
      queryClient.invalidateQueries({queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY});
    });
    const sessionCompletedListener = listen<void>("session_completed", (_) => {
      queryClient.invalidateQueries({queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY});
    });

    return () => {
      sessionStartedListener.then((unlisten) => unlisten());
      sessionActivityChangedListener.then((unlisten) => unlisten());
      sessionCompletedListener.then((unlisten) => unlisten());
    };
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!sessionActivityState) {
    return <div>No activity state available</div>;
  }

  const activity = sessionActivityState.activity;
  const blocks = activity?.timelineBlocks ?? [];
  const ongoingState = sessionActivityState.ongoingState;

  if (blocks.length === 0) {
    return <div>No blocks in activity</div>;
  }


  const currentBlockIndex = localBlockIndex ?? ongoingState?.currentBlockIndex ?? 0;
  const timeLeftMs = localTimeLeft ?? ongoingState?.timeToNextBlockMs ?? 0;
  const showCountdown = timeLeftMs <= 3000;

  console.log("Current block index:", currentBlockIndex);

  if (!ongoingState) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4">
        <h3 className="text-lg font-semibold text-center text-red-600">
          Session not started!
        </h3>
        <div className="text-sm text-gray-600">
          Please start the session to view the activity.
        </div>
      </div>
    )
  }

  // Check if session is completed
  if (currentBlockIndex >= blocks.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4">
        <h3 className="text-lg font-semibold text-center text-green-600">
          Session Completed! 🎉
        </h3>
        <div className="text-sm text-gray-600">
          Great job finishing all {blocks.length} blocks!
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-95/100 flex-col bg-(--bg-primary) px-20 py-8">
      {/* Activity Title */}
      <h2 className="text-xl font-bold text-center">{activity.title}</h2>

      {/* Blocks Carousel */}

        <ul
          ref={listRef}
          className="flex flex-1 gap-6 overflow-hidden px-[calc(50%-75px)] py-4"
        >
          {blocks.map((block, index) => {
            const isActive = index === currentBlockIndex;
            const isPast = index < currentBlockIndex;

            return (
              <li
                key={index}
                data-blockid={index}
                className={`h-full justify-center flex flex-col rounded-lg p-3 transition-all duration-500 snap-center`}
              >
                <div className={`mt-top flex  min-h-110 min-w-120 justify-center  ${
                  isActive
                  ? "scale-130 bg-blue-100 opacity-100 shadow-lg ring-1 ring-blue-500"
                  : isPast
                  ? "scale-70 bg-green-100 opacity-60"
                  : "scale-70 bg-gray-100 opacity-50"
                }`}>
                  <img
                    src={getBlockImage(block.id)}
                    alt={block.title}
                    className="rounded-lg mb-2"
                  />
                </div>
                <span className={`text-sm font-medium text-center ${
                  isActive ? "text-blue-900" : isPast ? "text-green-700" : "text-gray-600"
                }`}>
                  {block.title}
                </span>
                {isActive && showCountdown && (
                  <div className="mt-2 rounded bg-red-600/90 px-2 py-1 text-white text-xs font-medium">
                    {formatMs(timeLeftMs)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {blocks.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-colors ${
              index === currentBlockIndex
                ? "bg-blue-500"
                : index < currentBlockIndex
                  ? "bg-green-500"
                  : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}