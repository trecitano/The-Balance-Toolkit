import { open } from "@tauri-apps/plugin-dialog";
import { CheckboxOption, MultiSelect } from "@/components/MultiSelect.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import {InterpolationOption, interpolationOptions, ReplayConfiguration, SessionPanelConfiguration} from "@/types.ts";
import Heading from "@/components/PageTitle.tsx";

export function ReplayPanel({
  config,
  boardDisplaySelected,
  onBoardDisplayChange,
  boardDisplayOptions,
  onChange,
  onLoadFile,
}: {
  config: ReplayConfiguration
  boardDisplaySelected: string[];
  onBoardDisplayChange: (ids: string[]) => void;
  boardDisplayOptions: CheckboxOption[];
  onChange: (v: ReplayConfiguration) => void;
  onLoadFile: (path: string) => void;
}) {
  const update = <K extends keyof SessionPanelConfiguration>(key: K, val: SessionPanelConfiguration[K]) => {
    const next: ReplayConfiguration = {
      ...config,
      core: {
        ...config.core,
        [key]: val,
      },
    };

    console.log("Current: ", config.core);
    console.log("Next: ", next.core);
    onChange(next);
  };

  const pickSessionFile = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      filters: [
        {
          name: "Session file",
          extensions: ["settings.json"],
        },
      ],
      title: "Select the Session file",
    });
    if (typeof selected === "string") {
      onLoadFile(selected);
    }
  }

  return (
    <>
      <header className={"mb-6"}>
        <Heading>Replay</Heading>
      </header>

      <div className="grid grid-cols-14 grid-rows-2 gap-1 rounded-xl bg-white/70 p-3 shadow-sm">
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
          <InputPrimitive
            value={config.core.selectedUser ?? "No User"}
          />
        </SingleColumn>

        <SingleColumn label="Window Size (ms)" backgroundType="transparent" className="col-span-2">
          <InputPrimitive
            editable
            type="number"
            value={config.core.windowSizeMs}
            onChange={(e) => update("windowSizeMs", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Window Slide (ms)" backgroundType="transparent" className="col-span-2">
          <InputPrimitive
            editable
            type="number"
            value={config.core.windowSlideMs}
            onChange={(e) => update("windowSlideMs", Number(e.target.value))}
          />
        </SingleColumn>
        <SingleColumn label="Sampling Rate" backgroundType="transparent" className="col-span-2">
          <InputPrimitive
            editable
            type="number"
            value={config.core.samplingRate}
            onChange={(e) => update("samplingRate", Number(e.target.value))}
          />
        </SingleColumn>

        <SingleColumn label="Interpolation" backgroundType="transparent" className="col-span-2">
          <SelectPrimitive
            value={config.core.interpolation}
            onChange={(v) => update("interpolation", v as InterpolationOption)}
            options={interpolationOptions.map((i) => ({ label: i, value: i }))}
          />
        </SingleColumn>

        <SingleColumn label="Activity" backgroundType="transparent" className="col-span-3">
          <InputPrimitive
            value={config.activity?.title ?? "No Activity"}
          />
        </SingleColumn>

        <SingleColumn label="LSL" backgroundType="transparent" direction="row">
          <InputPrimitive
            editable
            type="checkbox"
            className={"w-5"}
            checked={config.core.lslEnabled ?? false}
            onChange={(e) => update("lslEnabled", e.target.checked)}
          />
          <span className="font-semibold">{config.core.lslEnabled ? "ON" : "OFF"}</span>
        </SingleColumn>

        <SingleColumn label="TCP" backgroundType="transparent" direction="row">
          <InputPrimitive
            editable
            type="checkbox"
            className={"w-5"}
            checked={config.core.tcpEnabled}
            onChange={(e) => update("tcpEnabled", e.target.checked)}
          />
          <span className="font-semibold">{config.core.tcpEnabled ? "ON" : "OFF"}</span>
        </SingleColumn>

        <SingleColumn label="Load Session" backgroundType="transparent" className="col-start-7 col-end-15">
          <div className="flex h-10 items-center gap-2">
            <button
              type="button"
              className="h-10 rounded-md border border-gray-300 px-3 text-sm hover:bg-gray-200"
              onClick={pickSessionFile}
            >
              Choose…
            </button>
            <div className="min-w-0 flex-1 truncate text-sm text-gray-700">
              {config.filePath ?? "No folder selected"}
            </div>
          </div>
        </SingleColumn>
      </div>
    </>
  );
}
