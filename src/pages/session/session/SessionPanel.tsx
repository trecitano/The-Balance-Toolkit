import { open } from "@tauri-apps/plugin-dialog";
import { CheckboxOption, MultiSelect } from "@/components/MultiSelect.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { InterpolationOption, interpolationOptions, SessionPanelConfiguration } from "@/types.ts";
import Heading from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";

export function SessionPanel({
  boardDisplaySelected,
  onBoardDisplayChange,
  boardDisplayOptions,
  activityOptions,
  userOptions,
  value,
  onChange,
}: {
  boardDisplaySelected: string[];
  onBoardDisplayChange: (ids: string[]) => void;
  boardDisplayOptions: CheckboxOption[];
  activityOptions: CheckboxOption[];
  userOptions: string[];
  value: SessionPanelConfiguration;
  onChange: (v: SessionPanelConfiguration) => void;
}) {
  const update = <K extends keyof SessionPanelConfiguration>(key: K, val: SessionPanelConfiguration[K]) => {
    const next = { ...value, [key]: val };
    console.log("Updating", key, val);
    console.log("next", next);
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
      <header className={"mb-6"}>
        <Heading>Session</Heading>
      </header>

      <ToolkitContainer className="grid grid-cols-14 grid-rows-2 gap-1">
        <SingleColumn label="Board to Display" backgroundType="transparent" className="col-span-3">
          <MultiSelect
            options={boardDisplayOptions}
            noOptionsMessage={"No boards in session."}
            value={boardDisplaySelected}
            onChange={onBoardDisplayChange}
            placeholder="Choose a Board to diplay"
          />
        </SingleColumn>

        <SingleColumn label="User" backgroundType="transparent" className="col-span-3">
          <SelectPrimitive
            value={value.selectedUser ?? ""}
            onChange={(v) => update("selectedUser", v ?? "")}
            options={userOptions.map((u) => ({ label: u, value: u }))}
          />
        </SingleColumn>

        <SingleColumn label="Window Size (ms)" backgroundType="transparent" className="col-span-2">
          <InputPrimitive
            editable
            type="number"
            value={value.windowSizeMs}
            onChange={(e) => update("windowSizeMs", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Window Slide (ms)" backgroundType="transparent" className="col-span-2">
          <InputPrimitive
            editable
            type="number"
            value={value.windowSlideMs}
            onChange={(e) => update("windowSlideMs", Number(e.target.value))}
          />
        </SingleColumn>
        <SingleColumn label="Sampling Rate" backgroundType="transparent" className="col-span-2">
          <InputPrimitive
            editable
            type="number"
            value={value.samplingRate}
            onChange={(e) => update("samplingRate", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Interpolation" backgroundType="transparent" className="col-span-2">
          <SelectPrimitive
            value={value.interpolation}
            onChange={(v) => update("interpolation", v as InterpolationOption)}
            options={interpolationOptions.map((i) => ({ label: i, value: i }))}
          />
        </SingleColumn>

        <SingleColumn label="Activity" backgroundType="transparent" className="col-span-3">
          <SelectPrimitive
            value={value.activityId}
            onChange={(v) => update("activityId", v)}
            options={activityOptions}
            noneOption="None"
          />
        </SingleColumn>

        <SingleColumn label="LSL" backgroundType="transparent" direction="row">
          <InputPrimitive
            editable
            type="checkbox"
            className={"w-5"}
            checked={value.lslEnabled ?? false}
            onChange={(e) => update("lslEnabled", e.target.checked)}
          />
          <span className="font-semibold">{value.lslEnabled ? "ON" : "OFF"}</span>
        </SingleColumn>

        <SingleColumn label="TCP" backgroundType="transparent" direction="row">
          <InputPrimitive
            editable
            type="checkbox"
            className={"w-5"}
            checked={value.tcpEnabled ?? false}
            onChange={(e) => update("tcpEnabled", e.target.checked)}
          />
          <span className="font-semibold">{value.tcpEnabled ? "ON" : "OFF"}</span>
        </SingleColumn>

        <SingleColumn label="Save Location" backgroundType="transparent" className="col-start-7 col-end-15">
          <div className="flex h-10 items-center gap-2">
            <button
              type="button"
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-200"
              onClick={pickDirectory}
            >
              Choose…
            </button>
            <div className="min-w-0 flex-1 truncate text-sm text-gray-700">
              {value.outputDirectory ?? "No folder selected"}
            </div>
          </div>
        </SingleColumn>
      </ToolkitContainer>
    </>
  );
}
