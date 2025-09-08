import React, { useState, useEffect, useRef } from "react";
import ActivityTimeline from "./ActivityTimeline";
import "./Activities.css";
import wbbIcon from "../../assets/wbb-top-white.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Activity, TimelineBlock } from "@/types.ts";
import { getBlockImage } from "@/utils/activityImages.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { ACTIVITIES_QUERY_KEY } from "@/pages/activities/Activities.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import PageSubtitle from "@/components/PageSubtitle.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";

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
  existingActionImages: TimelineBlock[];
}

export default function ActivityCard({
  activity,
  maximized = false,
  onMaximize,
  onMinimize,
  existingActionImages,
}: ActivityCardProps) {
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActionName, setNewActionName] = useState("");
  const [newActionDuration, setNewActionDuration] = useState(10);
  const [newActionImage, setNewActionImage] = useState("");
  const [loopCount, setLoopCount] = useState(activity.loops ?? 1);

  const cardRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const { mutate: saveMutation } = useMutation({
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
    onSuccess: (resetActivity) => {
      // update cache so UI reflects saved state
      queryClient.setQueryData(
        ACTIVITIES_QUERY_KEY,
        (old: { activities: Activity[] } | undefined): { activities: Activity[] } | undefined => {
          if (!old) return old;
          return {
            activities: old.activities.map((a) => (a.id === resetActivity.id ? resetActivity : a)),
          };
        },
      );
      setTimelineBlocks(resetActivity.timelineBlocks);
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

    setCurrentImageSrc(activity.timelineBlocks[0]?.id ?? "");
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

      animationImages = activity.timelineBlocks.map((b) => b.id);

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
  }, [isHovering, activity.staticImage, activity.id, currentActionLabel, maximized]);

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
        setMaxStyle({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          zIndex: 10,
        });
        setTimeout(() => {
          setMaxStyle({
            top: parentRect.top,
            left: parentRect.left,
            width: parentRect.width,
            height: parentRect.height,
            zIndex: 10,
            transition:
              "top 0.3s cubic-bezier(0.4,0,0.2,1), " +
              "left 0.3s cubic-bezier(0.4,0,0.2,1), " +
              "width 0.3s cubic-bezier(0.4,0,0.2,1), " +
              "height 0.3s cubic-bezier(0.4,0,0.2,1), " +
              "box-shadow var(--transition), " +
              "transform var(--transition)",
          });
        }, 10);
      }
    } else {
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
    const title = newActionName ? newActionName : existingActionImages.find((b) => b.id === newActionImage)?.title!;

    const newBlock = {
      id: newActionImage,
      title: title,
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
    <>
      <ToolkitContainer
        ref={cardRef}
        className={`activity-card flex flex-col gap-3 pt-10 pr-5 pb-5 pl-5`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <>
          <div className="mb-5 flex h-60 justify-center rounded-lg bg-[var(--bg-light)] shadow-(--shadow-light)">
            <img
              className={"object-contain"}
              src={getBlockImage(currentImageSrc)}
              alt={`${activity.title} illustration`}
            />
          </div>
          <div className="">
            {activity.boardsRequired === 1 ? (
              <div className="activity-board-tag">
                <img src={wbbIcon} alt="Balance Board" className="board-icon" />
                <span>
                  1 board
                </span>
              </div>
            ) : (
              <div className="activity-board-tag">
                <img src={wbbIcon} alt="Balance Board" className="board-icon" />
                <img src={wbbIcon} alt="Balance Board" className="board-icon" />
                <span>
                  {activity.boardsRequired} boards
                </span>
              </div>
            )}
            <PageSubtitle>{activity.title}</PageSubtitle>
          </div>
          <div className="mt-auto flex justify-end">
            <ToolkitButton type="button" color={"blue"} onClick={handleStartClick}>
              Start
            </ToolkitButton>
          </div>
        </>
      </ToolkitContainer>

      {maximized && (
        <ToolkitContainer className="absolute flex flex-col gap-10 bg-white p-5" background="bg-white" style={maxStyle}>
          <div className="activity-details-header">
            <h3>{activity.title}</h3>
          </div>
          {/* Add Action Row */}
          <div className="flex min-h-10 items-center justify-end gap-4">
            {!showAddForm ? (
              <ToolkitButton type="button" color={"blue"} onClick={() => setShowAddForm(true)}>
                + Add Action
              </ToolkitButton>
            ) : (
              <>
                <SelectPrimitive
                  value={newActionImage}
                  placeholder="Action"
                  className={"w-70"}
                  options={[
                    { label: "Custom Action", value: "logo-flamingo-blue" },
                    ...existingActionImages.map((action) => ({
                      label: action.title,
                      value: action.id,
                    })),
                  ]}
                  onChange={(e) => setNewActionImage(e ?? "")}
                />
                {newActionImage === "logo-flamingo-blue" && (
                  <InputPrimitive value={newActionName} onChange={(e) => setNewActionName(e.target.value)} />
                )}

                <div>
                  <InputPrimitive
                    type="number"
                    min={1}
                    placeholder="Duration"
                    className={"w-20"}
                    value={newActionDuration}
                    onChange={(e) => setNewActionDuration(Number(e.target.value))}
                  />
                  <span className={"ml-1 text-base font-medium"}>secs</span>
                </div>

                <ToolkitButton
                  type="button"
                  color={"blue"}
                  onClick={handleAddAction}
                  disabled={!newActionName.trim() && !newActionImage.trim()}
                >
                  Add
                </ToolkitButton>
                <ToolkitButton type="button" color={"grey"} onClick={handleCancelAdd}>
                  Cancel
                </ToolkitButton>
              </>
            )}
          </div>

          <ActivityTimeline
            blocks={timelineBlocks}
            editable={true}
            onChange={setTimelineBlocks}
            onBlockSelect={(block) => setCurrentActionLabel(block.title)}
          />

          <div className={"flex flex-col items-end gap-3"}>
            <SingleColumn label={"Loops"}>
              <InputPrimitive
                type="number"
                min={1}
                placeholder="Loops"
                className={"w-20"}
                value={loopCount || 1}
                onChange={(e) => setLoopCount(Number(e.target.value))}
              />
            </SingleColumn>

            <div className="flex gap-2">
              <ToolkitButton
                type="button"
                color={"blue"}
                onClick={() => {
                  const updated: Activity = {
                    ...activity,
                    loops: loopCount,
                    timelineBlocks: timelineBlocks,
                  };
                  saveMutation(updated, {
                    onSuccess: () => onMinimize?.(),
                  });
                }}
              >
                Save
              </ToolkitButton>

              <ToolkitButton type="button" onClick={() => resetMutation.mutate(activity.id)} color={"grey"}>
                Reset to Default
              </ToolkitButton>

              <ToolkitButton type="button" onClick={onMinimize} color={"grey"}>
                Close
              </ToolkitButton>
            </div>
          </div>
          <div className={"mt-auto flex justify-end"}>
            <ToolkitButton to="/session" color="blue" >
              Go to Session →
            </ToolkitButton>
          </div>
        </ToolkitContainer>
      )}
    </>
  );
}
