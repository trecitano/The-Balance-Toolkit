import { useState } from "react";

import "./Activities.css";
import ActivityCard from "./ActivityCard";

import activitiesConfig from "../../config/activities.config";

export default function Activities() {
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  return (
    <div className="inside-page">
      <div className="page-header">
        <span className="page-title">Activities</span>
      </div>
      <div className="main-content" style={{ position: "relative" }}>
        <div className="activities-grid">
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
      </div>
    </div>
  );
}
