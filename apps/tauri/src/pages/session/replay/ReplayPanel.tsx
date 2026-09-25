import { BaseOption, SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { ReplayInformation, SessionSettings } from "@/types.ts";
import PageTitle from "@/components/PageTitle.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { ProcessingFields, StreamToggles } from "@/pages/session/ProcessingFields.tsx";
import { useRef } from "react";

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
  // The panel stays interactive while a save is pending, so a second change must merge onto
  // the settings last submitted rather than the stale fetched value, or it would drop the first.
  const submitted = useRef({ base: config, latest: config });
  if (submitted.current.base !== config) submitted.current = { base: config, latest: config };
  const update = <K extends keyof SessionSettings>(key: K, val: SessionSettings[K]) => {
    const current = submitted.current.latest;
    if (!current) return Promise.reject(new Error("No replay is loaded."));
    const next = { ...current, core: { ...current.core, [key]: val } };
    submitted.current.latest = next;
    return onChange(next);
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
