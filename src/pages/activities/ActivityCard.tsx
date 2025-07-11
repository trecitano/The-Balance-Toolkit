import React, { useState, useEffect, useRef } from "react";
import { ActivityData } from "./Activities";
import "./Activities.css";

interface ActivityCardProps {
  activity: ActivityData;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(
    activity.staticImage,
  );
  const [isHovering, setIsHovering] = useState(false);
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

  const handleStartClick = () => {
    console.log(`Starting activity: ${activity.title}`);
  };

  return (
    <div
      className="activity-card"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <h3 className="activity-title">{activity.title}</h3>
      <div className="activity-body">
        <div className="activity-image-container">
          <img
            src={currentImageSrc}
            alt={`${activity.title} illustration`}
            className="activity-image"
          />
        </div>
        <div className="activity-details">
          <p className="activity-description">{activity.description}</p>
          <div className="activity-footer">
            <button className="activity-start-btn" onClick={handleStartClick}>
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;
