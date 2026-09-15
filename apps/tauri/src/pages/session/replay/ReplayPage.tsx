import { useEffect, useRef, useState } from "react";
import { ReplayPanel } from "./ReplayPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { ReplayConfiguration, SelectedBoard, SessionPanelConfiguration } from "@/types.ts";
import { replayChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useReplayDataStore } from "@/store/sessionDataStore.tsx";
import { events } from "@/bindings";
import { TimelinePanel } from "@/pages/session/TimelinePanel.tsx";
import { open } from "@tauri-apps/plugin-dialog";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { BaseOption } from "@/components/SelectPrimitive.tsx";

const REPLAY_QUERY_KEY = ["replay_key"];
type ReplayQueryData = { replayInformation: ReplayConfiguration };
export const ReplayQuery = {
  queryKey: REPLAY_QUERY_KEY,
  queryFn: async () => {
    const replayInformation = await commands.replay.replayInfo();

    return { replayInformation };
  },
};

export default function ReplayPage() {
  const { data } = useQuery(ReplayQuery);
  const replayInformation = data?.replayInformation ?? null;

  const queryClient = useQueryClient();

  useEffect(() => {
    const refetch = () => queryClient.invalidateQueries({ queryKey: REPLAY_QUERY_KEY });
    const unlistenPromise = events.replayCompleted.listen(refetch);
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queryClient]);

  const updateReplay = useMutation({
    mutationFn: (newState: SessionPanelConfiguration) => commands.replay.updateReplay(newState),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: REPLAY_QUERY_KEY });
      const previous = queryClient.getQueryData<ReplayQueryData>(REPLAY_QUERY_KEY);

      queryClient.setQueryData(REPLAY_QUERY_KEY, (old: ReplayQueryData | undefined) => {
        if (!old?.replayInformation) return old;
        return {
          ...old,
          replayInformation: {
            ...old.replayInformation,
            core: { ...old.replayInformation.core, ...next },
          },
        };
      });

      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(REPLAY_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
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
  const [boardDisplaySelected, setBoardDisplaySelected] = useState<number[]>([]);
  const lastAvailableBoardsRef = useRef<string>("");

  // Check if available boards changed and update display selection accordingly
  const availableBoardMacs = selectedBoards.map((b) => b.macAddress);
  const availableBoardsKey = availableBoardMacs.join(",");

  if (availableBoardsKey !== lastAvailableBoardsRef.current) {
    lastAvailableBoardsRef.current = availableBoardsKey;
    setBoardDisplaySelected(availableBoardMacs);
  }

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
  const replayIsSelected = !!replayInformation?.filePath;

  const pickSessionFile = async (defaultPath?: string | null) => {
    const selected = await open({
      directory: false,
      defaultPath: defaultPath ?? "",
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

      <TimelinePanel
        activity={chosenActivity}
        playButtonClass={
          "border-l-15 border-r-0 border-t-10 border-b-10 border-l-[#e50012] border-t-transparent border-b-transparent"
        }
        hasOngoingSession={hasOngoingSession}
        placeholderMessage={replayIsSelected ? "No Activity" : ""}
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

      {devices.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No session file selected</p>
          <p className="mb-4 text-xl text-gray-400">Select a session file to replay it!</p>
          <ToolkitButton color="grey" onClick={() => pickSessionFile(replayInformation?.core?.outputDirectory)}>
            Select Replay
          </ToolkitButton>
        </div>
      ) : (
        <BoardGrid selectedBoards={selectedBoards} displayBoards={selectedDisplayBoards} store={useReplayDataStore} />
      )}
    </div>
  );
}
