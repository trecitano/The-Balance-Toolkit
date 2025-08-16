import { open } from "@tauri-apps/plugin-dialog";
import { MultiSelect } from "@/components/MultiSelect.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { InterpolationOption, interpolationOptions, SessionConfiguration } from "@/types.ts";

export function SessionPanel({
  boardDisplaySelected,
  onBoardDisplayChange,
  boardDisplayOptions,
  userOptions,
  value,
  onChange,
}: {
  boardDisplaySelected: string[];
  onBoardDisplayChange: (ids: string[]) => void;
  boardDisplayOptions: { value: string; label: string };
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
    <div className="rounded-xl border bg-white/70 p-3 shadow-sm">
      {/* Controls grid */}
      <div className="flex gap-6">
        <h1 className="pb-3 text-xl font-semibold">Session</h1>
        {/* Board to Display (Multi-select) */}

        <div className="w-2/10">
          <SingleColumn label="Board to Display">
            <MultiSelect
              options={boardDisplayOptions}
              noOptionsMessage={"No boards available."}
              value={boardDisplaySelected}
              onChange={onBoardDisplayChange}
              placeholder="Choose a Board to diplay"
            />
          </SingleColumn>

          {/* User (single select) */}
          <SingleColumn label="User">
            <SelectPrimitive
              value={value.selectedUser ?? ""}
              onChange={(v) => update("selectedUser", v ?? "")}
              options={userOptions.map((u) => ({ label: u, value: u }))}
            />
          </SingleColumn>
        </div>

        <div className="w-1/20">
          {/* LSL */}
          <SingleColumn label="LSL" className={"items-center"}>
            <InputPrimitive
              editable
              type="checkbox"
              className={"w-5"}
              checked={value.lsl}
              onChange={(e) => update("lsl", e.target.checked)}
            />
          </SingleColumn>

          {/* TCP */}
          <SingleColumn label="TCP">
            <InputPrimitive
              editable
              type="checkbox"
              className={"w-5"}
              checked={value.tcp}
              onChange={(e) => update("tcp", e.target.checked)}
            />
          </SingleColumn>
        </div>

        <div className={"w-2/10"}>
          <SingleColumn label="Window Size (ms)">
            <InputPrimitive
              editable
              type="number"
              value={value.windowSizeMs}
              onChange={(e) => update("windowSizeMs", Number(e.target.value))}
            />
          </SingleColumn>

          <SingleColumn label="Window Slide size (ms)">
            <InputPrimitive
              editable
              type="number"
              value={value.windowSlideMs}
              onChange={(e) => update("windowSlideMs", Number(e.target.value))}
            />
          </SingleColumn>
        </div>

        <div className={"w-2/10"}>
          <SingleColumn label="Sampling Rate">
            <InputPrimitive
              editable
              type="number"
              value={value.samplingRate}
              onChange={(e) => update("samplingRate", Number(e.target.value))}
            />
          </SingleColumn>

          <SingleColumn label="Window Slide size (ms):">
            <SelectPrimitive
              value={value.interpolation}
              onChange={(v) => update("interpolation", v as InterpolationOption)}
              options={interpolationOptions.map((i) => ({ label: i, value: i }))}
            />
          </SingleColumn>
        </div>

        {/* Save Location */}
        <div className="mr-3 ml-auto">
          <label className="mb-1 block text-xs font-semibold text-gray-700">Save Location</label>
          <div className="flex h-10 items-center gap-2">
            <button
              type="button"
              className="h-10 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm hover:bg-gray-200"
              onClick={pickDirectory}
            >
              Choose…
            </button>
            <div className="min-w-0 flex-1 truncate text-sm text-gray-700">
              {value.outputDirectory ?? "No folder selected"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
