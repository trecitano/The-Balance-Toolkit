import React, { useState, useEffect, useRef } from "react";
import ActivityTimeline from "./ActivityTimeline";
import "./Activities.css";
import wbbIcon from "../../assets/wbb-icon-line.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Activity } from "@/types.ts";
import { getBlockImage } from "@/utils/activityImages.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { ACTIVITIES_QUERY_KEY } from "@/pages/activities/Activities.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";

/**
 * ActivityCard component displays an activity with its details
 * Supports two modes: compact (in list) and maximized (detailed view)
 */
interface ActivityCardProps {
  activity: Activity;
  maximized?: boolean;
  onMaximize?: () => void;
  onMinimize?: () => void;
  index?: number;
}

export default function ActivityCard({ activity, maximized = false, onMaximize, onMinimize }: ActivityCardProps) {
  // Image and animation state
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(activity.staticImage);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageIndexRef = useRef<number>(0);

  // Timeline and actions state
  const [currentActionLabel, setCurrentActionLabel] = useState<string | null>(null);
  const [timelineBlocks, setTimelineBlocks] = useState(() => getDefaultBlocks(activity));
  const defaultBlocksRef = useRef(getDefaultBlocks(activity));

  // UI state
  const [maxStyle, setMaxStyle] = useState<React.CSSProperties | undefined>();
  const [showMaximizedClass, setShowMaximizedClass] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActionName, setNewActionName] = useState("");
  const [newActionDuration, setNewActionDuration] = useState(10);
  const cardRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: (updated: Activity) => commands.activity.updateActivity(updated),
    onSuccess: (_, updated) => {
      // update cache so UI reflects saved state
      queryClient.setQueryData(
        ACTIVITIES_QUERY_KEY,
        (old: { activities: Activity[] } | undefined): { activities: Activity[] } | undefined => {
          if (!old) return old;
          return {
            activities: old.activities.map((a) => (a.id === updated.id ? updated : a)),
          };
        },
      );
    },
  });
  const resetMutation = useMutation({
    mutationFn: (activityId: string) => commands.activity.resetActivity(activityId),
    onSuccess: (activity) => {
      // update cache so UI reflects saved state
      queryClient.setQueryData(
        ACTIVITIES_QUERY_KEY,
        (old: { activities: Activity[] } | undefined): { activities: Activity[] } | undefined => {
          if (!old) return old;
          return {
            activities: old.activities.map((a) => (a.id === activity.id ? activity : a)),
          };
        },
      );
    },
  });

  /**
   * Loads the appropriate image based on the current action label
   * Uses action-specific images when available, otherwise falls back to static image
   */
  useEffect(() => {
    if (currentActionLabel && activity.id) {
      const actionImage = activity.staticImage;
      if (actionImage) {
        setCurrentImageSrc(actionImage);
        return;
      }
    }

    setCurrentImageSrc(activity.timelineBlocks[0].id);
  }, [activity.staticImage, activity.title, activity.id, currentActionLabel]);

  /**
   * Handles animation when hovering over the activity card
   * Plays sequence images when hovering and not maximized
   */
  useEffect(() => {
    // Only show animation when hovering AND not in maximized view
    if (isHovering && !maximized) {
      // If we have a current action selected and the activity has a name, get action-specific images
      let animationImages: string[] = [];

      animationImages = activity.timelineBlocks.map(b => b.id);

      // Now use the determined images for animation
      if (animationImages && animationImages.length > 0) {
        imageIndexRef.current = 0;
        setCurrentImageSrc(animationImages[imageIndexRef.current]);

        if (animationImages.length > 1) {
          const animationSpeed = 700;
          intervalRef.current = setInterval(() => {
            imageIndexRef.current = (imageIndexRef.current + 1) % animationImages.length;
            setCurrentImageSrc(animationImages[imageIndexRef.current]);
          }, animationSpeed);
        }
      }
    } else {
      // Stop animation if not hovering or in maximized view
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (!isHovering) {
        // If we have a current action selected, try to get its specific image
        if (currentActionLabel && activity.id) {
          const actionImage = activity.staticImage;
          if (actionImage) {
            setCurrentImageSrc(actionImage);
            return;
          }
        }

        // Otherwise fall back to static image
        setCurrentImageSrc(activity.staticImage);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    isHovering,
    activity.staticImage,
    activity.id,
    currentActionLabel,
    maximized,
  ]);

  /**
   * Handles animation and positioning when the card is maximized
   */
  useEffect(() => {
    // When maximized changes, handle the animation and image
    if (maximized) {
      // Stop any running animation and reset to static image
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentImageSrc(activity.staticImage);
    }

    if (maximized && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const parentRect = cardRef.current.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setShowMaximizedClass(false);

        const initialLeft = rect.left - parentRect.left;
        const initialTop = rect.top - parentRect.top;
        setMaxStyle({
          position: "absolute",
          top: initialTop,
          left: initialLeft,
          width: rect.width,
          height: rect.height,
          zIndex: 10,
        });
        setTimeout(() => {
          setShowMaximizedClass(true);
          setMaxStyle({
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
            transition:
              "top 0.3s cubic-bezier(0.4,0,0.2,1), left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1), height 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow var(--transition), transform var(--transition)",
          });
        }, 10);
      }
    } else {
      setShowMaximizedClass(false);
      setMaxStyle(undefined);
    }
  }, [maximized, activity.staticImage]);

  /**
   * Handler for the start button click
   */
  const handleStartClick = () => {
    if (onMaximize) onMaximize();
  };

  /**
   * Gets the default action blocks for an activity
   */
  function getDefaultBlocks(activity: Activity) {
    return activity.timelineBlocks;
  }

  /**
   * Updates timeline blocks when activity changes
   */
  useEffect(() => {
    const defaults = getDefaultBlocks(activity);
    setTimelineBlocks(defaults);
    defaultBlocksRef.current = defaults;
  }, [activity]);

  /**
   * Adds a new action to the timeline
   */
  const handleAddAction = () => {
    if (!newActionName.trim()) return;
    const newBlock = {
      id: Date.now().toString(),
      title: newActionName,
      duration: Math.max(1, Number(newActionDuration) || 10),
    };
    setTimelineBlocks([...timelineBlocks, newBlock]);
    setNewActionName("");
    setNewActionDuration(10);
    setShowAddForm(false);
  };

  /**
   * Cancels the add action form
   */
  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewActionName("");
    setNewActionDuration(10);
  };

  return (
    <ToolkitContainer
      ref={cardRef}
      className={`activity-card pt-10 pr-5 pb-5 pl-5 ${maximized && showMaximizedClass ? "maximized" : ""}`}
      style={maximized ? maxStyle : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {!maximized ? (
        <>
          <div className="mb-5 flex h-65 justify-center rounded-lg bg-[var(--bg-light)] shadow-(--shadow-light)">
            <img
              className={"object-contain"}
              src={getBlockImage(currentImageSrc)}
              alt={`${activity.title} illustration`}
            />
          </div>
          <div className="flex flex-col">
            {/* Board tag above the title */}
            <div
              className="activity-board-tag"
              style={{
                backgroundColor: activity.boardsRequired > 1 ? "var(--primary-light, #e0e7ff)" : "var(--bg-light)",
                position: maximized ? "absolute" : "relative",
                top: maximized ? "1vw" : "auto",
                right: maximized ? "1vw" : "auto",
              }}
            >
              <img src={wbbIcon} alt="Balance Board" className="board-icon" />
              <span>
              {activity.boardsRequired} {activity.boardsRequired === 1 ? "board" : "boards"}
            </span>
            </div>
            <div>
              <h3 className="activity-title">{activity.title}</h3>
              <ToolkitButton type="button" variant={"blue"} onClick={handleStartClick}>
                Start
              </ToolkitButton>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-10">
          <div className="activity-details-header">
            <h3>{activity.title}</h3>
          </div>
          {/* Add Action Row */}
          <div className="add-action-row">
            {!showAddForm ? (
              <ToolkitButton type="button" variant={"blue"} onClick={() => setShowAddForm(true)}>
                + Add ActionSave
              </ToolkitButton>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Action name"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  className="add-action-input"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Duration"
                  value={newActionDuration}
                  onChange={(e) => setNewActionDuration(Number(e.target.value))}
                  className="add-action-input add-action-duration"
                  style={{ width: 50, marginRight: 4 }}
                />
                <span
                  style={{
                    fontSize: "0.9em",
                    color: "var(--primary-dark, #3730a3)",
                    marginRight: 8,
                  }}
                >
                    s
                  </span>
                <button className="add-action-btn" onClick={handleAddAction} disabled={!newActionName.trim()}>
                  Add
                </button>
                <button className="add-action-btn add-action-cancel" onClick={handleCancelAdd}>
                  Cancel
                </button>
              </>
            )}
          </div>

          <ActivityTimeline
            blocks={timelineBlocks}
            editable={true}
            onChange={setTimelineBlocks}
            onBlockSelect={(block) => setCurrentActionLabel(block.title)}
          />

          <div className="flex justify-end gap-2">
            <ToolkitButton
              type="button"
              variant={"blue"}
              onClick={() => {
                const updated: Activity = {
                  ...activity,
                  timelineBlocks: timelineBlocks,
                };
                saveMutation.mutate(updated, {
                  onSuccess: () => onMinimize?.(),
                });
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </ToolkitButton>

            <ToolkitButton type="button" onClick={() => resetMutation.mutate(activity.id)} variant={"grey"}>
              Reset to Default
            </ToolkitButton>

            <ToolkitButton type="button" onClick={onMinimize} variant={"grey"}>
              Close
            </ToolkitButton>
          </div>
        </div>
      )}
    </ToolkitContainer>
  );
}
