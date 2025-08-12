import { useState } from "react";
import { useSessionStream } from "@/hooks/useSessionStream";
import BoardPanel from "./BoardPanel";
import { SessionPanel, SessionPanelValue } from "./SessionPanel";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { useSessionDataStore} from "@/store/sessionDataStore.tsx";

const SESSION_QUERY_KEY = ["session_key"];
export const SessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: async () => {
    const sessionInformation = await commands.session.sessionInfo();
    return { sessionInformation };
  },
  staleTime: 10000,
};

export default function SessionPage() {
  const { data, isLoading, error } = useQuery(SessionQuery);

  const clearLiveData = useSessionDataStore((s) => s.actions.clear);
  const [boardDisplaySelected, setBoardDisplaySelected] = useState<string[]>(["Board One"]);
  const [sessionState, setSessionState] = useState<SessionPanelValue>({
    selectedUser: "🐻",
    lsl: false,
    tcp: false,
    saveDir: null,
    recording: false,
  });

  const { sessionInformation } = data ?? { sessionInformation: null };

  // Start/stop streaming when recording changes
  useSessionStream(sessionState.recording);

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

  return (
    <div className="p-4 space-y-4">
      <SessionPanel
        boardDisplaySelected={boardDisplaySelected}
        onBoardDisplayChange={setBoardDisplaySelected}
        boardDisplayOptions={["Board One", "Board Two"]}
        userOptions={["Andreia", "🐻"]}
        value={sessionState}
        onChange={setSessionState}
        onRecordToggle={(recording, state) => {
          console.log("Recording toggled:", recording, state);
          setSessionState(state);
          if (!recording) {
            clearLiveData()
          }
        }}
      />

      {boardDisplaySelected.length === 0 ? (
        <div>No boards selected</div>
      ) : boardDisplaySelected.length === 1 ? (
        // Single board: center it
        <div className="flex justify-center">
          <div className="w-full max-w-3xl">
            <BoardPanel boardName={boardDisplaySelected[0]} />
          </div>
        </div>
      ) : (
        // Multiple boards: split evenly
        <div
          className={`grid gap-4`}
          style={{
            gridTemplateColumns: `repeat(${boardDisplaySelected.length}, minmax(0, 1fr))`,
          }}
        >
          {boardDisplaySelected.map((boardName) => (
            <BoardPanel key={boardName} boardName={boardName} />
          ))}
        </div>
      )}
    </div>
  );
}
