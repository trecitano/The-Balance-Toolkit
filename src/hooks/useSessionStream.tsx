import { useEffect, useRef } from "react";
import { Channel } from "@tauri-apps/api/core";
import { ProcessedBoardData } from "../types";
import { useLiveStore } from "../store/liveStore";
import { commands } from "@/utils/requests";

// rAF-batched stream hook
export function useSessionStream(enabled: boolean) {
  const pushBatch = useLiveStore((s) => s.pushFramesBatch);
  const chanRef = useRef<Channel<ProcessedBoardData> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const chan = new Channel<ProcessedBoardData>();
    chanRef.current = chan;

    let buf: ProcessedBoardData[] = [];
    let scheduled = false;

    const flush = () => {
      scheduled = false;
      if (buf.length) {
        // single state update for N frames
        pushBatch(buf);
        buf = [];
      }
    };

    chan.onmessage = (msg) => {
      buf.push(msg);
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
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
  }, [enabled, pushBatch]);
}