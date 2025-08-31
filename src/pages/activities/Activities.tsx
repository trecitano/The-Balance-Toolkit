import { useState } from "react";

import "./Activities.css";
import ActivityCard from "./ActivityCard";

import PageTitle from "@/components/PageTitle.tsx";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";

export const ACTIVITIES_QUERY_KEY = ["activities"];
const AVAILABLE_BLOCKS_QUERY_KEY = ["available-blocks"];

export default function Activities() {
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

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

  // Fetch available time blocks (only once, cached forever)
  const { data: timeBlocksData } = useQuery({
    queryKey: AVAILABLE_BLOCKS_QUERY_KEY,
    queryFn: async () => {
      return await commands.activity.getAvailableTimeBlocks();
    },
    staleTime: Infinity,
  });

  if (isLoading) {
    return <div></div>;
  }

  if (error) {
    return <div></div>;
  }

  const activities = activitiesData?.activities ?? [];
  const existingTimeBlocks = timeBlocksData ?? [];

  return (
    <>
      <header className="mb-5">
        <PageTitle>Activities</PageTitle>
      </header>
      <div className="grid h-full grid-cols-3 gap-10">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            maximized={maximizedId === activity.id}
            onMaximize={() => setMaximizedId(activity.id)}
            onMinimize={() => setMaximizedId(null)}
            existingActionImages={existingTimeBlocks}
          />
        ))}
      </div>
    </>
  );
}
