
import React, { useState, useEffect, useRef } from "react";
import { ActivityData } from "./Activities";
import ActivityTimeline from "./ActivityTimeline";
import "./Activities.css";


interface ActivityCardProps {
  activity: ActivityData;
  maximized?: boolean;
  onMaximize?: () => void;
  onMinimize?: () => void;
}


const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  maximized = false,
  onMaximize,
  onMinimize,
}) => {
  
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(activity.staticImage);
  const [isHovering, setIsHovering] = useState(false);
  const [maxStyle, setMaxStyle] = useState<React.CSSProperties | undefined>();
  const [showMaximizedClass, setShowMaximizedClass] = useState(false);
  const [timelineBlocks, setTimelineBlocks] = useState(() => getDefaultBlocks(activity));
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActionName, setNewActionName] = useState("");
  const [newActionDuration, setNewActionDuration] = useState(10);
  const cardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const imageIndexRef = useRef<number>(0);


  
  useEffect(() => {
    setCurrentImageSrc(activity.staticImage);
  }, [activity.staticImage]);


  useEffect(() => {
    if (isHovering && activity.hoverImages && activity.hoverImages.length > 0) {
      let startIndex = 0;
      if (
        activity.hoverImages[0] === activity.staticImage &&
        activity.hoverImages.length > 1
      ) {
        startIndex = 1;
      }
      imageIndexRef.current = startIndex;
      setCurrentImageSrc(activity.hoverImages[imageIndexRef.current]);
      if (activity.hoverImages.length > 1) {
        intervalRef.current = setInterval(() => {
          imageIndexRef.current =
            (imageIndexRef.current + 1) % activity.hoverImages.length;
          setCurrentImageSrc(activity.hoverImages[imageIndexRef.current]);
        }, 700);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!isHovering) {
        setCurrentImageSrc(activity.staticImage);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isHovering, activity.hoverImages, activity.staticImage]);


  
  useEffect(() => {
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
  }, [maximized]);


  
  const handleStartClick = () => {
    if (onMaximize) onMaximize();
  };


  
  function getDefaultBlocks(activity: ActivityData) {
    
    switch (activity.title) {
      case "Quiet standing (eyes-close + eyes-open)":
        return [
          { id: 1, label: "Tare", start: 0, duration: 5 },
          { id: 2, label: "Step onto board", start: 5, duration: 5 },
          { id: 3, label: "Stand - Eyes Open", start: 10, duration: 20 },
          { id: 4, label: "Stand - Eyes Closed", start: 30, duration: 20 },
        ];
      case "Timed Up and Go (TUG)":
        return [
          { id: 1, label: "Tare", start: 0, duration: 5 },
          { id: 2, label: "Step onto board", start: 5, duration: 5 },
          { id: 3, label: "Stand Up", start: 10, duration: 5 },
          { id: 4, label: "Walk Forward", start: 15, duration: 10 },
          { id: 5, label: "Turn Around", start: 25, duration: 5 },
          { id: 6, label: "Walk Back", start: 30, duration: 10 },
          { id: 7, label: "Sit Down", start: 40, duration: 5 },
        ];
      case "Single leg stance":
        return [
          { id: 1, label: "Tare", start: 0, duration: 5 },
          { id: 2, label: "Step onto board", start: 5, duration: 5 },
          { id: 3, label: "Stand on One Leg", start: 10, duration: 20 },
        ];
      case "Tandem stance":
        return [
          { id: 1, label: "Tare", start: 0, duration: 5 },
          { id: 2, label: "Step onto board", start: 5, duration: 5 },
          { id: 3, label: "Tandem Stand", start: 10, duration: 20 },
        ];
      case "Functional Reach Test":
        return [
          { id: 1, label: "Tare", start: 0, duration: 5 },
          { id: 2, label: "Step onto board", start: 5, duration: 5 },
          { id: 3, label: "Reach Forward", start: 10, duration: 10 },
          { id: 4, label: "Return to Start", start: 20, duration: 5 },
        ];
      case "Dynamic weight shifting":
        return [
          { id: 1, label: "Tare", start: 0, duration: 5 },
          { id: 2, label: "Step onto board", start: 5, duration: 5 },
          { id: 3, label: "Shift Weight", start: 10, duration: 20 },
        ];
      default:
        return [
          { id: 1, label: "Tare", start: 0, duration: 5 },
          { id: 2, label: "Step onto board", start: 5, duration: 5 },
          { id: 3, label: "Main Action", start: 10, duration: 20 },
        ];
    }
  }


  
  useEffect(() => {
    setTimelineBlocks(getDefaultBlocks(activity));
  }, [activity]);

  
  const handleAddAction = () => {
    if (!newActionName.trim()) return;
    let lastEnd = 0;
    if (timelineBlocks.length > 0) {
      const last = timelineBlocks[timelineBlocks.length - 1];
      lastEnd = last.start + last.duration;
    }
    const newBlock = {
      id: Date.now(),
      label: newActionName,
      start: lastEnd,
      duration: Math.max(1, Number(newActionDuration) || 10),
    };
    setTimelineBlocks([...timelineBlocks, newBlock]);
    setNewActionName("");
    setNewActionDuration(10);
    setShowAddForm(false);
  };

  
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
        <h3 className="activity-title">{activity.title}</h3>
        {}
        {maximized && (
          <div>
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
                  />
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
            <ActivityTimeline
              blocks={timelineBlocks}
              onChange={setTimelineBlocks}
              onDeleteBlock={blockId => setTimelineBlocks(blocks => blocks.filter(b => b.id !== blockId))}
            />
          </div>
        )}
        <div className="activity-footer">
          {!maximized ? (
            <button className="activity-start-btn" onClick={handleStartClick}>
              Start
            </button>
          ) : (
            <button className="activity-start-btn" onClick={onMinimize}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


export default ActivityCard;
