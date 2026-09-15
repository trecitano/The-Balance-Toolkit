import { useState, useEffect } from "react";
import "./ActivityCard.css";
import wbbIcon from "@/assets/wbb-top-white.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Activity } from "@/types.ts";
import { getBlockImage } from "@/utils/activityImages.ts";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import PageSubtitle from "@/components/PageSubtitle.tsx";

const FRAME_MS = 700;

interface ActivityCardProps {
  activity: Activity;
  onOpen: () => void;
}

export default function ActivityCard({ activity, onOpen }: ActivityCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [frame, setFrame] = useState(0);
  const frames = activity.timelineBlocks;

  // While hovered, cycle through the activity's blocks; otherwise show the static image.
  useEffect(() => {
    if (!isHovering || frames.length < 2) return;
    const interval = setInterval(() => setFrame((previous) => previous + 1), FRAME_MS);
    return () => clearInterval(interval);
  }, [isHovering, frames.length]);

  const shown = isHovering && frames.length > 0 ? frames[frame % frames.length]?.id : undefined;

  return (
    <ToolkitContainer
      className="activity-card flex grow flex-col gap-3 p-5 pt-10"
      onMouseEnter={() => {
        setFrame(0);
        setIsHovering(true);
      }}
      onMouseLeave={() => setIsHovering(false)}
    >
      <img
        className="min-h-0 rounded-lg bg-(--bg-light) object-contain shadow-(--shadow-light)"
        src={getBlockImage(shown ?? activity.staticImage)}
        alt={`${activity.title} illustration`}
      />
      <div>
        <div className="mb-1 flex w-fit items-center gap-2 rounded-lg border-1 border-(--border) px-1 py-0.5 text-xs font-semibold shadow-(--shadow-sm)">
          {Array.from({ length: Math.min(activity.boardsRequired, 2) }, (_, index) => (
            <img key={index} src={wbbIcon} alt="" className="w-8 object-contain" />
          ))}
          <span>{activity.boardsRequired === 1 ? "1 board" : `${activity.boardsRequired} boards`}</span>
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
