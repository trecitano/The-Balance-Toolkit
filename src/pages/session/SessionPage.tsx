import {useRef, useState} from "react";
import { useSessionStream } from "@/hooks/useSessionStream";
import BoardPanel from "./BoardPanel";
import { SessionPanel, SessionPanelValue } from "./SessionPanel";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { useSessionDataStore } from "@/store/sessionDataStore.tsx";

const SESSION_QUERY_KEY = ["session_key"];
export const SessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: async () => {
    const sessionInformation = await commands.session.sessionInfo();
    return { sessionInformation };
  }
};

export default function SessionPage() {
  const { data, isLoading, error } = useQuery(SessionQuery);
  const queryClient = useQueryClient();
  const clearLiveData = useSessionDataStore((s) => s.actions.clear);
  const [boardDisplaySelected, setBoardDisplaySelected] = useState<string[]>([]);
  const isRecording = useRef(false);

  const { sessionInformation } = data ?? { sessionInformation: null };

  const sessionState: SessionPanelValue | null = sessionInformation
    ? {
      selectedUser: sessionInformation.selectedUser,
      lsl: sessionInformation.lslEnabled,
      tcp: sessionInformation.tcpEnabled,
      saveDir: sessionInformation.fileLocation,
      recording: sessionInformation.isRecording,
    }
    : null;

  // Start/stop streaming when recording changes
  useSessionStream(isRecording.current);

  const updateSession = useMutation({
    mutationFn: (newState: SessionPanelValue) =>
      commands.session.updateSession(newState),
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
    .map((mac) =>
      sessionInformation.selectedBoards.find((b) => b.macAddress === mac)
    )
    .filter(Boolean); // remove null/undefined if any

  return (
    <div className="space-y-4 p-4">
      <SessionPanel
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={boardDisplayOptions}
        userOptions={sessionInformation.availableUsers}
        value={sessionState}
        onChange={(newState) => updateSession.mutate(newState)}
        onRecordToggle={(recording, state) => {
          updateSession.mutate(state);
          isRecording.current = !isRecording.current;
          if (!recording) clearLiveData();
        }}
      />

      {selectedDisplayBoards.length === 0 ? (
        <div>No boards selected</div>
      ) : selectedDisplayBoards.length === 1 ? (
        <div className="flex justify-center">
          <div className="w-full max-w-3xl">
            <BoardPanel boardName={selectedDisplayBoards[0].name} macAddress={selectedDisplayBoards[0].macAddress } />
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
            <BoardPanel
              key={board.macAddress}
              boardName={board.name}
              macAddress={board.macAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
