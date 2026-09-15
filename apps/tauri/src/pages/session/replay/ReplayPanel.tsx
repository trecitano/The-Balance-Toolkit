import { BaseOption, SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { ReplayInformation, SessionSettings } from "@/types.ts";
import PageTitle from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { ProcessingFields, StreamToggles } from "@/pages/session/ProcessingFields.tsx";

export function ReplayPanel({
  config,
  saving,
  boardDisplaySelected,
  onBoardDisplayChange,
  boardDisplayOptions,
  onChange,
  onDraftChange,
  onPickSessionFile,
  onResetFile,
}: {
  config: ReplayInformation | null;
  saving: boolean;
  boardDisplaySelected: number[];
  onBoardDisplayChange: (ids: number[]) => void;
  boardDisplayOptions: BaseOption<number>[];
  onDraftChange: (field: string, dirty: boolean) => void;
  onChange: (v: ReplayInformation) => Promise<unknown>;
  onPickSessionFile: (defaultPath?: string | null) => void;
  onResetFile: () => void;
}) {
  const update = <K extends keyof SessionSettings>(key: K, val: SessionSettings[K]) => {
    if (!config) return Promise.reject(new Error("No replay is loaded."));
    return onChange({ ...config, core: { ...config.core, [key]: val } });
  };

  const disabled = saving || config === null || config.hasOngoingSession;

  return (
    <>
      <header>
        <PageTitle>Replay</PageTitle>
      </header>

      <ToolkitContainer className="grid grid-cols-40 grid-rows-2 text-xs">
        <SingleColumn label="Board to Display" className="col-span-9">
          <SelectPrimitive
            mode="multi"
            options={boardDisplayOptions}
            noOptionsMessage="No boards in session."
            value={boardDisplaySelected}
            onChange={onBoardDisplayChange}
            disabled={disabled}
            placeholder="Choose a board to display"
          />
        </SingleColumn>

        <SingleColumn label="User" className="col-span-9" tooltipId="session_user">
          <InputPrimitive disabled value={config?.user.name ?? "No User"} />
        </SingleColumn>

        <ProcessingFields
          value={config?.core ?? null}
          disabled={disabled}
          onChange={update}
          onDraftChange={onDraftChange}
        />

        <SingleColumn label="Activity" className="col-span-9">
          <InputPrimitive disabled value={config?.activity?.title ?? "No Activity"} />
        </SingleColumn>

        <StreamToggles value={config?.core ?? null} disabled={disabled} onChange={update} />

        <SingleColumn
          label="Load Session"
          backgroundType="transparent"
          className="col-start-19 col-end-41"
          disabled={disabled}
          actionText="Clear"
          tooltipId="replay_load_session"
          onActionClick={onResetFile}
        >
          <div className="flex h-8 items-center gap-2">
            <button
              type="button"
              disabled={saving || (config?.hasOngoingSession ?? false)}
              className="h-8 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100/80 disabled:text-gray-600"
              onClick={() => onPickSessionFile(config?.core?.outputDirectory)}
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
