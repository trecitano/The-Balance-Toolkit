import { useRef, useState } from "react";
import { useSessionStream } from "@/hooks/useSessionStream";
import BoardPanel from "./BoardPanel";
import { SessionPanel } from "./SessionPanel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { useSessionDataStore } from "@/store/sessionDataStore.tsx";
import { SessionConfiguration } from "@/types.ts";

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
  const clearLiveData = useSessionDataStore((s) => s.actions.clear);
  const [boardDisplaySelected, setBoardDisplaySelected] = useState<string[]>([]);
  const isRecording = useRef(false);

  const { sessionInformation } = data ?? { sessionInformation: null };

  const sessionConfiguration: SessionConfiguration | null = sessionInformation
    ? sessionInformation.sessionConfiguration
    : null;

  // Start/stop streaming when recording changes
  useSessionStream(isRecording.current);

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
    return <div className="inside-page"></div>;
  }

  if (error) {
    return (
      <div className="main-content">
        <div className="flex items-center justify-center p-8">
          <p className="text-red-600">Failed to Session page: {error.message}</p>
        </div>
      </div>
    );
  }

  const boardDisplayOptions = sessionInformation.selectedBoards.map((board) => ({
    value: board.macAddress,
    label: board.name,
  }));
  const selectedDisplayBoards = boardDisplaySelected
    .map((mac) => sessionInformation.selectedBoards.find((b) => b.macAddress === mac))
    .filter(Boolean); // remove null/undefined if any

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

      {selectedDisplayBoards.length === 0 ? (
        <div>No boards selected</div>
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
      <div className="m-0 mt-auto flex w-full items-center justify-between rounded-[12px] bg-gray-100 px-0 py-[5px] shadow-sm">
        <div className="flex w-93/100 flex-col gap-2">
          <canvas className="h-[20px] rounded-lg bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
          <canvas className="h-[20px] rounded-lg bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
        </div>
        <button
          className={`mr-2 flex h-12 min-h-[48px] w-12 min-w-[48px] cursor-pointer items-center justify-center rounded-full p-0 transition-all ${
            isRecording
              ? "border-2 border-[#e50012] bg-[#e50012] text-white"
              : "border-2 border-[#e50012] bg-white text-black"
          }`}
        >
          <span
            className={`block transition-all ${
              isRecording ? "h-5 w-5 rounded-[3px] bg-white" : "h-[22px] w-[22px] rounded-full bg-[#e50012]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
