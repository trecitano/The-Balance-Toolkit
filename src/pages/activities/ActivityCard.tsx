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
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(
    activity.staticImage,
  );
  const [isHovering, setIsHovering] = useState(false);
  const [maxStyle, setMaxStyle] = useState<React.CSSProperties | undefined>();
  const [showMaximizedClass, setShowMaximizedClass] = useState(false);
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

  // Animate from original position/size to maximized
  useEffect(() => {
    if (maximized && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const parentRect = cardRef.current.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setShowMaximizedClass(false);

        // Calculate the card's position relative to its parent
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

  // Timeline state for maximized mode
  const initialBlocks = [
    { id: 1, label: "Start", start: 0, duration: 10 },
    { id: 2, label: "Action 1", start: 10, duration: 15 },
    { id: 3, label: "Action 2", start: 25, duration: 20 },
    { id: 4, label: "End", start: 45, duration: 15 },
  ];
  const [timelineBlocks, setTimelineBlocks] = useState(() => initialBlocks);

  return (
    <div
      ref={cardRef}
      className={`activity-card${
        maximized && showMaximizedClass ? " maximized" : ""
      }`}
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
        {/* <p className="activity-description">{activity.description}</p> */}
        {maximized && (
          <div style={{ margin: "24px 0" }}>
            <ActivityTimeline blocks={timelineBlocks} onChange={setTimelineBlocks} />
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
