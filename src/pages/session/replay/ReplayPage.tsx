import { useRef, useState } from "react";
import { ReplayPanel } from "./ReplayPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { SelectedBoard, SessionPanelConfiguration } from "@/types.ts";
import { replayChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useReplayDataStore } from "@/store/sessionDataStore.tsx";
import { listen } from "@tauri-apps/api/event";
import { TimelinePanel } from "@/pages/session/TimelinePanel.tsx";
import { open } from "@tauri-apps/plugin-dialog";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { BaseOption } from "@/components/SelectPrimitive.tsx";

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
  const replayInformation = data?.replayInformation ?? null;

  const queryClient = useQueryClient();

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

  const { mutate: resetReplay } = useMutation({
    mutationFn: () => commands.replay.clearReplay(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
    },
  });

  const selectedBoards = replayInformation?.devices ?? [];
  const [boardDisplaySelected, setBoardDisplaySelected] = useState<number[]>(
    selectedBoards.map((b) => b.macAddress) ?? [],
  );

  const boardDisplayOptions: BaseOption<number>[] = selectedBoards.map((board) => ({
    value: board.macAddress,
    label: board.name,
  }));
  const selectedDisplayBoards = boardDisplaySelected
    .map((mac) => selectedBoards.find((b) => b.macAddress === mac))
    .filter((b): b is SelectedBoard => Boolean(b));
  const chosenActivity = replayInformation?.activity;
  const canStartSession = (replayInformation?.devices?.length ?? 0) > 0;
  const hasOngoingSession = replayInformation?.hasOngoingSession ?? false;
  const devices = replayInformation?.devices ?? [];

  if (replayOverListener.current == null) {
    listen<void>("replay_completed", (_) => {
      //stopTimeline();
      queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
    }).then((unlisten) => {
      replayOverListener.current = unlisten;
    });
  }

  const pickSessionFile = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      filters: [
        {
          name: "Session file",
          extensions: ["settings.json"],
        },
      ],
      title: "Select the Session file",
    });
    if (typeof selected === "string") {
      updateFileLoad.mutate(selected);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <ReplayPanel
        config={replayInformation}
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={boardDisplayOptions}
        onChange={(newState) => updateReplay.mutate(newState.core)}
        onPickSessionFile={pickSessionFile}
        onResetFile={resetReplay}
      />

      {devices.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No session file selected</p>
          <p className="mb-4 text-xl text-gray-400">Select a session file to replay it!</p>
          <ToolkitButton color="grey" onClick={pickSessionFile}>
            Select Replay
          </ToolkitButton>
        </div>
      ) : (
        <BoardGrid boards={selectedDisplayBoards} store={useReplayDataStore} />
      )}

      <TimelinePanel
        activity={chosenActivity}
        hasOngoingSession={hasOngoingSession}
        canStart={canStartSession}
        onStart={async () => {
          await replayChannelManager.start();
          await queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
        }}
        onStop={async () => {
          await replayChannelManager.stop();
          await queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
        }}
      />
    </div>
  );
}
