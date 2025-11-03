import {useRef, useState} from "react";
import { SessionPanel } from "./SessionPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { Activity, SessionPanelConfiguration, SessionInformation, SelectedBoard } from "@/types.ts";
import { sessionChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useSessionDataStore } from "@/store/sessionDataStore.tsx";
import { listen } from "@tauri-apps/api/event";
import { TimelinePanel } from "@/pages/session/TimelinePanel.tsx";
import { BaseOption } from "@/components/SelectPrimitive.tsx";
import {devicesIcon} from "@/components/navigation/Navigation.tsx";

export const SESSION_QUERY_KEY = ["session_key"];
export type SessionQueryData = {
  sessionInformation: SessionInformation;
  activities: Activity[];
};
export const SessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: async () => {
    const [sessionInformation, activities] = await Promise.all([
      commands.session.sessionInfo(),
      commands.activity.getActivities(),
    ]);

    return { sessionInformation, activities };
  },
};

export default function SessionPage() {
  const { data } = useQuery(SessionQuery);
  const queryClient = useQueryClient();
  const sessionOverListener = useRef<(() => void) | null>(null);

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
            sessionConfiguration: {
              ...old.sessionInformation.core,
              ...next,
            },
          },
        };
      });

      return { previous };
    },
    onSuccess: () => {
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
  const lastAvailableBoardsRef = useRef<string>('');

  // Check if available boards changed and update display selection accordingly
  const availableBoardMacs = selectedBoards.map(b => b.macAddress);
  const availableBoardsKey = availableBoardMacs.join(',');

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

  if (sessionOverListener.current == null) {
    listen<void>("session_completed", (_) => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    }).then((unlisten) => {
      sessionOverListener.current = unlisten;
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
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

      {selectedBoards.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No boards in session</p>
          <p className="mb-4 text-xl text-gray-400">Connect to a board in the Devices page!</p>
          <ToolkitButton to="/devices" color="blue" iconUrl={devicesIcon}>
            Devices →
          </ToolkitButton>
        </div>
      ) : (
        <BoardGrid boards={selectedDisplayBoards} store={useSessionDataStore} />
      )}
    </div>
  );
}