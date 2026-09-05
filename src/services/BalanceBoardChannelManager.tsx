import { Channel } from "@tauri-apps/api/core";
import { RawBalanceBoardEvent, ProcessedBoardEvent, BalanceBoardEvent } from "@/types";
import { commands } from "@/utils/requests";
import { useSessionActions, useReplayActions } from "@/store/sessionDataStore";

type ChannelCommands = {
  start: (ch: Channel<BalanceBoardEvent>) => Promise<unknown>;
  stop: () => Promise<unknown>;
};

type ChannelActions = {
  pushFrames: (frames: BalanceBoardEvent[]) => void;
  clear: () => void;
};

class BalanceBoardChannelManager {
  private channel: Channel<RawBalanceBoardEvent | ProcessedBoardEvent> | null = null;
  private readonly commands: ChannelCommands;
  private readonly actions: ChannelActions;

  // Events received since the last animation frame. They are applied to the store in one
  // batch per frame, so plots redraw at most once per frame rather than once per event.
  private pending: BalanceBoardEvent[] = [];
  private flushHandle: number | null = null;

  constructor(commands: ChannelCommands, actions: ChannelActions) {
    this.commands = commands;
    this.actions = actions;
  }

  private enqueue(msg: BalanceBoardEvent) {
    this.pending.push(msg);
    if (this.flushHandle !== null) return;

    this.flushHandle = requestAnimationFrame(() => {
      this.flushHandle = null;
      const batch = this.pending;
      this.pending = [];
      this.actions.pushFrames(batch);
    });
  }

  private discardPending() {
    if (this.flushHandle !== null) {
      cancelAnimationFrame(this.flushHandle);
      this.flushHandle = null;
    }
    this.pending = [];
  }

  async start() {
    this.discardPending();
    this.actions.clear();

    const channel = new Channel<RawBalanceBoardEvent | ProcessedBoardEvent>();
    channel.onmessage = (msg) => {
      // Ignore late messages from a channel that has already been stopped.
      if (this.channel !== channel) return;
      if (msg.event === "raw" || msg.event === "processed") {
        this.enqueue(msg);
      }
    };
    this.channel = channel;

    try {
      await this.commands.start(channel);
    } catch (e) {
      console.error("Failed to start session", e);
    }
  }

  async stop() {
    this.channel = null;
    this.discardPending();

    try {
      await this.commands.stop();
      this.actions.clear();
    } catch (e) {
      console.warn("Failed to stop session", e);
    }
  }
}

export const sessionChannelManager = new BalanceBoardChannelManager(
  {
    start: commands.session.startSession,
    stop: commands.session.stopSession,
  },
  useSessionActions(),
);

export const replayChannelManager = new BalanceBoardChannelManager(
  {
    start: commands.replay.startReplay,
    stop: commands.replay.stopReplay,
  },
  useReplayActions(),
);
