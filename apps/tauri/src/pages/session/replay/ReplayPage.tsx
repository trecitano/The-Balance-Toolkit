import { useState } from "react";
import { ReplayQuery, useSaveConfiguration } from "@/queries/toolkit";
import { useBoardDisplay } from "@/hooks/useBoardDisplay";
import { useDraftFields } from "@/hooks/useDraftFields";
import { useAction } from "@/hooks/useAction";
import { QueryStatus } from "@/components/QueryStatus";
import { ReplayPanel } from "./ReplayPanel.tsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { replayChannelManager } from "@/services/BalanceBoardChannelManager.tsx";
import BoardGrid from "@/pages/session/BoardGrid.tsx";
import { useReplayDataStore } from "@/store/sessionDataStore.tsx";
import { TimelinePanel } from "@/pages/session/TimelinePanel.tsx";
import { open } from "@tauri-apps/plugin-dialog";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { DraftNotice } from "@/pages/session/ProcessingFields.tsx";

export default function ReplayPage() {
  const [panelRevision, setPanelRevision] = useState(0);
  const drafts = useDraftFields();
  const query = useQuery(ReplayQuery);
  const replayInformation = query.data ?? null;
  const queryClient = useQueryClient();
  const updateReplay = useSaveConfiguration("replay");
  // Loading or clearing a file replaces the whole configuration, so the panel is remounted
  // and any numeric drafts are dropped.
  const fileAction = useAction(async () => {
    setPanelRevision((previous) => previous + 1);
    drafts.clearDrafts();
    await queryClient.invalidateQueries(ReplayQuery);
  });
  const selectedBoards = replayInformation?.devices ?? [];
  const display = useBoardDisplay(selectedBoards);
  const busy = updateReplay.isPending || fileAction.isPending;
  const chosenActivity = replayInformation?.activity;
  const hasOngoingSession = replayInformation?.hasOngoingSession ?? false;
  const replayIsSelected = !!replayInformation?.filePath;

  const pickSessionFile = (defaultPath?: string | null) =>
    fileAction.run(async () => {
      const selected = await open({
        directory: false,
        defaultPath: defaultPath ?? "",
        multiple: false,
        filters: [{ name: "Session file", extensions: ["settings.json"] }],
        title: "Select the Session file",
      });
      if (typeof selected === "string") await commands.replay.loadReplayFile(selected);
    });

  if (query.isPending || (!query.data && query.error))
    return <QueryStatus pending={query.isPending} error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="flex h-full flex-col gap-5">
      <ReplayPanel
        onDraftChange={drafts.onDraftChange}
        key={`${replayInformation?.filePath ?? "empty"}:${panelRevision}`}
        config={replayInformation}
        {...display}
        saving={fileAction.isPending}
        onChange={(newState) => updateReplay.mutateAsync(newState.core)}
        onPickSessionFile={pickSessionFile}
        onResetFile={() => fileAction.run(commands.replay.clearReplay)}
      />

      <QueryStatus error={updateReplay.error || fileAction.error || query.error} />
      <DraftNotice show={drafts.hasDrafts} />
      <TimelinePanel
        activity={chosenActivity}
        playButtonClass="border-l-15 border-r-0 border-t-10 border-b-10 border-l-[#e50012] border-t-transparent border-b-transparent"
        hasOngoingSession={hasOngoingSession}
        placeholderMessage={replayIsSelected ? "No Activity" : ""}
        canStart={selectedBoards.length > 0 && !busy && !drafts.hasDrafts}
        onStart={async () => {
          await replayChannelManager.start();
          await queryClient.invalidateQueries(ReplayQuery);
        }}
        onStop={async () => {
          await replayChannelManager.stop();
          await queryClient.invalidateQueries(ReplayQuery);
        }}
      />

      {selectedBoards.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="text-3xl font-medium">No session file selected</p>
          <p className="mb-4 text-xl text-gray-400">Select a session file to replay it!</p>
          <ToolkitButton
            type="button"
            color="grey"
            disabled={busy}
            onClick={() => pickSessionFile(replayInformation?.core?.outputDirectory)}
          >
            Select Replay
          </ToolkitButton>
        </div>
      ) : (
        <BoardGrid selectedBoards={selectedBoards} displayBoards={display.displayBoards} store={useReplayDataStore} />
      )}
    </div>
  );
}
