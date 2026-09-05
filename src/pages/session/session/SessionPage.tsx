import { useEffect, useRef, useState } from "react";
import { SessionPanel } from "./SessionPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { SessionPanelConfiguration, SelectedBoard } from "@/types.ts";
import { sessionChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useSessionDataStore } from "@/store/sessionDataStore.tsx";
import { listen } from "@tauri-apps/api/event";
import { TimelinePanel } from "@/pages/session/TimelinePanel.tsx";
import { BaseOption } from "@/components/SelectPrimitive.tsx";
import { SESSION_QUERY_KEY, SessionQuery, SessionQueryData } from "@/pages/session/session/sessionQuery.ts";

export default function SessionPage() {
  const { data } = useQuery(SessionQuery);
  const queryClient = useQueryClient();

  // Backend session events. Registered in an effect so each mount adds exactly one listener
  // and removes it on unmount.
  useEffect(() => {
    const refetch = () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    const unlistenPromises = [listen<void>("session_started", refetch), listen<void>("session_completed", refetch)];
    return () => {
      unlistenPromises.forEach((promise) => promise.then((unlisten) => unlisten()));
    };
  }, [queryClient]);

  const updateSession = useMutation({
    mutationFn: (newState: SessionPanelConfiguration) => commands.session.updateSession(newState),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: SESSION_QUERY_KEY });
      const previous = queryClient.getQueryData<SessionQueryData>(SESSION_QUERY_KEY);

      queryClient.setQueryData(SESSION_QUERY_KEY, (old: SessionQueryData) => {
        if (!old?.sessionInformation) return old;
        return {
          ...old,
          sessionInformation: {
            ...old.sessionInformation,
            core: {
              ...old.sessionInformation.core,
              ...next,
            },
          },
        };
      });

      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SESSION_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  const { sessionInformation, activities } = data ?? {
    sessionInformation: null,
    activities: [],
  };

  const sessionConfiguration: SessionPanelConfiguration | null = sessionInformation ? sessionInformation.core : null;
  const selectedBoards = sessionInformation?.selectedBoards ?? [];

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
  const activityOptions = activities.map((i) => ({ label: i.title, value: i.id }));
  const chosenActivity = activities.find((a) => a.id === sessionInformation?.core.activityId);
  const canStartSession = selectedBoards.length > 0;
  const hasOngoingSession = sessionInformation?.hasOngoingSession ?? false;

  return (
    <div className="flex h-full flex-col gap-5">
      <SessionPanel
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={boardDisplayOptions}
        activityOptions={activityOptions}
        userOptions={sessionInformation?.availableUsers ?? []}
        disabled={hasOngoingSession}
        value={sessionConfiguration}
        onChange={(newState) => updateSession.mutate(newState)}
      />

      <TimelinePanel
        activity={chosenActivity}
        playButtonClass={"size-6 rounded-full bg-[#e50012]"}
        placeholderMessage="No activity selected"
        hasOngoingSession={hasOngoingSession}
        canStart={canStartSession}
        onStart={async () => {
          await sessionChannelManager.start();
          await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        }}
        onStop={async () => {
          await sessionChannelManager.stop();
          await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        }}
      />

      <BoardGrid selectedBoards={selectedBoards} displayBoards={selectedDisplayBoards} store={useSessionDataStore} />
    </div>
  );
}
