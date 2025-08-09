import { useState } from "react";
import { useSessionStream } from "@/hooks/useSessionStream";
import BoardPanel from "./BoardPanel";
import { SessionPanel, SessionPanelValue } from "./SessionPanel";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import DeviceScanner from "@/pages/devices/DeviceScanner.tsx";

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

  const [sessionState, setSessionState] = useState<SessionPanelValue>({
    boardIds: ["andreia"],
    userId: "u1",
    lsl: false,
    tcp: false,
    saveDir: null,
    recording: false,
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

  const { sessionInformation } = data!;

  // Start/stop streaming when recording changes
  useSessionStream(sessionInformation.isRecording);

  return (
    <div className="p-4 space-y-4">
      <SessionPanel
        boards={[
          { id: "andreia", label: "Andreia’s board +1" },
          { id: "nidhi", label: "Nidhi’s board" },
        ]}
        users={[
          { id: "u1", name: "Andreia" },
          { id: "u2", name: "Nidhi" },
        ]}
        value={sessionState}
        onChange={setSessionState}
        onRecordToggle={(recording, state) => {
          console.log("Recording toggled:", recording, state);
        }}
      />

      {sessionInformation.selectedBoards.length === 0 ? (
        <div>No boards selected</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sessionInformation.selectedBoards.map((boardName) => (
            <BoardPanel key={boardName} boardName={boardName} />
          ))}
        </div>
      )}
    </div>
  );
}
