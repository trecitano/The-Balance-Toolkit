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
import activitiesConfig from "../../config/activities.config";

// Import specific SVG images for each activity card
// Quiet Standing
import quietStanding1 from "../../assets/activities/quiet-standing/quiet-standing-1-tare.svg";
import quietStanding2 from "../../assets/activities/quiet-standing/quiet-standing-2-step-onto-board.svg";
import quietStanding3 from "../../assets/activities/quiet-standing/quiet-standing-3-stand-eyes-open.svg";
import quietStanding4 from "../../assets/activities/quiet-standing/quiet-standing-4-stand-eyes-closed.svg";

// TUG
import tug1 from "../../assets/activities/tug/tug-1-tare.svg";
import tug2 from "../../assets/activities/tug/tug-2-step-onto-board.svg";
import tug3 from "../../assets/activities/tug/tug-3-stand-up.svg";
import tug4 from "../../assets/activities/tug/tug-4-walk-forward.svg";
import tug5 from "../../assets/activities/tug/tug-5-turn-around.svg";
import tug6 from "../../assets/activities/tug/tug-6-walk-back.svg";
import tug7 from "../../assets/activities/tug/tug-7-sit-down.svg";

// Single Leg Stance
import singleLeg1 from "../../assets/activities/single-leg-stance/single-leg-stance-1-tare.svg";
import singleLeg2 from "../../assets/activities/single-leg-stance/single-leg-stance-2-stand-with-both-legs.svg";
import singleLeg3 from "../../assets/activities/single-leg-stance/single-leg-stance-3-left-leg-up.svg";
import singleLeg4 from "../../assets/activities/single-leg-stance/single-leg-stance-4-stand-with-both-legs.svg";
import singleLeg5 from "../../assets/activities/single-leg-stance/single-leg-stance-5-right-leg-up.svg";
import singleLeg6 from "../../assets/activities/single-leg-stance/single-leg-stance-6-stand-with-both-legs.svg";

// Tandem Stance
import tandem1 from "../../assets/activities/tandem-stance/tandem-stance-1-tare.svg";
import tandem2 from "../../assets/activities/tandem-stance/tandem-stance-2-step-onto-board.svg";
import tandem3 from "../../assets/activities/tandem-stance/tandem-stance-3-left-leg-in-front.svg";
import tandem4 from "../../assets/activities/tandem-stance/tandem-stance-4-stand-with-both-legs.svg";
import tandem5 from "../../assets/activities/tandem-stance/tandem-stance-5-right-leg-in-front.svg";
import tandem6 from "../../assets/activities/tandem-stance/tandem-stance-6-stand-with-both-legs.svg";

// Functional Reach Test
import functionalReach1 from "../../assets/activities/functional-reach-test/functional-reach-test-1-tare.svg";
import functionalReach2 from "../../assets/activities/functional-reach-test/functional-reach-test-2-left-arm-up.svg";
import functionalReach3 from "../../assets/activities/functional-reach-test/functional-reach-test-3-left-arm-reach.svg";
import functionalReach4 from "../../assets/activities/functional-reach-test/functional-reach-test-4-left-arm-up.svg";
import functionalReach5 from "../../assets/activities/functional-reach-test/functional-reach-test-5-right-arm-up.svg";
import functionalReach6 from "../../assets/activities/functional-reach-test/functional-reach-test-6-right-arm-reach.svg";

// Dynamic Weight Shifting
import dynamicWeight1 from "../../assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-1-tare.svg";
import dynamicWeight2 from "../../assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-2-step-onto-board.svg";
import dynamicWeight3 from "../../assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-3-lean-forward.svg";
import dynamicWeight4 from "../../assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-4-stand-upright.svg";
import dynamicWeight5 from "../../assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-5-lean-backwards.svg";
import dynamicWeight6 from "../../assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-6-lean-left.svg";
import dynamicWeight7 from "../../assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-7-lean-right.svg";

export interface ActivityData {
  id: number;
  title: string;
  staticImage: string;
  hoverImages: string[];
  sequenceImages?: string[]; // Array of SVG images in sequence for the activity
  description: string;
  boardsRequired: number; // Number of balance boards required for this activity
  activityName?: string;  // The folder/identifier name for the activity (e.g., 'quiet-standing')
}

// Hardcoded image mappings for each activity
const activityImageMappings = {
  'quiet-standing': {
    staticImage: quietStanding3, // Stand with eyes open as the main image
    sequenceImages: [quietStanding3, quietStanding4],
  },
  'tug': {
    staticImage: tug2, // Stand up as the main image
    sequenceImages: [tug3, tug4, tug5, tug6, tug2],
  },
  'single-leg-stance': {
    staticImage: singleLeg3, // Left leg up as the main image
    sequenceImages: [singleLeg3, singleLeg4, singleLeg5, singleLeg6],
  },
  'tandem-stance': {
    staticImage: tandem3, // Left leg in front as the main image
    sequenceImages: [tandem2, tandem3, tandem4, tandem5],
  },
  'functional-reach-test': {
    staticImage: functionalReach3, // Left arm reach as the main image
    sequenceImages: [functionalReach3, functionalReach2],
  },
  'dynamic-weight-shifting': {
    staticImage: dynamicWeight3, // Stand upright as the main image
    sequenceImages: [dynamicWeight3, dynamicWeight4, dynamicWeight5, dynamicWeight6, dynamicWeight7],
  },
};

/**
 * Helper function to get all sequence images for an activity
 * @param activityName The name of the activity (e.g., 'quiet-standing')
 * @returns Array of image URLs for the activity
 */
export function getActivityImages(activityName: string): string[] {
  const mapping = activityImageMappings[activityName as keyof typeof activityImageMappings];
  return mapping ? mapping.sequenceImages : [];
}

/**
 * Helper function to get action-specific images from the activity
 * For now, this returns all sequence images since we don't have action-specific mappings
 * @param activityName The name of the activity (e.g., 'quiet-standing')
 * @param actionLabel The label of the action (currently unused)
 * @returns Array of image URLs for the activity
 */
export function getActionImages(activityName: string, actionLabel: string): string[] {
  // For now, return all sequence images regardless of action label
  return getActivityImages(activityName);
}

/**
 * Helper function to get action-specific image or fall back to default
 * @param activityName The name of the activity (e.g., 'quiet-standing')
 * @param actionLabel The label of the action (currently unused)
 * @returns The static image for the activity
 */
export function getActionImage(activityName: string, actionLabel: string): string | undefined {
  const mapping = activityImageMappings[activityName as keyof typeof activityImageMappings];
  return mapping ? mapping.staticImage : undefined;
}

export default function Activities() {
  const [maximizedId, setMaximizedId] = useState<number | null>(null);

  const activitiesData: ActivityData[] = [
    {
      id: 1,
      title: activitiesConfig["quiet-standing"].title,
      staticImage: activityImageMappings['quiet-standing'].staticImage,
      hoverImages: [activitiesIcon, lightIcon, activitiesIcon, fileIcon, settingsIcon, wbbIcon],
      description: activitiesConfig["quiet-standing"].description || "Assess stability while standing still with eyes open and closed.",
      boardsRequired: activitiesConfig["quiet-standing"].boardsRequired || 1,
      sequenceImages: activityImageMappings['quiet-standing'].sequenceImages,
      activityName: 'quiet-standing',
    },
    {
      id: 2,
      title: activitiesConfig["tug"].title,
      staticImage: activityImageMappings['tug'].staticImage,
      hoverImages: [bookIcon, bookmarkIcon, bookIcon],
      description: activitiesConfig["tug"].description || "Measure mobility and balance by timing the 'up and go' sequence.",
      boardsRequired: activitiesConfig["tug"].boardsRequired || 1,
      sequenceImages: activityImageMappings['tug'].sequenceImages,
      activityName: 'tug',
    },
    {
      id: 3,
      title: activitiesConfig["single-leg-stance"].title,
      staticImage: activityImageMappings['single-leg-stance'].staticImage,
      hoverImages: [wbbIcon, logoIcon, wbbIcon],
      description: activitiesConfig["single-leg-stance"].description || "Evaluate balance by standing on one leg for a period of time.",
      boardsRequired: activitiesConfig["single-leg-stance"].boardsRequired || 1,
      sequenceImages: activityImageMappings['single-leg-stance'].sequenceImages,
      activityName: 'single-leg-stance',
    },
    {
      id: 4,
      title: activitiesConfig["tandem-stance"].title,
      staticImage: activityImageMappings['tandem-stance'].staticImage,
      hoverImages: [homeIcon, lightIcon, homeIcon],
      description: activitiesConfig["tandem-stance"].description || "Test balance by standing with one foot directly in front of the other.",
      boardsRequired: activitiesConfig["tandem-stance"].boardsRequired || 1,
      sequenceImages: activityImageMappings['tandem-stance'].sequenceImages,
      activityName: 'tandem-stance',
    },
    {
      id: 5,
      title: activitiesConfig["functional-reach"].title,
      staticImage: activityImageMappings['functional-reach-test'].staticImage,
      hoverImages: [fileIcon, settingsIcon, fileIcon],
      description: activitiesConfig["functional-reach"].description || "Measure forward reach distance to assess balance and stability limits.",
      boardsRequired: activitiesConfig["functional-reach"].boardsRequired || 1,
      sequenceImages: activityImageMappings['functional-reach-test'].sequenceImages,
      activityName: 'functional-reach-test',
    },
    {
      id: 6,
      title: activitiesConfig["dynamic-weight-shifting"].title,
      staticImage: activityImageMappings['dynamic-weight-shifting'].staticImage,
      hoverImages: [activitiesIcon, sessionIcon, activitiesIcon],
      description: activitiesConfig["dynamic-weight-shifting"].description || "Assess the ability to shift weight effectively while maintaining balance.",
      boardsRequired: activitiesConfig["dynamic-weight-shifting"].boardsRequired || 2,
      sequenceImages: activityImageMappings['dynamic-weight-shifting'].sequenceImages,
      activityName: 'dynamic-weight-shifting',
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
