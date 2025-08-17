import { Channel } from "@tauri-apps/api/core";
import { RawBalanceBoardEvent, ProcessedBoardEvent } from "@/types";
import { commands } from "@/utils/requests";
import { useSessionActions } from "@/store/sessionDataStore.tsx";

class SessionChannelManager {
  private channel: Channel<RawBalanceBoardEvent | ProcessedBoardEvent> | null = null;

  async start() {
    const pushRaw = useSessionActions().pushRawFrame;
    const pushProcessed = useSessionActions().pushProcessedFrame;

    this.channel = new Channel<RawBalanceBoardEvent | ProcessedBoardEvent>();
    this.channel.onmessage = (msg) => {
      requestAnimationFrame(() => {
        if (msg.event === "raw") {
          pushRaw(msg as RawBalanceBoardEvent);
        } else if (msg.event === "processed") {
          pushProcessed(msg as ProcessedBoardEvent);
        }
      });
    };

    try {
      await commands.session.startSession(this.channel);
    } catch (e) {
      console.error("Failed to start session", e);
    }
  }

  async stop() {
    const clearLiveData = useSessionActions().clear;

    try {
      await commands.session.stopSession();
      clearLiveData();
    } catch (e) {
      console.warn("Failed to stop session", e);
    }

    this.channel = null;
  }
}

// Export a singleton instance
export const sessionChannelManager = new SessionChannelManager();
