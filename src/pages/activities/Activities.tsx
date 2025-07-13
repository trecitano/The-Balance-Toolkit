import { useState } from "react";

import "./Activities.css";
import ActivityCard from "./ActivityCard";

import activitiesIcon from "../../assets/activities-icon.svg";
import lightIcon from "../../assets/light-icon.svg";
import bookIcon from "../../assets/book-icon.svg";
import bookmarkIcon from "../../assets/book-bookmark-icon.svg";
import wbbIcon from "../../assets/wbb-icon-line.svg";
import logoIcon from "../../assets/balance-icon.svg";
import homeIcon from "../../assets/home-icon.svg";
import fileIcon from "../../assets/file-icon.svg";
import settingsIcon from "../../assets/settings-icon.svg";
import sessionIcon from "../../assets/session-icon.svg";

// Use dynamic imports to get all SVGs from activity folders
// Using absolute path format for Vite's import.meta.glob
const activityImageModules = import.meta.glob('/src/assets/activities/**/*.svg', { eager: true });

export interface ActivityData {
  id: number;
  title: string;
  staticImage: string;
  hoverImages: string[];
  sequenceImages?: string[]; // Array of SVG images in sequence for the activity
  description: string;
  boardsRequired: number; // Number of balance boards required for this activity
}

// Helper function to get all SVGs from a specific activity folder
function getActivityImages(activityName: string): string[] {
  const images: string[] = [];
  const regex = new RegExp(`/src/assets/activities/${activityName}/${activityName}\\d+\\.svg$`);
  
  // Sort function to order by number in filename
  const sortByNumber = (a: string, b: string) => {
    const aMatch = a.match(/(\d+)\.svg$/);
    const bMatch = b.match(/(\d+)\.svg$/);
    if (aMatch && bMatch) {
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    }
    return a.localeCompare(b);
  };
  
  // Log for debugging
  console.log(`Looking for images in activity folder: ${activityName}`);
  
  // Find all matching SVGs for this activity
  Object.entries(activityImageModules).forEach(([path, module]) => {
    if (regex.test(path)) {
      // @ts-ignore
      images.push(module.default);
      console.log(`Found image: ${path}`);
    }
  });
  
  console.log(`Found ${images.length} images for ${activityName}`);
  
  // Sort images by their number
  return images.sort(sortByNumber);
}

export default function Activities() {
  const [maximizedId, setMaximizedId] = useState<number | null>(null);

  const activitiesData: ActivityData[] = [
    {
      id: 1,
      title: "Quiet standing (eyes-close + eyes-open)",
      staticImage: getActivityImages('quiet-standing')[0] || activitiesIcon,
      hoverImages: [
        activitiesIcon,
        lightIcon,
        activitiesIcon,
        fileIcon,
        settingsIcon,
        wbbIcon,
      ],
      description:
        "Assess stability while standing still with eyes open and closed.",
      boardsRequired: 1,
      sequenceImages: getActivityImages('quiet-standing'),
    },
    {
      id: 2,
      title: "Timed Up and Go (TUG)",
      staticImage: getActivityImages('tug')[0] || bookIcon,
      hoverImages: [bookIcon, bookmarkIcon, bookIcon],
      description:
        "Measure mobility and balance by timing the 'up and go' sequence.",
      boardsRequired: 1,
      sequenceImages: getActivityImages('tug'),
    },
    {
      id: 3,
      title: "Single leg stance",
      staticImage: getActivityImages('single-leg-stance')[0] || wbbIcon,
      hoverImages: [wbbIcon, logoIcon, wbbIcon],
      description:
        "Evaluate balance by standing on one leg for a period of time.",
      boardsRequired: 1,
      sequenceImages: getActivityImages('single-leg-stance'),
    },
    {
      id: 4,
      title: "Tandem stance",
      staticImage: getActivityImages('tandem-stance')[0] || homeIcon,
      hoverImages: [homeIcon, lightIcon, homeIcon],
      description:
        "Test balance by standing with one foot directly in front of the other.",
      boardsRequired: 1,
      sequenceImages: getActivityImages('tandem-stance'),
    },
    {
      id: 5,
      title: "Functional Reach Test",
      staticImage: getActivityImages('functional-reach-test')[0] || fileIcon,
      hoverImages: [fileIcon, settingsIcon, fileIcon],
      description:
        "Measure forward reach distance to assess balance and stability limits.",
      boardsRequired: 1,
      sequenceImages: getActivityImages('functional-reach-test'),
    },
    {
      id: 6,
      title: "Dynamic weight shifting",
      staticImage: getActivityImages('dynamic-weight-shifting')[0] || activitiesIcon,
      hoverImages: [activitiesIcon, sessionIcon, activitiesIcon],
      description:
        "Assess the ability to shift weight effectively while maintaining balance.",
      boardsRequired: 2,
      sequenceImages: getActivityImages('dynamic-weight-shifting'),
    },
  ];

  return (
    <div className="inside-page">
      <div className="page-header">
        <span className="page-title">Activities</span>
      </div>
      <div className="main-content" style={{ position: "relative" }}>
        <div className="activities-grid">
          {activitiesData.map((activity, idx) => (
            <ActivityCard
              key={activity.id}
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
