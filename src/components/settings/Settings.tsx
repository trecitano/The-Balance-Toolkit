import React, { ReactNode, useState } from "react";
import "./Settings.css";
import { commands } from "@/utils/requests.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GeneralSettings, InterpolationOption, interpolationOptions, ProcessingSettings } from "@/types.ts";
import { open } from "@tauri-apps/plugin-dialog";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { DEVICES_QUERY_KEY } from "@/pages/devices/Devices.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { Checkbox } from "@/components/Checkbox.tsx";
import { Modal } from "@/components/Modal.tsx";
import { Tooltip } from "@/components/Tooltip.tsx";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const SETTINGS_QUERY_KEY = ["settings"];
export const SettingsQuery = {
  queryKey: SETTINGS_QUERY_KEY,
  queryFn: async () => {
    const loadedSettings = await commands.settings.getSettings();
    return { loadedSettings };
  },
};

interface SettingFieldProps {
  label: string;
  tooltipId: string;
  children: ReactNode;
}

const SettingField: React.FC<SettingFieldProps> = ({ label, tooltipId, children }) => {
  return (
    <div className="setting-item">
      <label>
        <div className={"flex items-center gap-2"}>
          <span className={"text-sm"}>{label}</span>
          <Tooltip tooltipId={tooltipId} />
        </div>
        {children}
      </label>
    </div>
  );
};

function Settings({ isOpen, onClose }: SettingsProps) {
  const { data, isLoading, error } = useQuery(SettingsQuery);
  const { loadedSettings } = data ?? {};
  const queryClient = useQueryClient();

  const [tempSettings, setTempSettings] = useState<GeneralSettings | null>(() => loadedSettings ?? null);

  if (!tempSettings && loadedSettings) {
    setTempSettings(loadedSettings);
  }

  const handleGeneralSettingsUpdate = <K extends keyof GeneralSettings>(field: K, value: GeneralSettings[K]) => {
    setTempSettings((prev) => prev && { ...prev, [field]: value });
  };

  const handleProcessedSettingsUpdate = <K extends keyof ProcessingSettings>(
    field: K,
    value: ProcessingSettings[K],
  ) => {
    setTempSettings(
      (prev) =>
        prev && {
          ...prev,
          processingSettings: {
            ...prev.processingSettings,
            [field]: value,
          },
        },
    );
  };

  const saveChanges = async () => {
    if (tempSettings) {
      await Promise.all([
        commands.settings.setSettings(tempSettings),
        queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY }),
      ]);
      onClose();
    }
  };

  if (!isOpen) return null;
  if (isLoading) return <div className="">Loading settings...</div>;
  if (error) return <div className="">Failed to load settings.</div>;
  if (!tempSettings) return null;

  return (
    <Modal open={isOpen} onClose={onClose} defaultLayout={false}>
      <div className="settings-popup p-2" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>TCP Settings</h3>

            <SettingField label={"TCP Connection String (Raw data)"} tooltipId={"settings_tcp"}>
              <InputPrimitive
                type="text"
                value={tempSettings.tcpConnectionStringRaw}
                onChange={(e) => handleGeneralSettingsUpdate("tcpConnectionStringRaw", e.target.value)}
              />
            </SettingField>
            <SettingField label={"Send Raw Data?"} tooltipId={"settings_raw_data"}>
              <Checkbox
                checked={tempSettings.tcpSendRawData}
                onChange={(e) => handleGeneralSettingsUpdate("tcpSendRawData", e.target.checked)}
              />
            </SettingField>
            <SettingField label={"TCP Connection String (Processed data)"} tooltipId={"settings_tcp"}>
              <InputPrimitive
                type="text"
                value={tempSettings.tcpConnectionStringProcessed}
                onChange={(e) => handleGeneralSettingsUpdate("tcpConnectionStringProcessed", e.target.value)}
              />
            </SettingField>
            <SettingField label={"Send Processed Data?"} tooltipId={"settings_processed_data"}>
              <Checkbox
                checked={tempSettings.tcpSendProcessedData}
                onChange={(e) => handleGeneralSettingsUpdate("tcpSendProcessedData", e.target.checked)}
              />
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>LSL Settings</h3>

            <SettingField label={"LSL Stream Name"} tooltipId={"settings_lsl_stream_name"}>
              <InputPrimitive
                value={tempSettings.lslStreamName}
                onChange={(e) => handleGeneralSettingsUpdate("lslStreamName", e.target.value)}
              />
            </SettingField>
            <SettingField label={"LSL Source ID"} tooltipId={"settings_lsl_source_id"}>
              <InputPrimitive
                type="text"
                value={tempSettings.lslSourceId}
                onChange={(e) => handleGeneralSettingsUpdate("lslSourceId", e.target.value)}
              />
            </SettingField>
            <SettingField label={"Send Raw Data?"} tooltipId={"settings_raw_data"}>
              <Checkbox
                checked={tempSettings.lslSendRawData}
                onChange={(e) => handleGeneralSettingsUpdate("lslSendRawData", e.target.checked)}
              />
            </SettingField>
            <SettingField label={"Send Processed Data?"} tooltipId={"settings_processed_data"}>
              <Checkbox
                checked={tempSettings.lslSendProcessedData}
                onChange={(e) => handleGeneralSettingsUpdate("lslSendProcessedData", e.target.checked)}
              />
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>Save Session Data</h3>

            <SettingField label={"Default save location"} tooltipId={"settings_default_save_location"}>
              <button
                className="browse-btn"
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: "Select save directory",
                  });
                  if (typeof selected === "string") {
                    handleGeneralSettingsUpdate("storeFilesDefaultDirectory", selected);
                  }
                }}
              >
                Browse
              </button>
            </SettingField>
            <SettingField label={"Store Raw Data"} tooltipId={"settings_store_raw_data"}>
              <Checkbox
                checked={tempSettings.storeRawSession}
                onChange={(e) => handleGeneralSettingsUpdate("storeRawSession", e.target.checked)}
              />
            </SettingField>
            <SettingField label={"Store Processed Data"} tooltipId={"settings_store_processed_data"}>
              <Checkbox
                checked={tempSettings.storeProcessedData}
                onChange={(e) => handleGeneralSettingsUpdate("storeProcessedData", e.target.checked)}
              />
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>Session Processing Configuration</h3>

            <SettingField label={"Window size (ms)"} tooltipId={"settings_window_size"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.windowSizeMs}
                onChange={(e) => handleProcessedSettingsUpdate("windowSizeMs", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Window Slide size (ms)"} tooltipId={"settings_slide_size"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.windowSlideMs}
                onChange={(e) => handleProcessedSettingsUpdate("windowSlideMs", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Sampling Rate"} tooltipId={"settings_sampling_rate"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.samplingRate}
                onChange={(e) => handleProcessedSettingsUpdate("samplingRate", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Interpolation Method"} tooltipId={"settings_interpolation_method"}>
              <SelectPrimitive
                className={"min-w-35"}
                value={tempSettings.processingSettings.interpolation}
                onChange={(v) => handleProcessedSettingsUpdate("interpolation", v as InterpolationOption)}
                options={interpolationOptions.map((i) => ({ label: i, value: i }))}
              />
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>Demo Mode</h3>

            <SettingField label={"Enable Demo Mode"} tooltipId={"settings_demo_mode"}>
              <Checkbox
                checked={tempSettings.isDemoMode}
                onChange={(e) => handleGeneralSettingsUpdate("isDemoMode", e.target.checked)}
              />
            </SettingField>
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-save-btn" onClick={saveChanges}>
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default Settings;
