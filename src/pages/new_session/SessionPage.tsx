import {useEffect, useRef, useState} from "react";
import { useSessionStream } from "@/hooks/useSessionStream";
import BoardPanel from "./BoardPanel";
import { SessionPanel } from "./SessionPanel.tsx";
import {Channel} from "@tauri-apps/api/core";
import {ProcessedBoardData} from "@/types.ts";
import {commands} from "@/utils/requests.ts";

// For demo, pick two board IDs you expect to receive.
const LEFT_ID = "andreia-board";
const RIGHT_ID = "nidhi-board";

export default function SessionPage() {
  const [playing, setPlaying] = useState(false);

  const sessionWebSocket = useRef<Channel<ProcessedBoardData | null>>(null);

  const handleRecord = async (newSession: boolean) => {
    if (newSession) {
      const sessionChannel = new Channel<ProcessedBoardData>();
      sessionChannel.onmessage = (message) => {
        console.log('got download event', message);
      };
      sessionWebSocket.current = sessionChannel;
      await commands.session.startSession(sessionChannel);
    } else {
      await commands.session.stopSession();
      sessionWebSocket.current = null;
    }
  };

  useSessionStream(playing);

  // Optional: pause streaming when tab hidden
  useEffect(() => {
    const onVis = () => setPlaying(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

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
        initial={{
          boardIds: ["andreia"], // pick one or more to start
          // userId: "u1", lsl: false, tcp: false, saveDir: null, recording: false
        }}
        onRecordToggle={ async (recording, state) => {
          await handleRecord(recording)
          console.log("recording:", recording, state);
          // state.boardIds is string[]
        }}
        onChange={(v) => {
          // v.boardIds is string[]
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BoardPanel boardId={LEFT_ID} title="Andreia’s Board" />
        <BoardPanel boardId={RIGHT_ID} title="Nidhi’s Board" />
      </div>
    </div>
  );
}