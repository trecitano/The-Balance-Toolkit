/**
 * Configuration file for balance assessment activities
 * 
 * This file defines all the available activities and their default action blocks.
 * Each activity has a unique key, title, description, and a sequence of action blocks
 * that define the protocol for performing the activity.
 */

/**
 * Represents a single action block within an activity timeline
 */
export interface ActionBlock {
  id: number;
  title: string;   // Human-readable title (e.g., "Step onto board")
  label: string;   // Machine-readable identifier (e.g., "step-onto-board")
  start: number;   // Start time in seconds
  duration: number; // Duration in seconds
  image?: string;  // Path to the image for the action block
}

/**
 * Represents the configuration for a balance assessment activity
 */
export interface ActivityConfig {
  title: string;             // Display name of the activity
  defaultBlocks: ActionBlock[]; // Sequence of action blocks for this activity
  boardsRequired?: number;   // Number of balance boards needed (default: 1)
  description?: string;      // Brief description of the activity purpose
}

/**
 * Registry of all available assessment activities
 * 
 * Keys should be kebab-case and match the folder names in the assets structure
 */
const activitiesConfig: Record<string, ActivityConfig> = {
  // Quiet standing assessment (eyes open and closed)
  "quiet-standing": {
    title: "Quiet standing (eyes-close + eyes-open)",
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
  "tug": {
    title: "Timed Up and Go (TUG)",
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
  "single-leg-stance": {
    title: "Single leg stance",
    boardsRequired: 1,
    description: "Assess balance while standing on one leg",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Stand on One Leg", label: "stand-on-one-leg", start: 10, duration: 20 },
    ],
  },
  
  // Tandem stance assessment
  "tandem-stance": {
    title: "Tandem stance",
    boardsRequired: 1,
    description: "Assess balance with feet in tandem position",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Tandem Stand", label: "tandem-stand", start: 10, duration: 20 },
      { id: 4, title: "Return to Normal Stance", label: "return-to-normal-stance", start: 30, duration: 5 },
    ],
  },
  
  // Functional reach test
  "functional-reach": {
    title: "Functional Reach Test",
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
  "dynamic-weight-shifting": {
    title: "Dynamic weight shifting",
    boardsRequired: 1,
    description: "Assess controlled weight shifting ability",
    defaultBlocks: [
      { id: 1, title: "Tare", label: "tare", start: 0, duration: 5 },
      { id: 2, title: "Step onto board", label: "step-onto-board", start: 5, duration: 5 },
      { id: 3, title: "Shift Weight", label: "shift-weight", start: 10, duration: 20 },
    ],
  },
};

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
  const activity = Object.values(activitiesConfig).find(
    (activity) => activity.title === activityTitle
  );
  
  // If found, return a copy of its default blocks
  if (activity) {
    return [...activity.defaultBlocks];
  }
  
  // If not found, return a copy of the default blocks
  return [...defaultActionBlocks];
}

/**
 * Gets the full activity configuration by title
 * 
 * @param activityTitle The title of the activity
 * @returns The activity configuration or undefined if not found
 */
export function getActivityConfigByTitle(activityTitle: string): ActivityConfig | undefined {
  return Object.values(activitiesConfig).find(
    (activity) => activity.title === activityTitle
  );
}

// Export the activities configuration as the default export
export default activitiesConfig;
