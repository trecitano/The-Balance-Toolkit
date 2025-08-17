import { useState } from "react";

import "./Activities.css";
import ActivityCard from "./ActivityCard";

import activitiesConfig from "../../config/activities.config";
import Heading from "@/components/PageTitle.tsx";

export default function Activities() {
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  return (
    <>
      <header className="mb-6">
        <Heading>Activities</Heading>
      </header>
      <div className="grid grid-cols-3 gap-10 px-20">
        {Object.values(activitiesConfig).map((activity, idx) => (
          <ActivityCard
            key={idx}
            activity={activity}
            maximized={maximizedId === activity.id}
            onMaximize={() => setMaximizedId(activity.id)}
            onMinimize={() => setMaximizedId(null)}
            index={idx}
          />
        ))}
      </div>
    </>
  );
}
