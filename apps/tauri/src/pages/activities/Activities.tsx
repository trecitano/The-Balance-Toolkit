import { useState } from "react";
import ActivityCard from "./ActivityCard";
import ActivityEdit from "./ActivityEdit";
import PageTitle from "@/components/PageTitle.tsx";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { useParams } from "react-router-dom";

export const ACTIVITIES_QUERY_KEY = ["activities"];
const AVAILABLE_BLOCKS_QUERY_KEY = ["available-blocks"];

export default function Activities() {
  const { activityId } = useParams<{ activityId?: string }>();
  const [maximizedId, setMaximizedId] = useState<string | null>(activityId || null);

  const {
    data: activitiesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ACTIVITIES_QUERY_KEY,
    queryFn: async () => {
      const activities = await commands.activity.getActivities();
      return { activities };
    },
  });

  const { data: timeBlocksData } = useQuery({
    queryKey: AVAILABLE_BLOCKS_QUERY_KEY,
    queryFn: async () => {
      return await commands.activity.getAvailableTimeBlocks();
    },
    staleTime: Infinity,
  });

  if (isLoading || error) {
    return <div></div>;
  }

  const activities = activitiesData?.activities ?? [];
  const existingTimeBlocks = timeBlocksData ?? [];
  const maximizedActivity = activities.find((a) => a.id === maximizedId);

  return (
    <div className="flex h-full flex-col">
      <header className="mb-5">
        <PageTitle>Activities</PageTitle>
      </header>

      {maximizedActivity ? (
        <ActivityEdit
          activity={maximizedActivity}
          open={!!maximizedId}
          onClose={() => setMaximizedId(null)}
          existingActionImages={existingTimeBlocks}
        />
      ) : (
        <div className="grid min-h-0 grid-cols-3 grid-rows-2 gap-10">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onOpen={() => setMaximizedId(activity.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}