import { useState } from "react";
import ActivityTimeline from "./ActivityTimeline";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Activity, TimelineBlock } from "@/types.ts";
import { useSaveActivity, useResetActivity } from "@/queries/toolkit";
import { useNavigate } from "react-router-dom";
import { QueryStatus } from "@/components/QueryStatus";
import { useConfirm } from "@/hooks/useConfirm";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { sessionIcon } from "@/assets/icons";

interface ActivityEditProps {
  activity: Activity;
  onClose: () => void;
  existingActionImages: TimelineBlock[];
}

export default function ActivityEdit({ activity, onClose, existingActionImages }: ActivityEditProps) {
  const [timelineBlocks, setTimelineBlocks] = useState(activity.timelineBlocks);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActionName, setNewActionName] = useState("");
  const [newActionDuration, setNewActionDuration] = useState(10);
  const [newActionImage, setNewActionImage] = useState("");
  const [loopCount, setLoopCount] = useState(activity.loops);

  const saveMutation = useSaveActivity();
  const resetMutation = useResetActivity();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const [formError, setFormError] = useState<string | null>(null);
  const busy = saveMutation.isPending || resetMutation.isPending;
  const dirty =
    JSON.stringify(timelineBlocks) !== JSON.stringify(activity.timelineBlocks) ||
    loopCount !== activity.loops ||
    showAddForm;
  const close = async () => {
    if (busy) return;
    if (
      dirty &&
      !(await confirm({
        title: "Unsaved activity",
        message: "Discard your activity edits?",
        confirmText: "Discard",
        cancelText: "Keep editing",
      }))
    )
      return;
    onClose();
  };
  const reset = async () => {
    if (
      dirty &&
      !(await confirm({
        title: "Reset activity",
        message: "Discard your edits and restore the default activity?",
        confirmText: "Reset",
      }))
    )
      return;
    try {
      const activity = await resetMutation.mutateAsync(activityId);
      setTimelineBlocks(activity.timelineBlocks);
      setLoopCount(activity.loops);
      setShowAddForm(false);
    } catch {
      /* Mutation error is shown below. */
    }
  };
  const activityId = activity.id;

  const handleAddAction = () => {
    const title = newActionName.trim() || existingActionImages.find((b) => b.id === newActionImage)?.title || "";
    if (
      !title ||
      !Number.isSafeInteger(newActionDuration) ||
      newActionDuration <= 0 ||
      newActionDuration > 2147483647
    ) {
      setFormError("Enter an action name and a positive duration in whole seconds.");
      return;
    }

    const newBlock: TimelineBlock = {
      id: newActionImage,
      title: title,
      duration: newActionDuration,
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
    if (busy) return;
    if (showAddForm) {
      setFormError("Add or cancel the new action before saving.");
      return;
    }
    const updated: Activity = {
      ...activity,
      loops: loopCount,
      timelineBlocks: timelineBlocks,
    };
    if (
      !Number.isSafeInteger(loopCount) ||
      loopCount < 1 ||
      loopCount > 2147483647 ||
      !timelineBlocks.length ||
      timelineBlocks.some(
        (block) =>
          !Number.isSafeInteger(block.duration) ||
          block.duration <= 0 ||
          block.duration > 2147483647 ||
          !block.title.trim(),
      )
    ) {
      setFormError("Add at least one named action with a positive duration and a whole repeat count of at least 1.");
      return;
    }
    setFormError(null);
    try {
      await saveMutation.mutateAsync(updated);
      navigate("/session");
    } catch {
      /* Keep the draft and display the save error. */
    }
  };

  return (
    <ToolkitContainer className="flex min-h-0 flex-1 flex-col gap-8 p-5">
      <QueryStatus error={formError || saveMutation.error || resetMutation.error} />
      {ConfirmDialog}
      <fieldset disabled={busy} className="contents">
        <div className="h-13 border-b-1 border-(--border) pt-2">
          <h3 className={"text-xl font-bold"}>{activity.title}</h3>
        </div>

        {/* Add Action Row */}
        <div className="flex items-center justify-end gap-4">
          {!showAddForm ? (
            <ToolkitButton type="button" color="blue" onClick={() => setShowAddForm(true)}>
              + Add Action
            </ToolkitButton>
          ) : (
            <>
              <SelectPrimitive
                value={newActionImage}
                placeholder="Action"
                className="w-70"
                aria-label="Action"
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
                  aria-label="Action name"
                  placeholder="Action name"
                  className="w-56"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                />
              )}

              <div className="flex items-center gap-1">
                <InputPrimitive
                  type="number"
                  min={1}
                  aria-label="Action duration in seconds"
                  placeholder="Duration"
                  className="w-20"
                  value={newActionDuration}
                  onChange={(e) => setNewActionDuration(Number(e.target.value))}
                />
                <span className="text-base font-medium whitespace-nowrap">secs</span>
              </div>

              <ToolkitButton
                type="button"
                color="blue"
                onClick={handleAddAction}
                disabled={!newActionName.trim() && !newActionImage.trim()}
              >
                Add
              </ToolkitButton>
              <ToolkitButton type="button" color="grey" onClick={handleCancelAdd}>
                Cancel
              </ToolkitButton>
            </>
          )}
        </div>

        <ActivityTimeline blocks={timelineBlocks} editable onChange={setTimelineBlocks} />

        <div className="flex flex-col items-end gap-3">
          <SingleColumn label="Repeat">
            <InputPrimitive
              type="number"
              min={1}
              placeholder="Loops"
              className="w-20"
              value={loopCount || ""}
              onChange={(e) => setLoopCount(Number(e.target.value))}
            />
          </SingleColumn>

          <div className="flex gap-2">
            <ToolkitButton type="button" onClick={() => void reset()} color="grey">
              Reset to Default
            </ToolkitButton>

            <ToolkitButton type="button" onClick={() => void close()} color="grey">
              Close
            </ToolkitButton>

            <ToolkitButton
              type="button"
              disabled={busy}
              onClick={() => void handleSaveAndGoToSession()}
              color="blue"
              iconUrl={sessionIcon}
            >
              {saveMutation.isPending ? "Saving…" : "Save and go to Session →"}
            </ToolkitButton>
          </div>
        </div>
      </fieldset>
    </ToolkitContainer>
  );
}
