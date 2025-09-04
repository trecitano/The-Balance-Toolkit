import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBlockImage } from "@/utils/activityImages.ts";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/utils/requests.ts";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";
import "@/App.css";

const SESSION_ACTIVITY_POP_UP_QUERY_KEY = ["session_activity_pop_up"];

// Utility function to format milliseconds to MM:SS
const formatMs = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
    const el = listRef.current?.querySelector(`[data-blockid="${index}"]`);
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "center",
    });
  };

  // Initialize local state when data changes
  useEffect(() => {
    if (sessionActivityState?.ongoingState) {
      setLocalTimeLeft(sessionActivityState.ongoingState.timeToNextBlockMs);
      setLocalBlockIndex(sessionActivityState.ongoingState.currentBlockIndex);
    }
  }, [sessionActivityState?.ongoingState?.timeToNextBlockMs, sessionActivityState?.ongoingState?.currentBlockIndex]);

  // Countdown timer with local block progression
  useEffect(() => {
    if (localTimeLeft === null || localTimeLeft <= 0) return;
    if (!sessionActivityState?.ongoingState) return;

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
  }, [localTimeLeft, localBlockIndex, sessionActivityState]);

  // Auto-scroll to current block when it changes
  useEffect(() => {
    if (localBlockIndex !== null && sessionActivityState?.activity?.timelineBlocks) {
      scrollToBlock(localBlockIndex);
    }
  }, [localBlockIndex, sessionActivityState?.activity?.timelineBlocks]);

  useEffect(() => {
    const sessionStartedListener = listen<void>("session_started", (_) => {
      console.log("Session started");
      queryClient.invalidateQueries({ queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY });
    });
    const sessionActivityChangedListener = listen<void>("session_activity_changed", (_) => {
      queryClient.invalidateQueries({ queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY });
    });
    const sessionCompletedListener = listen<void>("session_completed", (_) => {
      queryClient.invalidateQueries({ queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY });
    });

    return () => {
      sessionStartedListener.then((unlisten) => unlisten());
      sessionActivityChangedListener.then((unlisten) => unlisten());
      sessionCompletedListener.then((unlisten) => unlisten());
    };
  }, []);

  // When we initialize, ensure that we scroll to the first block, if it exists.
  useEffect(() => {
    if (!sessionActivityState?.ongoingState) {
      setLocalBlockIndex(0);
    }
  }, [sessionActivityState]);

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

  // Determine session state
  const isSessionRunning = !!ongoingState;
  const currentBlockIndex = localBlockIndex ?? ongoingState?.currentBlockIndex ?? 0;
  const timeLeftMs = localTimeLeft ?? ongoingState?.timeToNextBlockMs ?? 0;
  const showCountdown = isSessionRunning && timeLeftMs <= 3000;

  return (
    <div className="relative flex h-screen w-95/100 flex-col bg-(--bg-primary) px-20 py-8">
      {/* Countdown in top right corner */}
      {showCountdown && (
        <div className="absolute top-10 right-0 z-10 rounded-lg bg-(--primary) px-3 py-2 text-lg font-semibold text-white">
          Next block in {formatMs(timeLeftMs)}
        </div>
      )}

      {/* Session status indicator */}
      {!isSessionRunning && (
        <div className="absolute top-10 left-0 z-1 rounded-lg bg-(--secondary) px-3 py-2 text-lg font-semibold text-white">
          Session not started
        </div>
      )}

      {/* Activity Title */}
      <h2 className="text-center text-xl font-bold">{activity.title}</h2>

      {/* Blocks Carousel */}
      <ul ref={listRef} className="carousel-list flex flex-1 gap-6 overflow-hidden px-[calc(50%-75px)] py-4">
        {blocks.map((block, index) => {
          const isActive = index === currentBlockIndex;

          // For non-running sessions, only show the first block as active
          const displayIsActive = isSessionRunning ? isActive : index === 0;

          return (
            <li key={index} data-blockid={index} className={`flex h-full flex-col justify-center rounded-lg p-3`}>
              <div
                className={`mt-top linear flex min-h-110 min-w-120 justify-center transition duration-100 ${
                  displayIsActive
                    ? "scale-110 bg-gray-100 opacity-100 shadow-lg ring-1 ring-blue-500"
                    : "scale-100 bg-gray-100"
                }`}
              >
                <img src={getBlockImage(block.id)} alt={block.title} className="mb-2 rounded-lg" />
              </div>
              <span className={`text-center text-sm font-medium text-gray-600`}>{block.title}</span>
            </li>
          );
        })}
      </ul>

      <CarouselIndicators
        entries={blocks.map((_, index) => String(index))}
        selectedIndex={currentBlockIndex}
        nearbyThreshold={1}
      />
    </div>
  );
}
