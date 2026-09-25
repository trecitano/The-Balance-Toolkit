import { ReactNode, useState, useId, FormEvent } from "react";
import { FieldLabelContext } from "@/components/FieldLabelContext";
import { commands } from "@/utils/requests.ts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GeneralSettings, InterpolationSetting, interpolationOptions, ProcessingSettings } from "@/types.ts";
import { open } from "@tauri-apps/plugin-dialog";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { SettingsQuery, refreshDevices, ReplayQuery, LastSessionQuery } from "@/queries/toolkit";
import { QueryStatus } from "@/components/QueryStatus";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { Checkbox } from "@/components/Checkbox.tsx";
import { Modal } from "@/components/Modal.tsx";
import { Tooltip } from "@/components/Tooltip.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingField({
  label,
  tooltipId,
  detail,
  children,
}: {
  /** A string wraps as needed; pass an array to force one line per entry. */
  label: string | string[];
  tooltipId: string;
  /** Secondary text shown under the label, such as the current value of a picker. */
  detail?: ReactNode;
  children: ReactNode;
}) {
  const labelId = useId();
  const lines = Array.isArray(label) ? label : [label];
  return (
    <FieldLabelContext value={labelId}>
      <div className="mb-3 flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span id={labelId} className="text-sm">
              {lines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </span>
            <Tooltip tooltipId={tooltipId} />
          </div>
          {detail}
        </div>
        {/* Every control shares one fixed column so widths do not follow label length. */}
        <div className="flex w-52 shrink-0 items-center justify-end">{children}</div>
      </div>
    </FieldLabelContext>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 border-b border-gray-200 pb-1.5 text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Settings({ isOpen, onClose }: SettingsProps) {
  const query = useQuery(SettingsQuery);
  if (!isOpen) return null;
  if (query.isPending || !query.data)
    return (
      <Modal open label="Settings" onClose={onClose}>
        <QueryStatus pending={query.isPending} error={query.error} onRetry={() => void query.refetch()} />
      </Modal>
    );
  return <SettingsForm initial={query.data.loadedSettings} onClose={onClose} />;
}

function SettingsForm({ initial, onClose }: { initial: GeneralSettings; onClose: () => void }) {
  const [tempSettings, setTempSettings] = useState(initial);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: commands.settings.setSettings,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(SettingsQuery),
        refreshDevices(queryClient),
        queryClient.invalidateQueries(ReplayQuery),
        queryClient.invalidateQueries(LastSessionQuery),
      ]);
      onClose();
    },
  });
  const updateGeneral = <K extends keyof GeneralSettings>(field: K, value: GeneralSettings[K]) =>
    setTempSettings((prev) => ({ ...prev, [field]: value }));
  const updateProcessing = <K extends keyof ProcessingSettings>(field: K, value: ProcessingSettings[K]) =>
    setTempSettings((prev) => ({ ...prev, processingSettings: { ...prev.processingSettings, [field]: value } }));

  const saveChanges = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!save.isPending) save.mutate(tempSettings);
  };
  const numberField = (field: "windowSizeMs" | "windowSlideMs" | "samplingRate") => (
    <InputPrimitive
      type="number"
      required
      min={1}
      step={1}
      value={tempSettings.processingSettings[field] || ""}
      onChange={(e) => updateProcessing(field, Number(e.target.value))}
    />
  );
  return (
    <Modal
      open
      label="Settings"
      onClose={() => {
        if (!save.isPending) onClose();
      }}
      defaultLayout={false}
      className="flex max-h-[85vh] w-[500px] max-w-[90vw] flex-col rounded-lg bg-white text-left shadow-lg"
    >
      <form className="flex min-h-0 flex-col" onSubmit={saveChanges}>
        <fieldset disabled={save.isPending} className="contents">
          <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-bold">Settings</h2>
            <button
              type="button"
              aria-label="Close settings"
              className="px-2 text-2xl leading-none font-bold text-gray-500 hover:text-gray-800"
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <QueryStatus error={save.error} />
            <SettingsSection title="TCP Settings">
              <SettingField label="TCP Connection String (Raw data)" tooltipId="settings_tcp">
                <InputPrimitive
                  type="text"
                  value={tempSettings.tcpConnectionStringRaw}
                  onChange={(e) => updateGeneral("tcpConnectionStringRaw", e.target.value)}
                />
              </SettingField>
              <SettingField label="Send Raw Data?" tooltipId="settings_raw_data">
                <Checkbox
                  checked={tempSettings.tcpSendRawData}
                  onChange={(e) => updateGeneral("tcpSendRawData", e.target.checked)}
                />
              </SettingField>
              <SettingField label={["TCP Connection String", "(Processed data)"]} tooltipId="settings_tcp">
                <InputPrimitive
                  type="text"
                  value={tempSettings.tcpConnectionStringProcessed}
                  onChange={(e) => updateGeneral("tcpConnectionStringProcessed", e.target.value)}
                />
              </SettingField>
              <SettingField label="Send Processed Data?" tooltipId="settings_processed_data">
                <Checkbox
                  checked={tempSettings.tcpSendProcessedData}
                  onChange={(e) => updateGeneral("tcpSendProcessedData", e.target.checked)}
                />
              </SettingField>
            </SettingsSection>

            <SettingsSection title="LSL Settings">
              <SettingField label="LSL Stream Name" tooltipId="settings_lsl_stream_name">
                <InputPrimitive
                  value={tempSettings.lslStreamName}
                  onChange={(e) => updateGeneral("lslStreamName", e.target.value)}
                />
              </SettingField>
              <SettingField label="LSL Source ID" tooltipId="settings_lsl_source_id">
                <InputPrimitive
                  type="text"
                  value={tempSettings.lslSourceId}
                  onChange={(e) => updateGeneral("lslSourceId", e.target.value)}
                />
              </SettingField>
              <SettingField label="Send Raw Data?" tooltipId="settings_raw_data">
                <Checkbox
                  checked={tempSettings.lslSendRawData}
                  onChange={(e) => updateGeneral("lslSendRawData", e.target.checked)}
                />
              </SettingField>
              <SettingField label="Send Processed Data?" tooltipId="settings_processed_data">
                <Checkbox
                  checked={tempSettings.lslSendProcessedData}
                  onChange={(e) => updateGeneral("lslSendProcessedData", e.target.checked)}
                />
              </SettingField>
            </SettingsSection>

            <SettingsSection title="Save Session Data">
              <SettingField
                label="Default save location"
                tooltipId="settings_default_save_location"
                detail={
                  <div className="truncate text-xs text-gray-500" title={tempSettings.storeFilesDefaultDirectory}>
                    {tempSettings.storeFilesDefaultDirectory || "Not set"}
                  </div>
                }
              >
                <ToolkitButton
                  type="button"
                  color="white"
                  size="sm"
                  onClick={async () => {
                    const selected = await open({ directory: true, multiple: false, title: "Select save directory" });
                    if (typeof selected === "string") updateGeneral("storeFilesDefaultDirectory", selected);
                  }}
                >
                  Browse
                </ToolkitButton>
              </SettingField>
              <SettingField label="Store Raw Data" tooltipId="settings_store_raw_data">
                <Checkbox
                  checked={tempSettings.storeRawSession}
                  onChange={(e) => updateGeneral("storeRawSession", e.target.checked)}
                />
              </SettingField>
              <SettingField label="Store Processed Data" tooltipId="settings_store_processed_data">
                <Checkbox
                  checked={tempSettings.storeProcessedData}
                  onChange={(e) => updateGeneral("storeProcessedData", e.target.checked)}
                />
              </SettingField>
            </SettingsSection>

            <SettingsSection title="Session Processing Configuration">
              <SettingField label="Window size (ms)" tooltipId="settings_window_size">
                {numberField("windowSizeMs")}
              </SettingField>
              <SettingField label="Window Slide size (ms)" tooltipId="settings_slide_size">
                {numberField("windowSlideMs")}
              </SettingField>
              <SettingField label="Sampling Rate" tooltipId="settings_sampling_rate">
                {numberField("samplingRate")}
              </SettingField>
              <SettingField label="Interpolation Method" tooltipId="settings_interpolation_method">
                <SelectPrimitive<InterpolationSetting>
                  className="w-full"
                  value={tempSettings.processingSettings.interpolation}
                  onChange={(v) => updateProcessing("interpolation", v)}
                  options={interpolationOptions.map((i) => ({ label: i, value: i }))}
                />
              </SettingField>
            </SettingsSection>

            <SettingsSection title="Demo Mode">
              <SettingField label="Enable Demo Mode" tooltipId="settings_demo_mode">
                <Checkbox
                  checked={tempSettings.isDemoMode}
                  onChange={(e) => updateGeneral("isDemoMode", e.target.checked)}
                />
              </SettingField>
            </SettingsSection>
          </div>

          <footer className="flex justify-end border-t border-gray-200 px-6 py-4">
            <ToolkitButton type="submit" color="blue">
              {save.isPending ? "Saving…" : "Save changes"}
            </ToolkitButton>
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}

export default Settings;
