import React, { useState, useCallback } from "react";
import bluetoothDisconnectedIcon from "@/assets/bluetooth-disconnected-icon.svg";
import DeviceRow from "./DeviceRow";
import { Device } from "@/types";
import { commands } from "@/utils/requests.ts";
import DeviceSessionList from "@/pages/devices/DeviceSessionList.tsx";
import "./Devices.css";
import DeviceScanner from "@/pages/devices/DeviceScanner.tsx";

interface DevicesProps {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
}

export default function Devices({ devices, setDevices }: DevicesProps) {
  const [showIdentifyPopup, setShowIdentifyPopup] = useState(false);
  const [identifyDeviceName, setIdentifyDeviceName] = useState<string | null>(
    null,
  );
  const [isScanning, setIsScanning] = useState(false);

  const handleIdentifyClick = async (macAddress: String) => {
    await commands.devices.identifyDevice(macAddress);
  };

  const handleSaveDeviceName = async (
    macAddress: String,
    deviceName: String,
  ) => {
    await commands.devices.updateDeviceName(macAddress, deviceName);

    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleRemoveDevice = async (macAddress: String) => {
    await commands.devices.removeDevice(macAddress);

    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleDisconnectDevice = async (macAddress: String) => {
    await commands.devices.disconnectDevice(macAddress);

    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleConnectDevice = async (macAddress: String) => {
    await commands.devices.connectDevice(macAddress);

    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleDeviceFound = async () => {
    const devices = await commands.devices.fetchDevices();
    setDevices(devices);
  };

  const handleGradientDevicesScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxFade = 100;

    // Only show top gradient if scrolled down
    const topOpacity = Math.min(scrollTop / maxFade, 1);

    // Only show bottom gradient if not at bottom
    const scrollBottom = scrollHeight - clientHeight - scrollTop;
    const bottomOpacity = Math.min(scrollBottom / maxFade, 1);

    e.currentTarget.style.setProperty("--top-opacity", topOpacity);
    e.currentTarget.style.setProperty("--bottom-opacity", bottomOpacity);
  }, []);

  const handleClosePopup = () => {
    setShowIdentifyPopup(false);
    setIdentifyDeviceName(null);
  };

  const handleScanDevices = async () => {
    setIsScanning(true);
  };

  const handleCancelScan = async () => {
    setIsScanning(false);
  };

  const getSortedDevices = () => {
    if (!Array.isArray(devices)) return [];
    const connected = devices.filter((d) => d.status === "Connected");
    const active = devices.filter((d) => d.status === "Active");
    const disconnected = devices.filter((d) => d.status === "Disconnected");

    connected.sort(
      (a, b) =>
        new Date(a.lastConnected).getTime() -
        new Date(b.lastConnected).getTime(),
    );
    active.sort((a, b) => a.name.localeCompare(b.name));
    disconnected.sort((a, b) => a.name.localeCompare(b.name));

    return [...connected, ...active, ...disconnected];
  };

  const sortedDevices = getSortedDevices();
  const connectedDevices = sortedDevices.filter(
    (d) => d.status === "Connected",
  );
  const noDevices = sortedDevices.length === 0;

  return (
    <div className="inside-page">
      <div className="page-header">
        <span className="page-title">Devices</span>
        <button onClick={handleScanDevices} className="scan-btn">
          {"Scan for Devices"}
        </button>
      </div>

      <div className="main-content">
        <div className="devices-list" onScroll={handleGradientDevicesScroll}>
          {noDevices && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 mt-8 bg-gray-100 rounded-lg shadow-inner">
              <img
                src={bluetoothDisconnectedIcon}
                alt="No devices found"
                className="w-20 h-20 mb-6 opacity-50"
              />
              <p className="text-xl text-gray-600"> No devices found. </p>
              <p className="text-base text-gray-400">
                Click the "Scan for Devices" button to search for nearby
                devices.
              </p>
            </div>
          )}{" "}
          {sortedDevices.map((device) => {
            return (
              <DeviceRow
                key={device.id}
                device={device}
                handleIdentifyClick={handleIdentifyClick}
                handleSaveDeviceName={handleSaveDeviceName}
                handleRemoveDevice={handleRemoveDevice}
                handleDisconnectDevice={handleDisconnectDevice}
                handleConnectDevice={handleConnectDevice}
              />
            );
          })}
        </div>

        <DeviceSessionList
          connectedDevices={connectedDevices}
          handleDisconnectDevice={handleDisconnectDevice}
        />
      </div>

      {/* DeviceScanner component - only renders when scanning */}
      {isScanning && (
        <DeviceScanner
          onDeviceFound={handleDeviceFound}
          handleCancelScan={handleCancelScan}
        />
      )}

      {showIdentifyPopup && (
        <div className="identify-popup-overlay" onClick={handleClosePopup}>
          <div className="identify-popup" onClick={(e) => e.stopPropagation()}>
            <p>
              The LED in <b> {identifyDeviceName} </b> should be blinking
            </p>
            <button className="popup-close-btn" onClick={handleClosePopup}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
