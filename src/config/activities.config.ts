/**
 * Configuration file for balance assessment activities
 *
 * This file defines all the available activities and their default action blocks.
 * Each activity has a unique key, title, description, and a sequence of action blocks
 * that define the protocol for performing the activity.
 */

import quietStanding3 from "@/assets/activities/quiet-standing/quiet-standing-3-stand-eyes-open.svg";
import quietStanding4 from "@/assets/activities/quiet-standing/quiet-standing-4-stand-eyes-closed.svg";
import tug2 from "@/assets/activities/tug/tug-2-step-onto-board.svg";
import tug3 from "@/assets/activities/tug/tug-3-stand-up.svg";
import tug4 from "@/assets/activities/tug/tug-4-walk-forward.svg";
import tug5 from "@/assets/activities/tug/tug-5-turn-around.svg";
import tug6 from "@/assets/activities/tug/tug-6-walk-back.svg";
import singleLeg3 from "@/assets/activities/single-leg-stance/single-leg-stance-3-left-leg-up.svg";
import singleLeg4 from "@/assets/activities/single-leg-stance/single-leg-stance-4-stand-with-both-legs.svg";
import singleLeg5 from "@/assets/activities/single-leg-stance/single-leg-stance-5-right-leg-up.svg";
import singleLeg6 from "@/assets/activities/single-leg-stance/single-leg-stance-6-stand-with-both-legs.svg";
import tandem3 from "@/assets/activities/tandem-stance/tandem-stance-3-left-leg-in-front.svg";
import tandem2 from "@/assets/activities/tandem-stance/tandem-stance-2-step-onto-board.svg";
import tandem4 from "@/assets/activities/tandem-stance/tandem-stance-4-stand-with-both-legs.svg";
import tandem5 from "@/assets/activities/tandem-stance/tandem-stance-5-right-leg-in-front.svg";
import functionalReach3 from "@/assets/activities/functional-reach-test/functional-reach-test-3-left-arm-reach.svg";
import functionalReach2 from "@/assets/activities/functional-reach-test/functional-reach-test-2-left-arm-up.svg";
import dynamicWeight3 from "@/assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-3-lean-forward.svg";
import dynamicWeight4 from "@/assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-4-stand-upright.svg";
import dynamicWeight5 from "@/assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-5-lean-backwards.svg";
import dynamicWeight6 from "@/assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-6-lean-left.svg";
import dynamicWeight7 from "@/assets/activities/dynamic-weight-shifting/dynamic-weight-shifting-7-lean-right.svg";
import activitiesIcon from "@/assets/activities-icon.svg";
import lightIcon from "@/assets/light-icon.svg";
import fileIcon from "@/assets/file-icon.svg";
import settingsIcon from "@/assets/settings-icon.svg";
import wbbIcon from "@/assets/wbb-icon-line.svg";
import bookIcon from "@/assets/book-icon.svg";
import bookmarkIcon from "@/assets/book-bookmark-icon.svg";
import logoIcon from "@/assets/balance-icon.svg";
import homeIcon from "@/assets/home-icon.svg";
import sessionIcon from "@/assets/session-icon.svg";

/**
 * Represents a single action block within an activity timeline
 */
export interface ActionBlock {
  id: number;
  title: string; // Human-readable title (e.g., "Step onto board")
  label: string; // Machine-readable identifier (e.g., "step-onto-board")
  start: number; // Start time in seconds
  duration: number; // Duration in seconds
  image?: string; // Path to the image for the action block
}

/**
 * Represents the configuration for a balance assessment activity
 */
export interface ActivityConfig {
  id: string;
  title: string; // Display name of the activity
  staticImage: string; // A SVG file
  sequenceImages: string[]; // Multiple SVG files
  hoverImages: string[];
  defaultBlocks: ActionBlock[]; // Sequence of action blocks for this activity
  boardsRequired: number; // Number of balance boards needed (default: 1)
  description?: string; // Brief description of the activity purpose
}

/**
 * Registry of all available assessment activities
 *
 * Keys should be kebab-case and match the folder names in the assets structure
 */
const activitiesConfig: ActivityConfig[] = [
  // Quiet standing assessment (eyes open and closed)
  {
    id: "quiet-standing",
    title: "Quiet standing (eyes-close + eyes-open)",
    staticImage: quietStanding3, // Stand with eyes open as the main image
    sequenceImages: [quietStanding3, quietStanding4],
    hoverImages: [activitiesIcon, lightIcon, activitiesIcon, fileIcon, settingsIcon, wbbIcon],
    boardsRequired: 1,
    description: "Assess balance during quiet standing with eyes open and closed",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Stand - Eyes Open", label: "stand-eyes-open", start: 10, duration: 20 },
      { id: 4, title: "Stand - Eyes Closed", label: "stand-eyes-closed", start: 30, duration: 20 },
    ],
  },

  // Timed Up and Go assessment
  {
    id: "tug",
    title: "Timed Up and Go (TUG)",
    staticImage: tug2,
    sequenceImages: [tug3, tug4, tug5, tug6, tug2],
    hoverImages: [bookIcon, bookmarkIcon, bookIcon],
    boardsRequired: 1,
    description: "Evaluate mobility and fall risk",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Stand Up", label: "stand-up", start: 10, duration: 5 },
      { id: 4, title: "Walk Forward", label: "walk-forward", start: 15, duration: 10 },
      { id: 5, title: "Turn Around", label: "turn-around", start: 25, duration: 5 },
      { id: 6, title: "Walk Back", label: "walk-back", start: 30, duration: 10 },
      { id: 7, title: "Sit Down", label: "sit-down", start: 40, duration: 5 },
    ],
  },
  // Single leg stance assessment
  {
    id: "single-leg-stance",
    title: "Single leg stance",
    staticImage: singleLeg3,
    sequenceImages: [singleLeg3, singleLeg4, singleLeg5, singleLeg6],
    hoverImages: [wbbIcon, logoIcon, wbbIcon],
    boardsRequired: 1,
    description: "Assess balance while standing on one leg",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Stand on One Leg", label: "stand-on-one-leg", start: 10, duration: 20 },
    ],
  },

  // Tandem stance assessment
  {
    id: "tandem-stance",
    title: "Tandem stance",
    staticImage: tandem3,
    sequenceImages: [tandem2, tandem3, tandem4, tandem5],
    hoverImages: [homeIcon, lightIcon, homeIcon],
    boardsRequired: 1,
    description: "Assess balance with feet in tandem position",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Tandem Stand", label: "tandem-stand", start: 10, duration: 20 },
      {
        id: 4,
        title: "Return to Normal Stance",
        label: "return-to-normal-stance",
        start: 30,
        duration: 5,
      },
    ],
  },

  // Functional reach test
  {
    id: "functional-reach",
    title: "Functional Reach Test",
    staticImage: functionalReach3,
    sequenceImages: [functionalReach3, functionalReach2],
    hoverImages: [fileIcon, settingsIcon, fileIcon],
    boardsRequired: 1,
    description: "Measure reaching capability while maintaining balance",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Reach Forward", label: "reach-forward", start: 10, duration: 10 },
      { id: 4, title: "Return to Start", label: "return-to-start", start: 20, duration: 5 },
    ],
  },

  // Dynamic weight shifting assessment
  {
    id: "dynamic-weight-shifting",
    title: "Dynamic weight shifting",
    staticImage: dynamicWeight3,
    sequenceImages: [dynamicWeight3, dynamicWeight4, dynamicWeight5, dynamicWeight6, dynamicWeight7],
    hoverImages: [activitiesIcon, sessionIcon, activitiesIcon],
    boardsRequired: 1,
    description: "Assess controlled weight shifting ability",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Shift Weight", label: "shift-weight", start: 10, duration: 20 },
    ],
  },
];

/**
 * Default action blocks for activities not explicitly defined
 * Used as a fallback when a specific activity configuration is not found
 */
export const defaultActionBlocks: ActionBlock[] = [
  { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
  { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
  { id: 3, title: "Main Action", label: "main-action", start: 10, duration: 20 },
];

/**
 * Gets the default blocks for an activity by its title
 *
 * @param activityTitle The title of the activity
 * @returns The default action blocks for the activity (cloned to prevent modification of originals)
 */
export function getDefaultBlocksByTitle(activityTitle: string): ActionBlock[] {
  // First try to find the activity by exact title match
  const activity = Object.values(activitiesConfig).find((activity) => activity.title === activityTitle);

  // If found, return a copy of its default blocks
  if (activity) {
    return [...activity.defaultBlocks];
  }

  // If not found, return a copy of the default blocks
  return [...defaultActionBlocks];
}

// Export the activities configuration as the default export
export default activitiesConfig;
