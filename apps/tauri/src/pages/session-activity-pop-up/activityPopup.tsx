import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBlockImage } from "@/utils/activityImages.ts";
import { events } from "@/bindings";
import { commands } from "@/utils/requests.ts";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";
import "@/App.css";

const SESSION_ACTIVITY_POP_UP_QUERY_KEY = ["session_activity_pop_up"];

export default function Popup() {
  const queryClient = useQueryClient();
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const [localBlockIndex, setLocalBlockIndex] = useState<number | null>(null);
  const [localLoopNumber, setLocalLoopNumber] = useState<number | null>(null);
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
      setLocalLoopNumber(sessionActivityState.ongoingState.loopNumber);
    }
  }, [
    sessionActivityState?.ongoingState?.timeToNextBlockMs,
    sessionActivityState?.ongoingState?.currentBlockIndex,
    sessionActivityState?.ongoingState?.loopNumber,
  ]);

  // Countdown timer with local block progression and loop handling
  useEffect(() => {
    if (localTimeLeft === null || localTimeLeft <= 0) return;
    if (!sessionActivityState?.ongoingState) return;

    const interval = setInterval(() => {
      setLocalTimeLeft((prev) => {
        if (prev === null || prev <= 1000) {
          // Time's up - move to next block or next loop
          const blocks = sessionActivityState?.activity?.timelineBlocks ?? [];
          const totalLoops = sessionActivityState?.activity?.loops ?? 1;
          const currentIndex = localBlockIndex ?? 0;
          const currentLoop = localLoopNumber ?? 0;
          const nextIndex = currentIndex + 1;

          if (nextIndex < blocks.length) {
            // Move to next block in current loop
            setLocalBlockIndex(nextIndex);
            const nextBlock = blocks[nextIndex];
            return nextBlock.duration * 1000;
          } else {
            // Reached end of blocks, check if we need to start next loop
            const nextLoop = currentLoop + 1;
            if (nextLoop < totalLoops) {
              // Start next loop from first block
              setLocalBlockIndex(0);
              setLocalLoopNumber(nextLoop);
              const firstBlock = blocks[0];
              return firstBlock.duration * 1000;
            } else {
              // All loops completed - session finished
              return null;
            }
          }
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localTimeLeft, localBlockIndex, localLoopNumber, sessionActivityState]);

  // Auto-scroll to current block when it changes
  useEffect(() => {
    if (localBlockIndex !== null && sessionActivityState?.activity?.timelineBlocks) {
      scrollToBlock(localBlockIndex);
    }
  }, [localBlockIndex, sessionActivityState?.activity?.timelineBlocks]);

  useEffect(() => {
    const refetch = () => queryClient.invalidateQueries({ queryKey: SESSION_ACTIVITY_POP_UP_QUERY_KEY });
    const unlistenPromises = [
      events.sessionStarted.listen(refetch),
      events.sessionActivityChanged.listen(refetch),
      events.sessionCompleted.listen(refetch),
    ];

    return () => {
      unlistenPromises.forEach((promise) => promise.then((unlisten) => unlisten()));
    };
  }, []);

  // When we initialize, ensure that we scroll to the first block, if it exists.
  useEffect(() => {
    if (!sessionActivityState?.ongoingState) {
      setLocalBlockIndex(0);
      setLocalLoopNumber(0);
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
  const currentLoopNumber = localLoopNumber ?? ongoingState?.loopNumber ?? 0;
  const timeLeftMs = localTimeLeft ?? ongoingState?.timeToNextBlockMs ?? 0;
  const showCountdown = isSessionRunning && timeLeftMs <= 3000;
  const totalLoops = activity?.loops ?? 1;

  return (
    <div className="relative flex h-screen w-95/100 flex-col bg-(--bg-primary) px-20 py-8">
      {/* Countdown in top right corner */}
      {showCountdown && (
        <div className="absolute top-10 right-0 z-10 size-20 rounded-full bg-(--primary) p-5 text-4xl font-semibold text-white">
          {Math.ceil(timeLeftMs / 1000)}..
        </div>
      )}

      {/* Session status indicator or Loop counter */}
      {!isSessionRunning ? (
        <div className="absolute top-10 left-0 z-1 rounded-lg bg-(--secondary) px-3 py-2 text-lg font-semibold text-white">
          Session not started
        </div>
      ) : (
        <div className="absolute top-10 left-0 z-1 rounded-lg bg-(--primary) px-3 py-2 text-lg font-semibold text-white">
          Loop {currentLoopNumber + 1} of {totalLoops}
        </div>
      )}

      {/* Activity Title */}
      <h2 className="text-center text-xl font-bold">{activity.title}</h2>

      {/* Blocks Carousel */}
      <ul ref={listRef} className="mask-horizontal-fade flex flex-1 gap-6 overflow-hidden px-[calc(50vw-10rem)] py-4">
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
