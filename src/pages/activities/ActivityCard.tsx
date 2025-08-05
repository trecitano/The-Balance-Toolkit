import React, { useState, useEffect, useRef } from "react";
import { ActivityData } from "./Activities";
import ActivityTimeline from "./ActivityTimeline";
import "./Activities.css";
import wbbIcon from "../../assets/wbb-icon-line.svg";
import { getDefaultBlocksByTitle } from "../../config/activities.config";


/**
 * ActivityCard component displays an activity with its details
 * Supports two modes: compact (in list) and maximized (detailed view)
 */
interface ActivityCardProps {
  activity: ActivityData;
  maximized?: boolean;
  onMaximize?: () => void;
  onMinimize?: () => void;
  index?: number;
}


const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  maximized = false,
  onMaximize,
  onMinimize,
}) => {
  // Image and animation state
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(activity.staticImage);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef<number | null>(null);
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


  
  /**
   * Loads the appropriate image based on the current action label
   * Uses action-specific images when available, otherwise falls back to static image
   */
  useEffect(() => {
    // If we have an active action block selected, try to get its specific image
    if (currentActionLabel && activity.activityName) {
      const actionImage = activity.staticImage;
      if (actionImage) {
        setCurrentImageSrc(actionImage);
        return;
      }
    }
    
    // Otherwise, fall back to sequence images or static image
    if (activity.sequenceImages && activity.sequenceImages.length > 0) {
      setCurrentImageSrc(activity.sequenceImages[0]);
    } else {
      setCurrentImageSrc(activity.staticImage);
    }
  }, [activity.staticImage, activity.sequenceImages, activity.title, activity.activityName, currentActionLabel]);


  /**
   * Handles animation when hovering over the activity card
   * Plays sequence images when hovering and not maximized
   */
  useEffect(() => {
    // Only show animation when hovering AND not in maximized view
    if (isHovering && !maximized) {
      // If we have a current action selected and the activity has a name, get action-specific images
      let animationImages: string[] = [];
      
      if (currentActionLabel && activity.activityName) {
        // This will now include both action-specific and general sequence images
        animationImages = activity.sequenceImages;
      }
      
      // If no action-specific images found or no action selected, fall back to default sequence
      if (animationImages.length === 0) {
        const hasSequence = activity.sequenceImages && activity.sequenceImages.length > 0;
        animationImages = hasSequence && activity.sequenceImages ? 
          activity.sequenceImages : 
          (activity.hoverImages || []);
      }
      
      // Now use the determined images for animation
      if (animationImages && animationImages.length > 0) {
        // Start directly with the second image when hovering (if available)
        let startIndex = animationImages.length > 1 ? 1 : 0;
        imageIndexRef.current = startIndex;
        setCurrentImageSrc(animationImages[imageIndexRef.current]);
        
        if (animationImages.length > 1) {
          // Use a consistent animation speed of 700ms for sequences
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
        if (currentActionLabel && activity.activityName) {
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
  }, [isHovering, activity.hoverImages, activity.sequenceImages, activity.staticImage, activity.activityName, currentActionLabel, maximized]);


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
  function getDefaultBlocks(activity: ActivityData) {
    return getDefaultBlocksByTitle(activity.title);
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
    let lastEnd = 0;
    if (timelineBlocks.length > 0) {
      const last = timelineBlocks[timelineBlocks.length - 1];
      lastEnd = last.start + last.duration;
    }
    const newBlock = {
      id: Date.now(),
      title: newActionName,
      label: newActionName.toLowerCase().replace(/\s+/g, '-'),
      start: lastEnd,
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
    <div
      ref={cardRef}
      className={`activity-card${maximized && showMaximizedClass ? " maximized" : ""}`}
      style={maximized ? maxStyle : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {!maximized && (
        <div className="activity-image-container">
          <img
            src={currentImageSrc}
            alt={`${activity.title} illustration`}
            className="activity-image"
          />
        </div>
      )}
      <div className="activity-details" style={{ marginLeft: 0 }}>
        {/* Board tag above the title */}
        <div className="activity-board-tag" style={{ 
          backgroundColor: activity.boardsRequired > 1 ? 'var(--primary-light, #e0e7ff)' : 'var(--bg-light)',
          position: maximized ? 'absolute' : 'relative',
          top: maximized ? '1vw' : 'auto',
          right: maximized ? '1vw' : 'auto'
        }}>
          <img src={wbbIcon} alt="Balance Board" className="board-icon" />
          <span>{activity.boardsRequired} {activity.boardsRequired === 1 ? 'board' : 'boards'}</span>
        </div>
        {/* Always show the title in the same place, but use header style if maximized */}
        {maximized ? (
          <div className="activity-details-header">
            <h3>{activity.title}</h3>
          </div>
        ) : (
          <h3 className="activity-title">{activity.title}</h3>
        )}
        {maximized && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            {/* Add Action Row */}
            <div className="add-action-row">
              {!showAddForm ? (
                <button
                  className="add-action-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  + Add Action
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Action name"
                    value={newActionName}
                    onChange={e => setNewActionName(e.target.value)}
                    className="add-action-input"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Duration"
                    value={newActionDuration}
                    onChange={e => setNewActionDuration(Number(e.target.value))}
                    className="add-action-input add-action-duration"
                    style={{ width: 50, marginRight: 4 }}
                  />
                  <span style={{ fontSize: "0.9em", color: "var(--primary-dark, #3730a3)", marginRight: 8 }}>s</span>
                  <button
                    className="add-action-btn"
                    onClick={handleAddAction}
                    disabled={!newActionName.trim()}
                  >
                    Add
                  </button>
                  <button
                    className="add-action-btn add-action-cancel"
                    onClick={handleCancelAdd}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <ActivityTimeline
                blocks={timelineBlocks}
                onChange={setTimelineBlocks}
                onBlockSelect={(block) => setCurrentActionLabel(block.label)}
                activityName={activity.activityName}
              />
              {/* Activity settings panel below timeline */}
              <div className="activity-details-panel">
                {/* Activity settings fields below timeline */}
                <div className="activity-details-fields">
                  <div className="activity-details-field">
                    <label htmlFor="activity-loops">Number of loops</label>
                    <input id="activity-loops" type="number" min={1} defaultValue={1} />
                  </div>
                  <div className="activity-details-field">
                    <label htmlFor="activity-sound">Sound</label>
                    <select id="activity-sound" defaultValue="none">
                      <option value="none">None</option>
                      <option value="bell">Bell</option>
                      <option value="voice">Voice</option>
                    </select>
                  </div>
                  <div className="activity-details-field">
                    <label htmlFor="activity-notes">Notes</label>
                    <input id="activity-notes" type="text" placeholder="Optional notes..." />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="activity-footer" style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          {!maximized ? (
            <button className="activity-start-btn" onClick={handleStartClick}>
              Start
            </button>
          ) : (
            <>
              <button
                className="add-action-btn"
                style={{ background: 'var(--primary)', color: 'var(--white)' }}
                onClick={() => {/* Save logic placeholder */}}
              >
                Save
              </button>
              <button
                className="add-action-btn add-action-cancel"
                style={{ background: 'var(--bg-light)', color: 'var(--text-dark)', border: '1px solid var(--border)' }}
                onClick={() => setTimelineBlocks(defaultBlocksRef.current)}
              >
                Reset to Default
              </button>
              <button className="activity-start-btn" onClick={onMinimize} style={{ background: '#e5e7eb', color: '#374151' }}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


export default ActivityCard;
