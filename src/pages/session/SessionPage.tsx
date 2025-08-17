import { useState } from "react";
import BoardPanel from "./BoardPanel";
import { SessionPanel } from "./SessionPanel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { SessionConfiguration } from "@/types.ts";
import { sessionChannelManager } from "@/services/SessionChannelManager.tsx";
import ActivityTimeline from "@/pages/activities/ActivityTimeline.tsx";
import activitiesConfig from "@/config/activities.config.ts";
import { CheckboxOption } from "@/components/MultiSelect.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import clsx from "clsx";

const SESSION_QUERY_KEY = ["session_key"];
export const SessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: async () => {
    const sessionInformation = await commands.session.sessionInfo();
    return { sessionInformation };
  },
};

export default function SessionPage() {
  const { data, isLoading, error } = useQuery(SessionQuery);
  const queryClient = useQueryClient();
  const [boardDisplaySelected, setBoardDisplaySelected] = useState<string[]>([]);

  const { sessionInformation } = data ?? { sessionInformation: null };

  const sessionConfiguration: SessionConfiguration | null = sessionInformation
    ? sessionInformation.sessionConfiguration
    : null;

  const updateSession = useMutation({
    mutationFn: (newState: SessionConfiguration) => commands.session.updateSession(newState),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: SESSION_QUERY_KEY });
      const previous = queryClient.getQueryData(SESSION_QUERY_KEY);

      queryClient.setQueryData(SESSION_QUERY_KEY, (old: any) => {
        if (!old?.sessionInformation) return old;
        return {
          ...old,
          sessionInformation: {
            ...old.sessionInformation,
            sessionConfiguration: {
              ...old.sessionInformation.sessionConfiguration,
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
    .filter(Boolean); // remove null/undefined if any
  const chosenActivity = activitiesConfig.find((a) => a.id === sessionInformation.sessionConfiguration.activityId);
  const canStartSession = sessionInformation.selectedBoards.length > 0;

  return (
    <div className="flex h-full flex-col">
      <SessionPanel
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={boardDisplayOptions}
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
      ) : selectedDisplayBoards.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No boards selected</p>
          <p className="text-xl text-gray-400">Choose a board from the panel above to get started.</p>
        </div>
      ) : selectedDisplayBoards.length === 1 ? (
        <div className="flex justify-center">
          <div className="w-full max-w-3xl">
            <BoardPanel boardName={selectedDisplayBoards[0].name} macAddress={selectedDisplayBoards[0].macAddress} />
          </div>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${boardDisplaySelected.length}, minmax(0, 1fr))`,
          }}
        >
          {selectedDisplayBoards.map((board) => (
            <BoardPanel key={board.macAddress} boardName={board.name} macAddress={board.macAddress} />
          ))}
        </div>
      )}

      {/*  Timeline Panel                           */}
      <div className="m-0 mt-auto flex w-full items-center justify-between rounded-[12px] bg-gray-100 px-0 py-[5px] shadow-sm">
        {chosenActivity ? (
          <ActivityTimeline
            blocks={chosenActivity.defaultBlocks}
            onChange={() => {}}
            onBlockSelect={(block) => {}}
            activityName={chosenActivity.title}
          />
        ) : (
          <div className="flex w-93/100 flex-col gap-2 pl-5">
            <canvas className="h-[20px] rounded-lg bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
            <canvas className="h-[20px] rounded-lg bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
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
            } else {
              await sessionChannelManager.stop();
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
