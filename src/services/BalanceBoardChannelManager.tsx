import { Channel } from "@tauri-apps/api/core";
import {RawBalanceBoardEvent, ProcessedBoardEvent, BalanceBoardEvent} from "@/types";
import { commands } from "@/utils/requests";
import { useSessionActions, useReplayActions } from "@/store/sessionDataStore";

type ChannelCommands = {
  start: (ch: Channel<BalanceBoardEvent>) => Promise<unknown>;
  stop: () => Promise<unknown>;
};

type ChannelActions = {
  pushRawFrame: (f: RawBalanceBoardEvent) => void;
  pushProcessedFrame: (f: ProcessedBoardEvent) => void;
  clear: () => void;
};

class BalanceBoardChannelManager {
  private channel: Channel<RawBalanceBoardEvent | ProcessedBoardEvent> | null = null;
  private readonly commands: ChannelCommands;
  private readonly actions: ChannelActions;

  constructor(commands: ChannelCommands, actions: ChannelActions) {
    this.commands = commands;
    this.actions = actions;
  }

  async start() {
    const { pushRawFrame, pushProcessedFrame } = this.actions;

    this.channel = new Channel<RawBalanceBoardEvent | ProcessedBoardEvent>();
    this.channel.onmessage = (msg) => {
      requestAnimationFrame(() => {
        if (msg.event === "raw") {
          pushRawFrame(msg as RawBalanceBoardEvent);
        } else if (msg.event === "processed") {
          pushProcessedFrame(msg as ProcessedBoardEvent);
        }
      });
    };

    try {
      await this.commands.start(this.channel);
    } catch (e) {
      console.error("Failed to start session", e);
    }
  }

  async stop() {
    try {
      await this.commands.stop();
      this.actions.clear();
    } catch (e) {
      console.warn("Failed to stop session", e);
    }

    this.channel = null;
  }
}

export const sessionChannelManager = new BalanceBoardChannelManager(
  {
    start: commands.session.startSession,
    stop: commands.session.stopSession,
  },
  useSessionActions()
  );

export const replayChannelManager = new BalanceBoardChannelManager(
  {
    start: commands.replay.startReplay,
    stop: commands.replay.stopReplay,
  },
  useReplayActions()
);