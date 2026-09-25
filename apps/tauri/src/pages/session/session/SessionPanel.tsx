import { QueryStatus } from "@/components/QueryStatus";
import { open } from "@tauri-apps/plugin-dialog";
import { BaseOption, SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { SessionSettings } from "@/types.ts";
import PageTitle from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import tareIcon from "@/assets/tare.svg";
import { commands } from "@/utils/requests.ts";
import { useAction } from "@/hooks/useAction";
import { ProcessingFields, StreamToggles } from "@/pages/session/ProcessingFields.tsx";
import { useRef } from "react";

// The owner's mutation exposes any rejection, so fire-and-forget controls only need to swallow it.
const fire = (promise: Promise<unknown>) => void promise.catch(() => undefined);

export function SessionPanel({
  boardDisplaySelected,
  onBoardDisplayChange,
  boardDisplayOptions,
  activityOptions,
  userOptions,
  disabled,
  value,
  onChange,
  onDraftChange,
}: {
  boardDisplaySelected: number[];
  onBoardDisplayChange: (ids: number[]) => void;
  boardDisplayOptions: BaseOption<number>[];
  activityOptions: BaseOption[];
  userOptions: BaseOption<number>[];
  disabled: boolean;
  value: SessionSettings | null;
  onDraftChange: (field: string, dirty: boolean) => void;
  onChange: (v: SessionSettings) => Promise<unknown>;
}) {
  const action = useAction();
  // The panel stays interactive while a save is pending, so a second change must merge onto
  // the settings last submitted rather than the stale fetched value, or it would drop the first.
  const submitted = useRef({ base: value, latest: value });
  if (submitted.current.base !== value) submitted.current = { base: value, latest: value };
  const update = <K extends keyof SessionSettings>(key: K, val: SessionSettings[K]) => {
    const current = submitted.current.latest;
    if (!current) return Promise.reject(new Error("The session configuration has not loaded yet."));
    const next = { ...current, [key]: val };
    submitted.current.latest = next;
    return onChange(next);
  };

  const pickDirectory = async () => {
    const selected = await open({ directory: true, multiple: false, title: "Select save directory" });
    if (typeof selected === "string") fire(update("outputDirectory", selected));
  };

  return (
    <>
      <QueryStatus error={action.error} />
      <header>
        <PageTitle>Session</PageTitle>
      </header>

      <ToolkitContainer className="grid grid-cols-40 grid-rows-2 text-xs">
        <SingleColumn label="Board to Display" className="col-span-9">
          <SelectPrimitive
            mode="multi"
            disabled={disabled}
            options={boardDisplayOptions}
            noOptionsMessage="No boards in session."
            value={boardDisplaySelected}
            onChange={onBoardDisplayChange}
            placeholder="Choose a board to display"
          />
        </SingleColumn>

        <SingleColumn label="Tare" className="col-span-2 items-center" labelMargin={false}>
          <button
            type="button"
            aria-label="Tare selected boards"
            disabled={action.isPending}
            onClick={() => action.run(commands.session.tareDevices)}
          >
            <img src={tareIcon} alt="" className="size-7 object-contain opacity-75 hover:opacity-100" />
          </button>
        </SingleColumn>

        <SingleColumn label="User" className="col-span-7" tooltipId="session_user">
          <SelectPrimitive<number>
            disabled={disabled}
            value={value?.selectedUser ?? 0}
            onChange={(v) => fire(update("selectedUser", v))}
            options={userOptions}
          />
        </SingleColumn>

        <ProcessingFields value={value} disabled={disabled} onChange={update} onDraftChange={onDraftChange} />

        <SingleColumn
          label="Activity"
          className="col-span-9"
          disabled={disabled}
          actionText="Clear"
          onActionClick={() => fire(update("activityId", null))}
        >
          <SelectPrimitive
            disabled={disabled}
            value={value?.activityId ?? ""}
            onChange={(v) => fire(update("activityId", v || null))}
            options={activityOptions}
            noneOption="None"
          />
        </SingleColumn>

        <StreamToggles value={value} disabled={disabled} onChange={update} />

        <SingleColumn
          label="Save Location"
          disabled={disabled}
          backgroundType="transparent"
          className="col-start-19 col-end-41"
          actionText="Clear"
          tooltipId="session_save_location"
          onActionClick={() => fire(update("outputDirectory", ""))}
        >
          <div className="flex h-8 items-center gap-2">
            <button
              type="button"
              disabled={disabled || action.isPending}
              className="h-8 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100/80 disabled:text-gray-600"
              onClick={() => action.run(pickDirectory)}
            >
              Choose…
            </button>
            <div
              title={value?.outputDirectory || "No folder selected"}
              className={`min-w-0 flex-1 truncate text-sm ${disabled ? "text-gray-600" : "text-gray-800"}`}
            >
              {value?.outputDirectory || "No folder selected"}
            </div>
          </div>
        </SingleColumn>
      </ToolkitContainer>
    </>
  );
}
