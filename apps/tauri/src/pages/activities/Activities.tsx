import { useState } from "react";
import ActivityCard from "./ActivityCard";
import ActivityEdit from "./ActivityEdit";
import PageTitle from "@/components/PageTitle.tsx";
import { useQuery } from "@tanstack/react-query";
import { ActivitiesQuery, BlocksQuery } from "@/queries/toolkit";
import { QueryStatus } from "@/components/QueryStatus";
import { useParams } from "react-router-dom";

export default function Activities() {
  const { activityId } = useParams<{ activityId?: string }>();
  const [maximizedId, setMaximizedId] = useState<string | null>(activityId || null);

  const activitiesQuery = useQuery(ActivitiesQuery);
  const blocksQuery = useQuery(BlocksQuery);
  if (
    activitiesQuery.isPending ||
    blocksQuery.isPending ||
    (!activitiesQuery.data && activitiesQuery.error) ||
    (!blocksQuery.data && blocksQuery.error)
  ) {
    return (
      <QueryStatus
        pending={activitiesQuery.isPending || blocksQuery.isPending}
        error={activitiesQuery.error || blocksQuery.error}
        onRetry={() => {
          void activitiesQuery.refetch();
          void blocksQuery.refetch();
        }}
      />
    );
  }
  const activities = activitiesQuery.data ?? [];
  const existingTimeBlocks = blocksQuery.data ?? [];
  const maximizedActivity = activities.find((a) => a.id === maximizedId);

  return (
    <div className="flex h-full flex-col">
      <header className="mb-5">
        <PageTitle>Activities</PageTitle>
      </header>

      <QueryStatus error={activitiesQuery.error || blocksQuery.error} />
      {maximizedActivity ? (
        <ActivityEdit
          key={maximizedActivity.id}
          activity={maximizedActivity}
          onClose={() => setMaximizedId(null)}
          existingActionImages={existingTimeBlocks}
        />
      ) : (
        <div className="grid min-h-0 grid-cols-3 grid-rows-2 gap-10">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} onOpen={() => setMaximizedId(activity.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
