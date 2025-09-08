import { open } from "@tauri-apps/plugin-dialog";
import { BaseOption, SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { InterpolationOption, interpolationOptions, SessionPanelConfiguration } from "@/types.ts";
import PageTitle from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import {Checkbox} from "@/components/Checkbox.tsx";

export function SessionPanel({
  boardDisplaySelected,
  onBoardDisplayChange,
  boardDisplayOptions,
  activityOptions,
  userOptions,
  disabled,
  value,
  onChange,
}: {
  boardDisplaySelected: number[];
  onBoardDisplayChange: (ids: number[]) => void;
  boardDisplayOptions: BaseOption<number>[];
  activityOptions: BaseOption[];
  userOptions: BaseOption<number>[];
  disabled: boolean;
  value: SessionPanelConfiguration | null;
  onChange: (v: SessionPanelConfiguration) => void;
}) {
  const update = <K extends keyof SessionPanelConfiguration>(key: K, val: SessionPanelConfiguration[K]) => {
    const next = { ...value!, [key]: val };
    onChange(next);
  };

  const pickDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select save directory",
    });
    if (typeof selected === "string") {
      update("outputDirectory", selected);
    }
  };

  return (
    <>
      <header>
        <PageTitle>Session</PageTitle>
      </header>

      <ToolkitContainer className="grid grid-cols-14 grid-rows-2">
        <SingleColumn label="Board to Display" className="col-span-3">
          <SelectPrimitive
            mode={"multi"}
            disabled={disabled}
            options={boardDisplayOptions}
            noOptionsMessage={"No boards in session."}
            value={boardDisplaySelected}
            onChange={onBoardDisplayChange}
            placeholder="Choose a Board to diplay"
          />
        </SingleColumn>

        <SingleColumn label="User" className="col-span-3" tooltipId={"session_user"}>
          <SelectPrimitive<number>
            disabled={disabled}
            value={value?.selectedUser ?? 0}
            onChange={(v) => update("selectedUser", v ?? 0)}
            options={userOptions}
          />
        </SingleColumn>

        <SingleColumn label="Window Size (ms)" className="col-span-2" tooltipId={"session_window_size"}>
          <InputPrimitive
            disabled={disabled}
            type="number"
            value={value?.windowSizeMs}
            onChange={(e) => update("windowSizeMs", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Window Slide (ms)" className="col-span-2" tooltipId={"session_window_slide"}>
          <InputPrimitive
            disabled={disabled}
            type="number"
            value={value?.windowSlideMs}
            onChange={(e) => update("windowSlideMs", Number(e.target.value))}
          />
        </SingleColumn>
        <SingleColumn label="Sampling Rate" className="col-span-2" tooltipId={"session_sampling_rate"}>
          <InputPrimitive
            disabled={disabled}
            type="number"
            value={value?.samplingRate}
            onChange={(e) => update("samplingRate", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Interpolation" className="col-span-2" tooltipId={"session_interpolation"}>
          <SelectPrimitive
            disabled={disabled}
            value={value?.interpolation ?? "Linear"}
            onChange={(v) => update("interpolation", v as InterpolationOption)}
            options={interpolationOptions.map((i) => ({ label: i, value: i }))}
          />
        </SingleColumn>

        <SingleColumn
          label="Activity"
          className="col-span-3"
          actionText="Clear"
          onActionClick={() => update("activityId", "")}
        >
          <SelectPrimitive
            disabled={disabled}
            value={value?.activityId ?? ""}
            onChange={(v) => update("activityId", v)}
            options={activityOptions}
            noneOption="None"
          />
        </SingleColumn>

        <SingleColumn label="LSL" direction="row" tooltipId={"session_lsl_toggle"}>
          <Checkbox
            disabled={disabled}
            className={"ml-2"}
            checked={value?.lslEnabled ?? false}
            onChange={(e) => update("lslEnabled", e.target.checked)}
          />
          <span className={`font-semibold ${disabled ? "opacity-60" : ""}`}>{value?.lslEnabled ? "ON" : "OFF"}</span>
        </SingleColumn>

        <SingleColumn label="TCP" direction="row" tooltipId={"session_tcp_toggle"}>
          <Checkbox
            disabled={disabled}
            className={"ml-2"}
            checked={value?.tcpEnabled ?? false}
            onChange={(e) => update("tcpEnabled", e.target.checked)}
          />
          <span className={`font-semibold ${disabled ? "opacity-60" : ""}`}>{value?.tcpEnabled ? "ON" : "OFF"}</span>
        </SingleColumn>

        <SingleColumn
          label="Save Location"
          backgroundType="transparent"
          className="col-start-7 col-end-15"
          actionText="Clear"
          tooltipId={"session_save_location"}
          onActionClick={() => update("outputDirectory", "")}
        >
          <div className={"flex h-8 items-center gap-2"}>
            <button
              type="button"
              disabled={disabled}
              className="h-8 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100/80 disabled:text-gray-600"
              onClick={pickDirectory}
            >
              Choose…
            </button>
            <div className={`min-w-0 flex-1 truncate text-sm ${disabled ? "text-gray-600" : "text-gray-800"}`}>
              {value?.outputDirectory || "No folder selected"}
            </div>
          </div>
        </SingleColumn>
      </ToolkitContainer>
    </>
  );
}
