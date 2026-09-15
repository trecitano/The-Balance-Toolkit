import { useState, useEffect, useRef } from "react";
import "./ActivityCard.css";
import wbbIcon from "../../assets/wbb-top-white.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Activity } from "@/types.ts";
import { getBlockImage } from "@/utils/activityImages.ts";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import PageSubtitle from "@/components/PageSubtitle.tsx";

interface ActivityCardProps {
  activity: Activity;
  onOpen: () => void;
}

export default function ActivityCard({ activity, onOpen }: ActivityCardProps) {
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(activity.staticImage);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageIndexRef = useRef<number>(0);

  useEffect(() => {
    if (isHovering) {
      const animationImages = activity.timelineBlocks.map((b) => b.id);

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentImageSrc(activity.staticImage);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isHovering, activity.staticImage, activity.timelineBlocks]);

  return (
    <ToolkitContainer
      className="activity-card flex grow flex-col gap-3 p-5 pt-10"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <img
        className="min-h-0 rounded-lg bg-(--bg-light) object-contain shadow-(--shadow-light)"
        src={getBlockImage(currentImageSrc)}
        alt={`${activity.title} illustration`}
      />
      <div>
        <div className="mb-1 flex w-fit items-center gap-2 rounded-lg border-1 border-(--border) px-1 py-0.5 text-xs font-semibold shadow-(--shadow-sm)">
          {activity.boardsRequired === 1 ? (
            <>
              <img src={wbbIcon} alt="Balance Board" className="w-8 object-contain" />
              <span>1 board</span>
            </>
          ) : (
            <>
              <img src={wbbIcon} alt="Balance Board" className="w-8 object-contain" />
              <img src={wbbIcon} alt="Balance Board" className="w-8 object-contain" />
              <span>{activity.boardsRequired} boards</span>
            </>
          )}
        </div>
        <PageSubtitle>{activity.title}</PageSubtitle>
      </div>
      <div className="flex justify-end">
        <ToolkitButton type="button" color="blue" onClick={onOpen}>
          Open
        </ToolkitButton>
      </div>
    </ToolkitContainer>
  );
}
