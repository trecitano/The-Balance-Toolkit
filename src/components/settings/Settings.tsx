import React, { ReactNode, useRef, useState } from "react";
import "./Settings.css";
import { commands } from "@/utils/requests.ts";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import { GeneralSettings, ProcessingSettings } from "@/types.ts";
import { open } from "@tauri-apps/plugin-dialog";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import {DEVICES_QUERY_KEY} from "@/pages/devices/Devices.tsx";

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
  children: ReactNode;
}

const SettingField: React.FC<SettingFieldProps> = ({ label, children }) => {
  return (
    <div className="setting-item">
      <label>
        <span className={"text-sm"}>{label}</span>
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

  const settingsRef = useRef<HTMLDivElement>(null);

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
        queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY })
      ]);
      onClose();
    }
  };

  if (!isOpen) return null;
  if (isLoading) return <div className="inside-page">Loading settings...</div>;
  if (error) return <div className="inside-page">Failed to load settings.</div>;
  if (!tempSettings) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-popup" ref={settingsRef}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>TCP Settings</h3>

            <SettingField label={"TCP Connection String"}>
              <InputPrimitive
                type="text"
                value={tempSettings.tcpConnectionString}
                onChange={(e) => handleGeneralSettingsUpdate("tcpConnectionString", e.target.value)}
              />
            </SettingField>
            <SettingField label={"Send Raw Data?"}>
              <InputPrimitive
                type="checkbox"
                checked={tempSettings.tcpSendRawData}
                className={"min-w-4.5"}
                onChange={(e) => handleGeneralSettingsUpdate("tcpSendRawData", e.target.checked)}
              />
            </SettingField>
            <SettingField label={"Send Processed Data?"}>
              <InputPrimitive
                type="checkbox"
                checked={tempSettings.tcpSendProcessedData}
                className={"min-w-4.5"}
                onChange={(e) => handleGeneralSettingsUpdate("tcpSendProcessedData", e.target.checked)}
              />
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>LSL Settings</h3>

            <SettingField label={"LSL Stream Name"}>
              <InputPrimitive
                value={tempSettings.lslStreamName}
                onChange={(e) => handleGeneralSettingsUpdate("lslStreamName", e.target.value)}
              />
            </SettingField>
            <SettingField label={"LSL Source ID"}>
              <InputPrimitive
                type="text"
                value={tempSettings.lslSourceId}
                onChange={(e) => handleGeneralSettingsUpdate("lslSourceId", e.target.value)}
              />
            </SettingField>
            <SettingField label={"Send Raw Data?"}>
              <InputPrimitive
                type="checkbox"
                checked={tempSettings.lslSendRawData}
                className={"min-w-4.5"}
                onChange={(e) => handleGeneralSettingsUpdate("lslSendRawData", e.target.checked)}
              />
            </SettingField>
            <SettingField label={"Send Processed Data?"}>
              <InputPrimitive
                type="checkbox"
                checked={tempSettings.lslSendProcessedData}
                className={"min-w-4.5"}
                onChange={(e) => handleGeneralSettingsUpdate("lslSendProcessedData", e.target.checked)}
              />
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>Save Session Data</h3>

            <SettingField label={"Default save location"}>
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
            <SettingField label={"Store Raw Data"}>
              <InputPrimitive
                type="checkbox"
                checked={tempSettings.storeRawSession}
                className={"min-w-4.5"}
                onChange={(e) => handleGeneralSettingsUpdate("storeRawSession", e.target.checked)}
              />
            </SettingField>
            <SettingField label={"Store Processed Data"}>
              <InputPrimitive
                type="checkbox"
                checked={tempSettings.storeProcessedData}
                className={"min-w-4.5"}
                onChange={(e) => handleGeneralSettingsUpdate("storeProcessedData", e.target.checked)}
              />
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>Session Processing Configuration</h3>

            <SettingField label={"Balance Board X Size (mm)"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.balanceBoardXSize}
                onChange={(e) => handleProcessedSettingsUpdate("balanceBoardXSize", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Balance Board Y Size (mm)"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.balanceBoardYSize}
                onChange={(e) => handleProcessedSettingsUpdate("balanceBoardYSize", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Window size (ms)"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.windowSizeMs}
                onChange={(e) => handleProcessedSettingsUpdate("windowSizeMs", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Window Slide size (ms)"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.windowSlideMs}
                onChange={(e) => handleProcessedSettingsUpdate("windowSlideMs", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Sampling Number"}>
              <InputPrimitive
                type="number"
                value={tempSettings.processingSettings.samplingNumber}
                onChange={(e) => handleProcessedSettingsUpdate("samplingNumber", Number(e.target.value))}
              />
            </SettingField>
            <SettingField label={"Sampling Number"}>
              <select
                value={tempSettings.processingSettings.interpolation}
                onChange={(e) => handleProcessedSettingsUpdate("interpolation", e.target.value)}
              >
                <option value="Linear">Linear</option>
                <option value="Cubic">Cubic</option>
                <option value="Polynomial">Polynomial</option>
              </select>
            </SettingField>
          </div>

          <div className="settings-section">
            <h3>Demo Mode</h3>

            <SettingField label={"Enable Demo Mode"}>
              <InputPrimitive
                type="checkbox"
                checked={tempSettings.isDemoMode}
                className={"min-w-4.5"}
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
    </div>
  );
}

export default Settings;
