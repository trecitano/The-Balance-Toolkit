import { useRef, useEffect, useState } from "react";
import "./Settings.css";
import {commands} from "@/utils/requests.ts";
import {useQuery} from "@tanstack/react-query";
import {Device, GeneralSettings} from "@/types.ts";

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
  }
};

function Settings({ isOpen, onClose }: SettingsProps) {
  const { data, isLoading, error } = useQuery(SettingsQuery);
  const { loadedSettings } = data ?? {};

  const [tempSettings, setTempSettings] = useState<GeneralSettings | null>(
    () => loadedSettings ?? null
  );

  if (!tempSettings && loadedSettings) {
    setTempSettings(loadedSettings);
  }

  const settingsRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof GeneralSettings, value: any) => {
    setTempSettings((prev) => prev && { ...prev, [field]: value });
  };

  const saveChanges = async () => {
    if (tempSettings) {
      await commands.settings.setSettings(tempSettings);
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
            <h3>Session</h3>

            <div className="setting-item">
              <label>
                <span>TCP Connection String</span>
                <input
                  type="text"
                  value={tempSettings.tcpConnectionString}
                  onChange={(e) =>
                    handleChange("tcpConnectionString", e.target.value)
                  }
                />
              </label>
            </div>

            <div className="setting-item">
              <label>
                <span>LSL Stream Name</span>
                <input
                  type="text"
                  value={tempSettings.lslStreamName}
                  onChange={(e) =>
                    handleChange("lslStreamName", e.target.value)
                  }
                />
              </label>
            </div>

            <div className="setting-item">
              <label>
                <span>LSL Source ID</span>
                <input
                  type="text"
                  value={tempSettings.lslSourceID}
                  onChange={(e) =>
                    handleChange("lslSourceID", e.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Data</h3>

            <div className="setting-item">
              <label>
                <span>Default save location</span>
                <div>
                  <span className="location-text">
                    {tempSettings.defaultSaveLocation}
                  </span>
                  <button
                    className="browse-btn"
                    onClick={() => {
                      const newLocation = prompt(
                        "Enter save location:",
                        tempSettings.defaultSaveLocation
                      );
                      if (newLocation) {
                        handleChange("defaultSaveLocation", newLocation);
                      }
                    }}
                  >
                    Browse...
                  </button>
                </div>
              </label>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.storeRawSession}
                  onChange={(e) =>
                    handleChange("storeRawSession", e.target.checked)
                  }
                />
                <span>Store Raw Data</span>
              </label>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.storeProcessedData}
                  onChange={(e) =>
                    handleChange("storeProcessedData", e.target.checked)
                  }
                />
                <span>Store Processed Data</span>
              </label>
            </div>
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
