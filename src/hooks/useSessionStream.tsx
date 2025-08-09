import { useEffect, useRef } from "react";
import { Channel } from "@tauri-apps/api/core";
import { BalanceBoardEvent } from "../types";
import { useLiveStore } from "../store/liveStore";
import { commands } from "@/utils/requests";

// rAF-batched stream hook
export function useSessionStream(enabled: boolean) {
  const pushBatch = useLiveStore((s) => s.pushFramesBatch);
  const chanRef = useRef<Channel<BalanceBoardEvent> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const chan = new Channel<BalanceBoardEvent>();
    chanRef.current = chan;

    let buf: BalanceBoardEvent[] = [];
    let scheduled = false;

    const flush = () => {
      scheduled = false;
      if (buf.length) {
        pushBatch(buf);
        buf = [];
      }
    };

    chan.onmessage = (msg) => {
      console.log("Received event!:", msg);
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