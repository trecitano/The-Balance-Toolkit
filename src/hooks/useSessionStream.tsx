import { useEffect, useRef } from "react";
import { Channel } from "@tauri-apps/api/core";
import { RawBalanceBoardEvent, ProcessedBoardEvent } from "@/types";
import { useSessionActions } from "@/store/sessionDataStore.tsx";
import { commands } from "@/utils/requests";

export function useSessionStream(enabled: boolean) {
  const pushRaw = useSessionActions().pushRawFrame;
  const pushProcessed = useSessionActions().pushProcessedFrame;
  const chanRef = useRef<Channel<RawBalanceBoardEvent | ProcessedBoardEvent> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const chan = new Channel<RawBalanceBoardEvent | ProcessedBoardEvent>();
    chanRef.current = chan;

    chan.onmessage = (msg) => {
      requestAnimationFrame(() => {
        if (msg.event === "raw") {
          pushRaw(msg as RawBalanceBoardEvent);
        } else if (msg.event === "processed") {
          pushProcessed(msg as ProcessedBoardEvent);
        }
      });
    };

    (async () => {
      try {
        await commands.session.startSession(chan);
      } catch (e) {
        console.error("startSession failed", e);
      }
    })();

    return () => {
      commands.session.stopSession().catch(() => {});
      chanRef.current = null;
    };
  }, [enabled, pushRaw, pushProcessed]);
}
