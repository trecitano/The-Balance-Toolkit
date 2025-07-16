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
  activityName?: string;  // The folder/identifier name for the activity (e.g., 'quiet-standing')
}

/**
 * Interface for image objects used in the helper functions
 */
interface ImageItem {
  path: string;
  image: string;
}

/**
 * Helper function to get all SVGs from a specific activity folder
 * @param activityName The name of the activity (e.g., 'tandem-stance')
 * @returns Array of image URLs for the activity
 */
export function getActivityImages(activityName: string): string[] {
  const images: ImageItem[] = [];
  
  // Match activity images by name pattern
  const regex = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}[\\d\\w-]+\\.svg$`);
  
  // Sort function to order by number in filename
  const sortByNumber = (a: string, b: string) => {
    // Extract the number after the activity name
    const aMatch = a.match(new RegExp(`${activityName}(\\d+)`));
    const bMatch = b.match(new RegExp(`${activityName}(\\d+)`));
    
    if (aMatch && bMatch) {
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    }
    return a.localeCompare(b);
  };
  
  // Find all matching SVGs for this activity
  Object.entries(activityImageModules).forEach(([path, module]) => {
    if (regex.test(path)) {
      images.push({
        path: path,
        image: (module as { default: string }).default
      });
    }
  });
  
  // Sort images by their number
  const sortedImages = images.sort((a, b) => sortByNumber(a.path, b.path));
  
  // Return just the image URLs
  return sortedImages.map(item => item.image);
}

/**
 * Helper function to get action-specific SVGs from the activity folder
 * @param activityName The name of the activity (e.g., 'tandem-stance')
 * @param actionLabel The label of the action (e.g., 'tandem-stand')
 * @returns Array of image URLs for the activity action
 */
export function getActionImages(activityName: string, actionLabel: string): string[] {
  const images: ImageItem[] = [];
  
  // Pattern 1: activityName-actionLabel.svg or activityName-actionLabel-N.svg
  const regex1 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}-${actionLabel}(-\\d+)?\.svg$`);
  
  // Pattern 2: activityNameN-actionLabel.svg
  const regex2 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}\\d+-${actionLabel}\\.svg$`);
  
  // Pattern 3: activityNameN.svg (general sequence images)
  const regex3 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}\\d+\\.svg$`);
  
  // Sort function to order by number in filename
  const sortByNumber = (a: string, b: string) => {
    // First try to extract specific numbers from the path
    const aMatch = a.match(/(\d+)\.svg$/) || a.match(/(\d+)-/);
    const bMatch = b.match(/(\d+)\.svg$/) || b.match(/(\d+)-/);
    if (aMatch && bMatch) {
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    }
    return a.localeCompare(b);
  };
  
  // Find all matching SVGs for this activity action
  Object.entries(activityImageModules).forEach(([path, module]) => {
    // First prioritize action-specific images
    if (regex1.test(path) || regex2.test(path)) {
      images.push({
        path: path,
        image: (module as { default: string }).default
      });
    } 
    // If no action-specific images are found, include general sequence images
    else if (images.length === 0 && regex3.test(path)) {
      images.push({
        path: path,
        image: (module as { default: string }).default
      });
    }
  });
  
  // If we found no action-specific images, get the general sequence images
  if (images.length === 0) {
    // Re-run search for general sequence images only
    Object.entries(activityImageModules).forEach(([path, module]) => {
      if (regex3.test(path)) {
        images.push({
          path: path,
          image: (module as { default: string }).default
        });
      }
    });
  }
  
  // Sort images by their number
  const sortedImages = images.sort((a, b) => sortByNumber(a.path, b.path));
  
  // Return just the image URLs
  return sortedImages.map(item => item.image);
}

/**
 * Helper function to get action-specific image or fall back to default
 * @param activityName The name of the activity (e.g., 'tandem-stance')
 * @param actionLabel The label of the action (e.g., 'tandem-stand')
 * @returns The image URL or undefined if not found
 */
export function getActionImage(activityName: string, actionLabel: string): string | undefined {
  const actionSpecificImages: ImageItem[] = [];
  
  // Pattern 1 & 3: activityName-actionLabel.svg or activityName-actionLabel-N.svg
  const regex1 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}-${actionLabel}(-\\d+)?\.svg$`);
  
  // Pattern 2: activityNameN-actionLabel.svg
  const regex2 = new RegExp(`/src/assets/activities/${activityName}.*/${activityName}\\d+-${actionLabel}\\.svg$`);
  
  Object.entries(activityImageModules).forEach(([path, module]) => {
    // Try matching first regex
    if (regex1.test(path) || regex2.test(path)) {
      actionSpecificImages.push({
        path: path,
        image: (module as { default: string }).default
      });
    }
  });
  
  // If we found action-specific images, return the first one
  if (actionSpecificImages.length > 0) {
    // Sort and return the first one
    const sortedImages = actionSpecificImages.sort((a, b) => {
      const aMatch = a.path.match(/(\d+)\.svg$/) || a.path.match(/(\d+)-/);
      const bMatch = b.path.match(/(\d+)\.svg$/) || b.path.match(/(\d+)-/);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      return a.path.localeCompare(b.path);
    });
    return sortedImages[0].image;
  }
  
  // If no specific action image is found, fall back to default sequence images
  const defaultImages = getActivityImages(activityName);
  return defaultImages.length > 0 ? defaultImages[0] : undefined;
}

export default function Activities() {
  const [maximizedId, setMaximizedId] = useState<number | null>(null);

  const activitiesData: ActivityData[] = [
    {
      id: 1,
      title: activitiesConfig["quiet-standing"].title,
      staticImage: getActivityImages('quiet-standing')[0] || activitiesIcon,
      hoverImages: [activitiesIcon, lightIcon, activitiesIcon, fileIcon, settingsIcon, wbbIcon],
      description: activitiesConfig["quiet-standing"].description || "Assess stability while standing still with eyes open and closed.",
      boardsRequired: activitiesConfig["quiet-standing"].boardsRequired || 1,
      sequenceImages: getActivityImages('quiet-standing'),
      activityName: 'quiet-standing',
    },
    {
      id: 2,
      title: activitiesConfig["tug"].title,
      staticImage: getActivityImages('tug')[0] || bookIcon,
      hoverImages: [bookIcon, bookmarkIcon, bookIcon],
      description: activitiesConfig["tug"].description || "Measure mobility and balance by timing the 'up and go' sequence.",
      boardsRequired: activitiesConfig["tug"].boardsRequired || 1,
      sequenceImages: getActivityImages('tug'),
      activityName: 'tug',
    },
    {
      id: 3,
      title: activitiesConfig["single-leg-stance"].title,
      staticImage: getActivityImages('single-leg-stance')[0] || wbbIcon,
      hoverImages: [wbbIcon, logoIcon, wbbIcon],
      description: activitiesConfig["single-leg-stance"].description || "Evaluate balance by standing on one leg for a period of time.",
      boardsRequired: activitiesConfig["single-leg-stance"].boardsRequired || 1,
      sequenceImages: getActivityImages('single-leg-stance'),
      activityName: 'single-leg-stance',
    },
    {
      id: 4,
      title: activitiesConfig["tandem-stance"].title,
      staticImage: getActivityImages('tandem-stance')[0] || homeIcon,
      hoverImages: [homeIcon, lightIcon, homeIcon],
      description: activitiesConfig["tandem-stance"].description || "Test balance by standing with one foot directly in front of the other.",
      boardsRequired: activitiesConfig["tandem-stance"].boardsRequired || 1,
      sequenceImages: getActivityImages('tandem-stance'),
      activityName: 'tandem-stance',
    },
    {
      id: 5,
      title: activitiesConfig["functional-reach"].title,
      staticImage: getActivityImages('functional-reach-test')[0] || fileIcon,
      hoverImages: [fileIcon, settingsIcon, fileIcon],
      description: activitiesConfig["functional-reach"].description || "Measure forward reach distance to assess balance and stability limits.",
      boardsRequired: activitiesConfig["functional-reach"].boardsRequired || 1,
      sequenceImages: getActivityImages('functional-reach-test'),
      activityName: 'functional-reach-test',
    },
    {
      id: 6,
      title: activitiesConfig["dynamic-weight-shifting"].title,
      staticImage: getActivityImages('dynamic-weight-shifting')[0] || activitiesIcon,
      hoverImages: [activitiesIcon, sessionIcon, activitiesIcon],
      description: activitiesConfig["dynamic-weight-shifting"].description || "Assess the ability to shift weight effectively while maintaining balance.",
      boardsRequired: activitiesConfig["dynamic-weight-shifting"].boardsRequired || 2,
      sequenceImages: getActivityImages('dynamic-weight-shifting'),
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
