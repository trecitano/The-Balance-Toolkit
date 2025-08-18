import { useState } from "react";

import "./Activities.css";
import ActivityCard from "./ActivityCard";

import Heading from "@/components/PageTitle.tsx";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";

export const ACTIVITIES_QUERY_KEY = ["activities"];

export default function Activities() {
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ACTIVITIES_QUERY_KEY,
    queryFn: async () => {
      const activities = await commands.activity.getActivities();
      return { activities };
    },
  });

  if (isLoading) {
    return <div></div>;
  }

  if (error) {
    return <div></div>;
  }

  const activities = data?.activities ?? [];

  return (
    <>
      <header className="mb-6">
        <Heading>Activities</Heading>
      </header>
      <div className="grid grid-cols-3 gap-10 px-20">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            maximized={maximizedId === activity.id}
            onMaximize={() => setMaximizedId(activity.id)}
            onMinimize={() => setMaximizedId(null)}
          />
        ))}
      </div>
    </>
  );
}
