import { useState } from "react";
import BoardPanel from "../BoardPanel.tsx";
import { SessionPanel } from "./SessionPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { Activity, SessionPanelConfiguration, SessionInformation } from "@/types.ts";
import { sessionChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import ActivityTimeline from "@/pages/activities/ActivityTimeline.tsx";
import { CheckboxOption } from "@/components/MultiSelect.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import clsx from "clsx";
import { registerPlayhead, startTimeline, stopTimeline } from "@/pages/session/ProgressTimer.ts";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useSessionDataStore } from "@/store/sessionDataStore.tsx";

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
  const { data, isLoading, error } = useQuery(SessionQuery);
  const queryClient = useQueryClient();

  const { sessionInformation, activities } = data ?? { sessionInformation: {}, activities: [] };

  const sessionConfiguration: SessionPanelConfiguration | null = sessionInformation ? sessionInformation.core : null;

  const [boardDisplaySelected, setBoardDisplaySelected] = useState<string[]>(
    sessionInformation?.selectedBoards?.map((b) => b.macAddress) ?? [],
  );

  const updateSession = useMutation({
    mutationFn: (newState: SessionPanelConfiguration) => commands.session.updateSession(newState),
    onMutate: async (next) => {
      console.log("Updating session with ", next);
      await queryClient.cancelQueries({ queryKey: SESSION_QUERY_KEY });
      const previous = queryClient.getQueryData(SESSION_QUERY_KEY);

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

  if (isLoading) {
    return <div className=""></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-600">Failed to Session page: {error.message}</p>
      </div>
    );
  }

  const boardDisplayOptions: CheckboxOption[] = sessionInformation.selectedBoards.map((board) => ({
    value: board.macAddress,
    label: board.name,
  }));
  const selectedDisplayBoards = boardDisplaySelected
    .map((mac) => sessionInformation.selectedBoards.find((b) => b.macAddress === mac))
    .filter(Boolean);
  const activityOptions = activities.map((i) => ({ label: i.title, value: i.id }));
  const chosenActivity = activities.find((a) => a.id === sessionInformation.core.activityId);
  const chosenActivityDuration = chosenActivity?.timelineBlocks?.reduce((acc, block) => acc + block.duration, 0);
  const canStartSession = sessionInformation.selectedBoards.length > 0;

  console.log("Duration is ", chosenActivityDuration);
  console.log("Session config", sessionConfiguration);

  return (
    <div className="flex h-full flex-col">
      <SessionPanel
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={boardDisplayOptions}
        activityOptions={activityOptions}
        userOptions={sessionInformation.availableUsers}
        value={sessionConfiguration}
        onChange={(newState) => updateSession.mutate(newState)}
      />

      {sessionInformation.selectedBoards.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No boards in session</p>
          <p className="mb-4 text-xl text-gray-400">Connect to a board in the Devices page!</p>
          <ToolkitButton to="/devices" variant="blue">
            Go to Devices →
          </ToolkitButton>
        </div>
      ) : (
        <BoardGrid boards={selectedDisplayBoards} store={useSessionDataStore} />
      )}

      {/*  Timeline Panel                           */}
      <div className="mt-auto flex w-full items-center justify-between rounded-[12px] bg-gray-100 py-3 shadow-sm">
        {chosenActivity ? (
          <div className={"relative m-5 w-9/10"}>
            <ActivityTimeline
              activityId={chosenActivity.id}
              blocks={chosenActivity.timelineBlocks}
              onChange={() => {}}
              onBlockSelect={(block) => {}}
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
                !sessionInformation.hasOngoingSession && "hidden",
              )}
            >
              {/* Circle handle at the top */}
              <div className="absolute left-1/2 h-4 w-5 -translate-x-1/2 bg-[var(--red)] shadow-md [clip-path:polygon(91.6%_0%,100%_37.5%,50%_100%,0%_37.5%,8.3%_0%)]" />
            </div>
          </div>
        ) : (
          <div className="h-20 w-9/10 text-center">
            <p className="mb-10 text-xl text-gray-400">Choose an activity</p>
          </div>
        )}

        <button
          className={clsx(
            "mr-2 flex h-12 min-h-[48px] w-12 min-w-[48px] cursor-pointer items-center justify-center rounded-full p-0 transition-all",
            sessionInformation.hasOngoingSession
              ? "border-2 border-[#e50012] bg-[#e50012] text-white"
              : "border-2 border-[#e50012] bg-white text-black",
            "disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-50",
          )}
          onClick={async () => {
            if (!sessionInformation.hasOngoingSession) {
              await sessionChannelManager.start();
              await startTimeline(chosenActivityDuration * 1000);
            } else {
              await sessionChannelManager.stop();
              await stopTimeline();
            }
            await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
          }}
          disabled={!canStartSession}
        >
          <span
            className={`block transition-all ${
              sessionInformation.hasOngoingSession
                ? "h-5 w-5 rounded-[3px] bg-white"
                : "h-[22px] w-[22px] rounded-full bg-[#e50012]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
