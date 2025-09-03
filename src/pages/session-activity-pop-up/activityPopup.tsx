import { useEffect, useState } from "react";
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

  const { data, isLoading, error } = useQuery({
    queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY,
    queryFn: async () => {
      const sessionActivityState = await commands.session.getActivityState();
      return { sessionActivityState };
    },
  });

  const sessionActivityState = data?.sessionActivityState;


  // Initialize local state when data changes
  useEffect(() => {
    if (sessionActivityState?.ongoingState) {
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

  useEffect(() => {
    const sessionStartedListener = listen<void>("session_started", (_) => {
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

  if (!ongoingState) {
    return <div>No ongoing session</div>;
  }

  const currentBlockIndex = localBlockIndex ?? ongoingState.currentBlockIndex;
  const currentBlock = blocks[currentBlockIndex];
  const timeLeftMs = localTimeLeft ?? ongoingState.timeToNextBlockMs;
  const showCountdown = timeLeftMs <= 3000;

  // Get next 2 blocks for carousel
  const nextBlocks = [];
  for (let i = 1; i <= 2; i++) {
    const nextIndex = currentBlockIndex + i;
    if (nextIndex < blocks.length) {
      nextBlocks.push(blocks[nextIndex]);
    }
  }

  if (!currentBlock) {
    return <div>Invalid block index</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-4">
      {/* Current Block */}
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-lg font-semibold text-center">
          {currentBlock.title}
        </h3>
        <img
          src={getBlockImage(currentBlock.id)}
          alt={currentBlock.title}
          className="h-32 w-32 object-cover rounded-lg"
        />
        {showCountdown && (
          <div className="rounded bg-red-600/90 px-3 py-1 text-white text-sm font-medium">
            Next block in {formatMs(timeLeftMs)}
          </div>
        )}
      </div>

      {/* Next Blocks Carousel */}
      {nextBlocks.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <h4 className="text-sm font-medium text-gray-600">Coming up:</h4>
          <div className="flex gap-3">
            {nextBlocks.map((block, index) => (
              <div
                key={block.id}
                className="flex flex-col items-center gap-1 opacity-70"
              >
                <img
                  src={getBlockImage(block.id)}
                  alt={block.title}
                  className="h-16 w-16 object-cover rounded"
                />
                <span className="text-xs text-center max-w-16 truncate">
                  {block.title}
                </span>
                <span className="text-xs text-gray-500">
                  {index === 0 ? "Next" : "Then"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {blocks.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full ${
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