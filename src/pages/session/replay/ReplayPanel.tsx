import { BaseOption, SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { InterpolationOption, interpolationOptions, ReplayConfiguration, SessionPanelConfiguration } from "@/types.ts";
import PageTitle from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import {Checkbox} from "@/components/Checkbox.tsx";

export function ReplayPanel({
  config,
  boardDisplaySelected,
  onBoardDisplayChange,
  boardDisplayOptions,
  onChange,
  onPickSessionFile,
  onResetFile,
}: {
  config: ReplayConfiguration | null;
  boardDisplaySelected: number[];
  onBoardDisplayChange: (ids: number[]) => void;
  boardDisplayOptions: BaseOption<number>[];
  onChange: (v: ReplayConfiguration) => void;
  onPickSessionFile: () => void;
  onResetFile: () => void;
}) {
  const update = <K extends keyof SessionPanelConfiguration>(key: K, val: SessionPanelConfiguration[K]) => {
    const next: ReplayConfiguration = {
      ...config!,
      core: {
        ...config!.core,
        [key]: val,
      },
    };

    onChange(next);
  };

  const disabled = config === null || config.hasOngoingSession;

  return (
    <>
      <header>
        <PageTitle>Replay</PageTitle>
      </header>

      <ToolkitContainer className="grid grid-cols-14 grid-rows-2">
        <SingleColumn label="Board to Display" className="col-span-3">
          <SelectPrimitive
            mode={"multi"}
            options={boardDisplayOptions}
            noOptionsMessage={"No boards in session."}
            value={boardDisplaySelected}
            onChange={onBoardDisplayChange}
            placeholder="Choose a Board to diplay"
          />
        </SingleColumn>

        <SingleColumn label="User" className="col-span-3" tooltipId={"session_user"}>
          <InputPrimitive disabled={true} value={config?.core.selectedUser ?? "No User"} />
        </SingleColumn>

        <SingleColumn label="Window Size (ms)" className="col-span-2" tooltipId={"session_window_size"}>
          <InputPrimitive
            disabled={disabled}
            type="number"
            value={config?.core.windowSizeMs}
            onChange={(e) => update("windowSizeMs", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Window Slide (ms)" className="col-span-2" tooltipId={"session_window_slide"}>
          <InputPrimitive
            disabled={disabled}
            type="number"
            value={config?.core.windowSlideMs}
            onChange={(e) => update("windowSlideMs", Number(e.target.value))}
          />
        </SingleColumn>
        <SingleColumn label="Sampling Rate" className="col-span-2" tooltipId={"session_sampling_rate"}>
          <InputPrimitive
            disabled={disabled}
            type="number"
            value={config?.core.samplingRate}
            onChange={(e) => update("samplingRate", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Interpolation" className="col-span-2" tooltipId={"session_interpolation"}>
          <SelectPrimitive<string>
            disabled={disabled}
            value={config?.core.interpolation ?? "Linear"}
            onChange={(v) => update("interpolation", v as InterpolationOption)}
            options={interpolationOptions.map((i) => ({ label: i, value: i }))}
          />
        </SingleColumn>

        <SingleColumn label="Activity" className="col-span-3">
          <InputPrimitive disabled={true} value={config?.activity?.title ?? "No Activity"} />
        </SingleColumn>

        <SingleColumn label="LSL" direction="row" tooltipId={"session_lsl_toggle"}>
          <Checkbox
            disabled={disabled}
            className={"ml-2"}
            checked={config?.core.lslEnabled ?? false}
            onChange={(e) => update("lslEnabled", e.target.checked)}
          />
          <span className={`font-semibold ${disabled ? "opacity-60" : ""}`}>
            {config?.core.lslEnabled ? "ON" : "OFF"}
          </span>
        </SingleColumn>

        <SingleColumn label="TCP" direction="row" tooltipId={"session_tcp_toggle"}>
          <Checkbox
            disabled={disabled}
            className={"ml-2"}
            checked={config?.core.tcpEnabled ?? false}
            onChange={(e) => update("tcpEnabled", e.target.checked)}
          />
          <span className={`font-semibold ${disabled ? "opacity-60" : ""}`}>
            {config?.core.tcpEnabled ? "ON" : "OFF"}
          </span>
        </SingleColumn>

        <SingleColumn
          label="Load Session"
          backgroundType="transparent"
          className="col-start-7 col-end-15"
          actionText="Clear"
          tooltipId={"replay_load_session"}
          onActionClick={onResetFile}
        >
          <div className="flex h-8 items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              className="h-8 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-200"
              onClick={onPickSessionFile}
            >
              Choose…
            </button>
            <div className={`min-w-0 flex-1 truncate text-sm ${disabled ? "text-gray-600" : "text-gray-800"}`}>
              {config?.filePath || "No file selected"}
            </div>
          </div>
        </SingleColumn>
      </ToolkitContainer>
    </>
  );
}
