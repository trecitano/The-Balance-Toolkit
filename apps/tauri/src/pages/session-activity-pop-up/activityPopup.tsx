import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBlockImage } from "@/utils/activityImages.ts";
import { ActivityStateQuery } from "@/queries/toolkit";
import { QueryStatus } from "@/components/QueryStatus";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";

export default function Popup() {
  const listRef = useRef<HTMLUListElement>(null);
  const query = useQuery({
    ...ActivityStateQuery,
    refetchInterval: (query) => (query.state.data?.ongoingState ? 1000 : false),
  });
  const sessionActivityState = query.data;
  const currentBlockIndex = sessionActivityState?.ongoingState?.currentBlockIndex ?? 0;
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-blockid="${currentBlockIndex}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentBlockIndex, sessionActivityState?.activity.id]);
  if (query.isPending || query.error)
    return <QueryStatus pending={query.isPending} error={query.error} onRetry={() => void query.refetch()} />;
  if (!sessionActivityState) return <QueryStatus empty="No activity selected." />;
  const activity = sessionActivityState.activity;
  const blocks = activity.timelineBlocks;
  if (!blocks.length) return <QueryStatus empty="No blocks in this activity." />;
  const ongoingState = sessionActivityState.ongoingState;
  const isSessionRunning = !!ongoingState;
  const currentLoopNumber = ongoingState?.loopNumber ?? 0;
  const timeLeftMs = ongoingState?.timeToNextBlockMs ?? 0;
  const showCountdown = isSessionRunning && timeLeftMs <= 3000;
  const totalLoops = activity.loops;

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
