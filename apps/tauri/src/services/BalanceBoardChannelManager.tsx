import { Channel } from "@tauri-apps/api/core";
import { RawBalanceBoardEvent, ProcessedBoardEvent, FrontendBalanceBoardEvent } from "@/types";
import { commands } from "@/utils/requests";
import { getSessionActions, getReplayActions } from "@/store/sessionDataStore";

type ChannelCommands = {
  start: (ch: Channel<FrontendBalanceBoardEvent>) => Promise<unknown>;
  stop: () => Promise<unknown>;
};

type ChannelActions = {
  pushFrames: (frames: FrontendBalanceBoardEvent[]) => void;
  clear: () => void;
};

class BalanceBoardChannelManager {
  private channel: Channel<RawBalanceBoardEvent | ProcessedBoardEvent> | null = null;
  private readonly commands: ChannelCommands;
  private readonly actions: ChannelActions;

  // Events received since the last animation frame. They are applied to the store in one
  // batch per frame, so plots redraw at most once per frame rather than once per event.
  private pending: FrontendBalanceBoardEvent[] = [];
  private flushHandle: number | null = null;

  constructor(commands: ChannelCommands, actions: ChannelActions) {
    this.commands = commands;
    this.actions = actions;
  }

  private enqueue(msg: FrontendBalanceBoardEvent) {
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
      this.channel = null;
      this.discardPending();
      throw e;
    }
  }

  async stop() {
    try {
      await this.commands.stop();
    } finally {
      // Drop the channel even if the backend refused, so stale frames cannot reach the store
      // and the next start does not race against this one.
      this.channel = null;
      this.discardPending();
      this.actions.clear();
    }
  }
}

export const sessionChannelManager = new BalanceBoardChannelManager(
  {
    start: commands.session.startSession,
    stop: commands.session.stopSession,
  },
  getSessionActions(),
);

export const replayChannelManager = new BalanceBoardChannelManager(
  {
    start: commands.replay.startReplay,
    stop: commands.replay.stopReplay,
  },
  getReplayActions(),
);
