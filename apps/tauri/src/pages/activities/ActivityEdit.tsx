import { useState } from "react";
import TimelineEditor from "./TimelineEditor";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Activity, TimelineBlock } from "@/types.ts";
import { useSaveActivity, useResetActivity } from "@/queries/toolkit";
import { useNavigate } from "react-router-dom";
import { QueryStatus } from "@/components/QueryStatus";
import { useConfirm } from "@/hooks/useConfirm";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { sessionIcon } from "@/assets/icons";
import { formatDuration } from "@/utils/dates.ts";
import { isValidDuration, MAX_WHOLE_NUMBER, MIN_DURATION, roundSeconds } from "@/utils/timeline.ts";

interface ActivityEditProps {
  activity: Activity;
  onClose: () => void;
  existingActionImages: TimelineBlock[];
}

export default function ActivityEdit({ activity, onClose, existingActionImages }: ActivityEditProps) {
  const [timelineBlocks, setTimelineBlocks] = useState(activity.timelineBlocks);
  // Where a new action will go while one is being added; null while the form is closed.
  const [insertAt, setInsertAt] = useState<number | null>(null);
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
    insertAt !== null;
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
      closeAddForm();
    } catch {
      /* Mutation error is shown below. */
    }
  };
  const activityId = activity.id;
  const round = roundSeconds(timelineBlocks);
  // Removing blocks while the form is open can leave the gap past the end, which means the end.
  const insertGap = insertAt === null ? null : Math.min(insertAt, timelineBlocks.length);

  const handleAddAction = () => {
    const title = newActionName.trim() || existingActionImages.find((b) => b.id === newActionImage)?.title || "";
    if (!title || !isValidDuration(newActionDuration)) {
      setFormError("Enter an action name and a positive duration in whole seconds.");
      return;
    }

    const newBlock: TimelineBlock = {
      id: newActionImage,
      title: title,
      duration: newActionDuration,
    };
    const at = insertGap ?? timelineBlocks.length;
    setTimelineBlocks([...timelineBlocks.slice(0, at), newBlock, ...timelineBlocks.slice(at)]);
    closeAddForm();
  };

  // Closing the form, whether the action was added or not, also clears what it reported.
  const closeAddForm = () => {
    setInsertAt(null);
    setNewActionName("");
    setNewActionDuration(10);
    setNewActionImage("");
    setFormError(null);
  };

  const handleSaveAndGoToSession = async () => {
    if (busy) return;
    if (insertAt !== null) {
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
      loopCount > MAX_WHOLE_NUMBER ||
      !timelineBlocks.length ||
      timelineBlocks.some((block) => !isValidDuration(block.duration) || !block.title.trim())
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
    <ToolkitContainer className="flex min-h-0 flex-1 flex-col gap-6 p-5">
      <QueryStatus error={formError || saveMutation.error || resetMutation.error} />
      {ConfirmDialog}
      <fieldset disabled={busy} className="contents">
        {/* The way back sits where people look for it: top left, next to the activity's name.
            Adding an action starts from the same row, on the right. */}
        <div className="flex items-center gap-4 border-b-1 border-(--border) pb-4">
          <ToolkitButton type="button" color="white" size="sm" onClick={() => void close()}>
            ← All activities
          </ToolkitButton>
          <span aria-hidden="true" className="h-6 w-px bg-(--border)" />
          <h3 className={"text-xl font-bold"}>{activity.title}</h3>
          {insertAt === null && (
            <ToolkitButton
              type="button"
              color="blue"
              className="ml-auto"
              onClick={() => setInsertAt(timelineBlocks.length)}
            >
              + Add Action
            </ToolkitButton>
          )}
        </div>

        {/* The form for a new action opens under the header while one is being added; the bar
            marks where it will go. */}
        {insertAt !== null && (
          <div className="flex items-center justify-end gap-4">
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
                min={MIN_DURATION}
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
            <ToolkitButton type="button" color="grey" onClick={closeAddForm}>
              Cancel
            </ToolkitButton>
          </div>
        )}

        <TimelineEditor
          blocks={timelineBlocks}
          onChange={setTimelineBlocks}
          insertAt={insertGap}
          onInsert={setInsertAt}
        />

        {/* Repeat on the left and the actions on the right, in one row under the timeline. */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 text-sm font-medium text-gray-600">
            <label className="flex items-center gap-2">
              Repeat
              <InputPrimitive
                type="number"
                min={1}
                placeholder="Loops"
                className="w-20"
                value={loopCount || ""}
                onChange={(e) => setLoopCount(Number(e.target.value))}
              />
              times
            </label>
            <span aria-hidden="true" className="h-8 w-px bg-(--border)" />
            <dl className="flex items-center gap-6">
              <TimeStat label="Each round" seconds={round} />
              <TimeStat label="In total" seconds={loopCount >= 1 ? round * loopCount : null} highlight />
            </dl>
          </div>

          <div className="flex gap-2">
            <ToolkitButton type="button" onClick={() => void reset()} color="grey">
              Reset to Default
            </ToolkitButton>

            <ToolkitButton type="button" onClick={() => void close()} color="grey">
              Cancel
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

/** A length of time under its label, as in the totals beside Repeat. */
function TimeStat({
  label,
  seconds,
  highlight = false,
}: {
  label: string;
  seconds: number | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.7rem] font-medium tracking-wide text-gray-500 uppercase">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${highlight ? "text-(--primary-dark)" : "text-gray-800"}`}>
        {seconds === null ? "—" : formatDuration(seconds)}
      </dd>
    </div>
  );
}
