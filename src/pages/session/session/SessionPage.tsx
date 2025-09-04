import { useRef, useState } from "react";
import { SessionPanel } from "./SessionPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { Activity, SessionPanelConfiguration, SessionInformation } from "@/types.ts";
import { sessionChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import { CheckboxOption } from "@/components/MultiSelect.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useSessionDataStore } from "@/store/sessionDataStore.tsx";
import { listen } from "@tauri-apps/api/event";
import { TimelinePanel } from "@/pages/session/TimelinePanel.tsx";

const SESSION_QUERY_KEY = ["session_key"];
type SessionQueryData = {
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

  const { sessionInformation, activities } = data ?? {
    sessionInformation: {
      availableUsers: [],
      selectedBoards: [],
      core: {},
      activity: {},
      hasOngoingSession: false,
    },
    activities: [],
  };

  const sessionConfiguration: SessionPanelConfiguration | null = sessionInformation ? sessionInformation.core : null;

  const [boardDisplaySelected, setBoardDisplaySelected] = useState<string[]>(
    sessionInformation?.selectedBoards?.map((b) => b.macAddress) ?? [],
  );

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

  const boardDisplayOptions: CheckboxOption[] = sessionInformation.selectedBoards.map((board) => ({
    value: board.macAddress,
    label: board.name,
  }));
  const selectedDisplayBoards = boardDisplaySelected
    .map((mac) => sessionInformation.selectedBoards.find((b) => b.macAddress === mac))
    .filter(Boolean);
  const activityOptions = activities.map((i) => ({ label: i.title, value: i.id }));
  const chosenActivity = activities.find((a) => a.id === sessionInformation.core.activityId);
  const canStartSession = sessionInformation.selectedBoards.length > 0;

  if (sessionOverListener.current == null) {
    listen<void>("session_completed", (_) => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    }).then((unlisten) => {
      sessionOverListener.current = unlisten;
    });
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <SessionPanel
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={boardDisplayOptions}
        activityOptions={activityOptions}
        userOptions={sessionInformation.availableUsers}
        editable={!sessionInformation.hasOngoingSession}
        value={sessionConfiguration}
        onChange={(newState) => updateSession.mutate(newState)}
      />

      {sessionInformation.selectedBoards.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No boards in session</p>
          <p className="mb-4 text-xl text-gray-400">Connect to a board in the Devices page!</p>
          <ToolkitButton to="/devices" color="blue">
            Go to Devices →
          </ToolkitButton>
        </div>
      ) : (
        <BoardGrid boards={selectedDisplayBoards} store={useSessionDataStore} />
      )}

      <TimelinePanel
        activity={chosenActivity}
        placeholderMessage="Choose an activity"
        hasOngoingSession={sessionInformation.hasOngoingSession}
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
    </div>
  );
}
