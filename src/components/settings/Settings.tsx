import { useRef, useEffect, useState } from "react";
import "./Settings.css";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsState {
  theme: string;
  showTooltips: boolean;
  deviceAlerts: boolean;
  sessionNotifications: boolean;
  saveLocation: string;
  autoBackup: boolean;
}

function Settings({ isOpen, onClose }: SettingsProps) {
  const settingsRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SettingsState>({
    theme: "light",
    showTooltips: true,
    deviceAlerts: true,
    sessionNotifications: true,
    saveLocation: "C:/Users/Documents/The-Balance-Toolkit",
    autoBackup: true,
  });

  const [tempSettings, setTempSettings] = useState<SettingsState>({
    ...settings,
  });

  useEffect(() => {
    if (isOpen) {
      setTempSettings({ ...settings });
    }
  }, [isOpen, settings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleChange = (field: keyof SettingsState, value: any) => {
    setTempSettings({
      ...tempSettings,
      [field]: value,
    });
  };

  const saveChanges = () => {
    setSettings({ ...tempSettings });

    localStorage.setItem("balanceToolkitSettings", JSON.stringify(tempSettings));

    onClose();
  };

  if (!isOpen) return null;

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
            <h3>Display</h3>
            <div className="setting-item">
              <label>
                <span>Theme</span>
                <select
                  value={tempSettings.theme}
                  onChange={(e) => handleChange("theme", e.target.value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System Default</option>
                </select>
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.showTooltips}
                  onChange={(e) => handleChange("showTooltips", e.target.checked)}
                />
                <span>Show tooltips</span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Notifications</h3>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.deviceAlerts}
                  onChange={(e) => handleChange("deviceAlerts", e.target.checked)}
                />
                <span>Device connection alerts</span>
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.sessionNotifications}
                  onChange={(e) => handleChange("sessionNotifications", e.target.checked)}
                />
                <span>Session completion notifications</span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Data</h3>
            <div className="setting-item">
              <label>
                <span>Default save location</span>
                <div>
                  <span className="location-text">{tempSettings.saveLocation}</span>
                  <button
                    className="browse-btn"
                    onClick={() => {
                      const newLocation = prompt("Enter save location:", tempSettings.saveLocation);
                      if (newLocation) {
                        handleChange("saveLocation", newLocation);
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
                  checked={tempSettings.autoBackup}
                  onChange={(e) => handleChange("autoBackup", e.target.checked)}
                />
                <span>Auto-backup sessions</span>
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
