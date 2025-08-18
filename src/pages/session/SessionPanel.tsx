import { open } from "@tauri-apps/plugin-dialog";
import { CheckboxOption, MultiSelect } from "@/components/MultiSelect.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { InterpolationOption, interpolationOptions, SessionConfiguration } from "@/types.ts";
import Heading from "@/components/PageTitle.tsx";

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
  value: SessionConfiguration;
  onChange: (v: SessionConfiguration) => void;
}) {
  const update = <K extends keyof SessionConfiguration>(key: K, val: SessionConfiguration[K]) => {
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

      {/* Controls grid */}
      <div className="flex gap-6 rounded-xl bg-white/70 p-3 shadow-sm">
        {/* Board to Display (Multi-select) */}
        <div className="w-2/10">
          <SingleColumn label="Board to Display" backgroundType="transparent">
            <MultiSelect
              options={boardDisplayOptions}
              noOptionsMessage={"No boards in session."}
              value={boardDisplaySelected}
              onChange={onBoardDisplayChange}
              placeholder="Choose a Board to diplay"
            />
          </SingleColumn>

          {/* User (single select) */}
          <SingleColumn label="User" backgroundType="transparent">
            <SelectPrimitive
              value={value.selectedUser ?? ""}
              onChange={(v) => update("selectedUser", v ?? "")}
              options={userOptions.map((u) => ({ label: u, value: u }))}
            />
          </SingleColumn>
        </div>

        <div className="w-1/20">
          {/* LSL */}
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

          {/* TCP */}
          <SingleColumn label="TCP" backgroundType="transparent" direction="row">
            <InputPrimitive
              editable
              type="checkbox"
              className={"w-5"}
              checked={value.tcpEnabled}
              onChange={(e) => update("tcpEnabled", e.target.checked)}
            />
            <span className="font-semibold">{value.tcpEnabled ? "ON" : "OFF"}</span>
          </SingleColumn>
        </div>

        <div className={"w-4/30"}>
          <SingleColumn label="Window Size (ms)" backgroundType="transparent">
            <InputPrimitive
              editable
              type="number"
              value={value.windowSizeMs}
              onChange={(e) => update("windowSizeMs", Number(e.target.value))}
            />
          </SingleColumn>

          <SingleColumn label="Window Slide size (ms)" backgroundType="transparent">
            <InputPrimitive
              editable
              type="number"
              value={value.windowSlideMs}
              onChange={(e) => update("windowSlideMs", Number(e.target.value))}
            />
          </SingleColumn>
        </div>

        <div className={"w-3/20"}>
          <SingleColumn label="Sampling Rate" backgroundType="transparent">
            <InputPrimitive
              editable
              type="number"
              value={value.samplingRate}
              onChange={(e) => update("samplingRate", Number(e.target.value))}
            />
          </SingleColumn>

          <SingleColumn label="Window Slide size (ms)" backgroundType="transparent">
            <SelectPrimitive
              value={value.interpolation}
              onChange={(v) => update("interpolation", v as InterpolationOption)}
              options={interpolationOptions.map((i) => ({ label: i, value: i }))}
            />
          </SingleColumn>
        </div>

        {/* Save Location */}
        <div className="flex-1">
          <SingleColumn label="Save Location" backgroundType="transparent">
            <div className="flex h-10 items-center gap-2">
              <button
                type="button"
                className="h-10 rounded-md border border-gray-300 px-3 text-sm hover:bg-gray-200"
                onClick={pickDirectory}
              >
                Choose…
              </button>
              <div className="min-w-0 flex-1 truncate text-sm text-gray-700">
                {value.outputDirectory ?? "No folder selected"}
              </div>
            </div>
          </SingleColumn>

          <SingleColumn label="Activity" backgroundType="transparent" className="w-1/2">
            <SelectPrimitive
              value={value.activityId}
              onChange={(v) => update("activityId", v)}
              options={activityOptions}
              noneOption="None"
            />
          </SingleColumn>
        </div>
      </div>
    </>
  );
}
