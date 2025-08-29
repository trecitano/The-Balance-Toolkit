import { useRef, useState } from "react";
import ComplexBoardPanel from "../ComplexBoardPanel.tsx";
import { ReplayPanel } from "./ReplayPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import {
  Activity,
  ReplayConfiguration,
  SelectedBoard,
  SessionPanelConfiguration,
  SessionInformation,
} from "@/types.ts";
import { replayChannelManager, sessionChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import ActivityTimeline from "@/pages/activities/ActivityTimeline.tsx";
import { CheckboxOption } from "@/components/MultiSelect.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import clsx from "clsx";
import { registerPlayhead, startTimeline, stopTimeline } from "@/pages/session/ProgressTimer.ts";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useReplayDataStore, useSessionDataStore } from "@/store/sessionDataStore.tsx";
import { listen } from "@tauri-apps/api/event";

const REPLAY_QUERY_KEY = ["replay_key"];
export const ReplayQuery = {
  queryKey: REPLAY_QUERY_KEY,
  queryFn: async () => {
    const replayInformation = await commands.replay.replayInfo();

    return { replayInformation };
  },
};

export default function ReplayPage() {
  const { data } = useQuery(ReplayQuery);
  const replayOverListener = useRef<(() => void) | null>(null);
  const replayInformation =
    data?.replayInformation ??
    ({ core: {}, devices: [], filePath: "", hasOngoingSession: false } as ReplayConfiguration);

  const queryClient = useQueryClient();
  const [boardDisplaySelected, setBoardDisplaySelected] = useState<string[]>(
    replayInformation?.devices?.map((b) => b.macAddress) ?? [],
  );

  const updateReplay = useMutation({
    mutationFn: (newState: SessionPanelConfiguration) => commands.replay.updateReplay(newState),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
    },
  });

  const updateFileLoad = useMutation({
    mutationFn: (filePath: string) => commands.replay.loadReplayFile(filePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
    },
  });

  const boardDisplayOptions: CheckboxOption[] = replayInformation.devices.map((board) => ({
    value: board.macAddress,
    label: board.name,
  }));
  const selectedDisplayBoards = boardDisplaySelected
    .map((mac) => replayInformation.devices.find((b) => b.macAddress === mac))
    .filter(Boolean);
  const chosenActivityDuration = replayInformation.activity?.timelineBlocks?.reduce(
    (acc, block) => acc + block.duration,
    0,
  );
  const chosenActivity = replayInformation.activity;
  const canStartSession = replayInformation.devices.length > 0;

  if (replayOverListener.current == null) {
    listen<void>("replay_completed", (_) => {
      console.log("Received session completed from the frontend!");
      stopTimeline();
      queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
    }).then((unlisten) => {
      replayOverListener.current = unlisten;
    });
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <ReplayPanel
        config={replayInformation}
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={boardDisplayOptions}
        onChange={(newState) => updateReplay.mutate(newState.core)}
        onLoadFile={(filePath) => updateFileLoad.mutate(filePath)}
      />

      {replayInformation.devices.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No session file selected</p>
          <p className="mb-4 text-xl text-gray-400">Select a session file to replay it!</p>
        </div>
      ) : (
        <BoardGrid boards={selectedDisplayBoards} store={useReplayDataStore} />
      )}

      {/*  Timeline Panel                           */}
      <div className="mt-auto flex w-full items-center justify-between rounded-lg bg-gray-100 py-3 shadow-sm">
        {chosenActivity ? (
          <div className={"relative m-5 w-9/10"}>
            <ActivityTimeline
              activityId={chosenActivity.id}
              blocks={chosenActivity.timelineBlocks}
            />
            <div
              ref={(el) => {
                if (el) {
                  el.style.transform = "translateX(0px)";
                  registerPlayhead(el);
                }
              }}
              className={clsx(
                "absolute top-0 bottom-0 z-10 h-full w-[2px] bg-[var(--red)]",
                !replayInformation.hasOngoingSession && "hidden",
              )}
            >
              {/* Circle handle at the top */}
              <div className="absolute left-1/2 h-4 w-5 -translate-x-1/2 bg-[var(--red)] shadow-(--shadow-light) [clip-path:polygon(91.6%_0%,100%_37.5%,50%_100%,0%_37.5%,8.3%_0%)]" />
            </div>
          </div>
        ) : (
          <div className="h-20 w-9/10 text-center"></div>
        )}

        <button
          className={clsx(
            "mr-2 flex h-12 min-h-[48px] w-12 min-w-[48px] cursor-pointer items-center justify-center rounded-full p-0 transition-all",
            replayInformation.hasOngoingSession
              ? "border-2 border-[#e50012] bg-[#e50012] text-white"
              : "border-2 border-[#e50012] bg-white text-black",
            "disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-50",
          )}
          onClick={async () => {
            if (!replayInformation.hasOngoingSession) {
              await replayChannelManager.start();
              await startTimeline(chosenActivityDuration * 1000);
            } else {
              await replayChannelManager.stop();
              await stopTimeline();
            }
            await queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
          }}
          disabled={!canStartSession}
        >
          <span
            className={`block transition-all ${
              replayInformation.hasOngoingSession
                ? "h-5 w-5 rounded-lg bg-white"
                : "h-[22px] w-[22px] rounded-full bg-[#e50012]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
