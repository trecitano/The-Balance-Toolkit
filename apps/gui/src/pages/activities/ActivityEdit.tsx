import { useState, useEffect } from "react";
import ActivityTimeline from "./ActivityTimeline";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Activity, TimelineBlock } from "@/types.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { ACTIVITIES_QUERY_KEY } from "@/pages/activities/Activities.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { sessionIcon } from "@/components/navigation/Navigation.tsx";

interface ActivityEditProps {
  activity: Activity;
  open: boolean;
  onClose: () => void;
  existingActionImages: TimelineBlock[];
}

export default function ActivityEdit({
                                       activity,
                                       open,
                                       onClose,
                                       existingActionImages
                                     }: ActivityEditProps) {
  const [timelineBlocks, setTimelineBlocks] = useState(
    activity.timelineBlocks
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActionName, setNewActionName] = useState("");
  const [newActionDuration, setNewActionDuration] = useState(10);
  const [newActionImage, setNewActionImage] = useState("");
  const [loopCount, setLoopCount] = useState(activity.loops ?? 1);

  const queryClient = useQueryClient();

  const { mutate: saveMutation } = useMutation({
    mutationFn: (updated: Activity) =>
      commands.activity.updateActivity(updated),
    onSuccess: (_, updated) => {
      queryClient.setQueryData(
        ACTIVITIES_QUERY_KEY,
        (
          old: { activities: Activity[] } | undefined
        ): { activities: Activity[] } | undefined => {
          if (!old) return old;
          return {
            activities: old.activities.map((a) =>
              a.id === updated.id ? updated : a
            ),
          };
        }
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: (activityId: string) =>
      commands.activity.resetActivity(activityId),
    onSuccess: (resetActivity) => {
      queryClient.setQueryData(
        ACTIVITIES_QUERY_KEY,
        (
          old: { activities: Activity[] } | undefined
        ): { activities: Activity[] } | undefined => {
          if (!old) return old;
          return {
            activities: old.activities.map((a) =>
              a.id === resetActivity.id ? resetActivity : a
            ),
          };
        }
      );
      setTimelineBlocks(resetActivity.timelineBlocks);
    },
  });

  useEffect(() => {
    setTimelineBlocks(activity.timelineBlocks);
    setLoopCount(activity.loops ?? 1);
  }, [activity]);

  const handleAddAction = () => {
    const title = newActionName
      ? newActionName
      : existingActionImages.find((b) => b.id === newActionImage)?.title!;

    const newBlock: TimelineBlock = {
      id: newActionImage,
      title: title,
      duration: Math.max(1, Number(newActionDuration) || 10),
    };
    setTimelineBlocks([...timelineBlocks, newBlock]);
    setNewActionName("");
    setNewActionDuration(10);
    setNewActionImage("");
    setShowAddForm(false);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewActionName("");
    setNewActionDuration(10);
    setNewActionImage("");
  };

  const handleSaveAndGoToSession = async () => {
    const updated: Activity = {
      ...activity,
      loops: loopCount,
      timelineBlocks: timelineBlocks,
    };
    saveMutation(updated);
  };

  if (!open) return null;

  return (
    <ToolkitContainer className="flex flex-1 min-h-0 flex-col gap-8 p-5">
      <div className="border-b-1 border-(--border) pt-2 h-13">
        <h3 className={"text-xl font-bold"}>{activity.title}</h3>
      </div>

      {/* Add Action Row */}
      <div className="flex items-center justify-end gap-4">
        {!showAddForm ? (
          <ToolkitButton
            type="button"
            color="blue"
            onClick={() => setShowAddForm(true)}
          >
            + Add Action
          </ToolkitButton>
        ) : (
          <>
            <SelectPrimitive
              value={newActionImage}
              placeholder="Action"
              className="w-70"
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
              <InputPrimitive
                value={newActionName}
                onChange={(e) => setNewActionName(e.target.value)}
              />
            )}

            <div>
              <InputPrimitive
                type="number"
                min={1}
                placeholder="Duration"
                className="w-20"
                value={newActionDuration}
                onChange={(e) => setNewActionDuration(Number(e.target.value))}
              />
              <span className="ml-1 text-base font-medium">secs</span>
            </div>

            <ToolkitButton
              type="button"
              color="blue"
              onClick={handleAddAction}
              disabled={!newActionName.trim() && !newActionImage.trim()}
            >
              Add
            </ToolkitButton>
            <ToolkitButton
              type="button"
              color="grey"
              onClick={handleCancelAdd}
            >
              Cancel
            </ToolkitButton>
          </>
        )}
      </div>

      <ActivityTimeline
        blocks={timelineBlocks}
        editable={true}
        onChange={setTimelineBlocks}
        onBlockSelect={() => {}}
      />

      <div className="flex flex-col items-end gap-3">
        <SingleColumn label="Repeat">
          <InputPrimitive
            type="number"
            min={1}
            placeholder="Loops"
            className="w-20"
            value={loopCount || 1}
            onChange={(e) => setLoopCount(Number(e.target.value))}
          />
        </SingleColumn>

        <div className="flex gap-2">
          <ToolkitButton
            type="button"
            onClick={() => resetMutation.mutate(activity.id)}
            color="grey"
          >
            Reset to Default
          </ToolkitButton>

          <ToolkitButton type="button" onClick={onClose} color="grey">
            Close
          </ToolkitButton>

          <ToolkitButton
            onClick={handleSaveAndGoToSession}
            to="/session"
            color="blue"
            iconUrl={sessionIcon}
          >
            Save and go to Session →
          </ToolkitButton>
        </div>
      </div>
    </ToolkitContainer>
  );
}