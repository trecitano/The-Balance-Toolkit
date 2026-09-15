import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionPanel } from "./SessionPanel";
import { SessionQuery, ActivitiesQuery, useSaveConfiguration } from "@/queries/toolkit";
import { useBoardDisplay } from "@/hooks/useBoardDisplay";
import { useDraftFields } from "@/hooks/useDraftFields";
import { QueryStatus } from "@/components/QueryStatus";
import { sessionChannelManager } from "@/services/BalanceBoardChannelManager";
import BoardGrid from "../BoardGrid";
import { useSessionDataStore } from "@/store/sessionDataStore";
import { TimelinePanel } from "../TimelinePanel";
import { DraftNotice } from "@/pages/session/ProcessingFields.tsx";

export default function SessionPage() {
  const drafts = useDraftFields();
  const query = useQuery(SessionQuery);
  const activityQuery = useQuery(ActivitiesQuery);
  const client = useQueryClient();
  const save = useSaveConfiguration("session");
  const information = query.data?.sessionInformation;
  const boards = information?.selectedBoards ?? [];
  const display = useBoardDisplay(boards);
  if (
    query.isPending ||
    activityQuery.isPending ||
    (!query.data && query.error) ||
    (!activityQuery.data && activityQuery.error)
  )
    return (
      <QueryStatus
        pending={query.isPending || activityQuery.isPending}
        error={query.error || activityQuery.error}
        onRetry={() => {
          void query.refetch();
          void activityQuery.refetch();
        }}
      />
    );
  const activities = activityQuery.data ?? [];
  const running = information?.hasOngoingSession ?? false;
  return (
    <div className="flex h-full flex-col gap-5">
      <SessionPanel
        {...display}
        onDraftChange={drafts.onDraftChange}
        activityOptions={activities.map((activity) => ({ label: activity.title, value: activity.id }))}
        userOptions={information?.availableUsers ?? []}
        disabled={running || save.isPending || !information}
        value={information?.core ?? null}
        onChange={save.mutateAsync}
      />
      <QueryStatus error={save.error || query.error || activityQuery.error} />
      {save.isPending && <p role="status">Saving configuration…</p>}
      <DraftNotice show={drafts.hasDrafts} />
      <TimelinePanel
        activity={activities.find((activity) => activity.id === information?.core.activityId)}
        playButtonClass="size-6 rounded-full bg-[#e50012]"
        placeholderMessage="No activity selected"
        hasOngoingSession={running}
        canStart={boards.length > 0 && !save.isPending && !drafts.hasDrafts}
        onStart={async () => {
          await sessionChannelManager.start();
          await client.invalidateQueries(SessionQuery);
        }}
        onStop={async () => {
          await sessionChannelManager.stop();
          await client.invalidateQueries(SessionQuery);
        }}
      />
      <BoardGrid selectedBoards={boards} displayBoards={display.displayBoards} store={useSessionDataStore} />
    </div>
  );
}
