import { useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Device } from "@/types";
import { commands } from "@/utils/requests.ts";

interface DeviceScannerProps {
  onDeviceFound: () => void;
  handleCancelScan: () => void;
}

export default function DeviceScanner({
  onDeviceFound,
  handleCancelScan,
}: DeviceScannerProps) {
  const unlistenRef = useRef<(() => void) | null>(null);
  const [foundDevicesCount, setFoundDevicesCount] = useState(0);

  const setupListener = async () => {
    unlistenRef.current = await listen<Device>("new_board", (event) => {
      setFoundDevicesCount(foundDevicesCount + 1);
      console.log("REACT: Received device-discovered event", event.payload);
      onDeviceFound(event.payload);
    });
    await commands.devices.scanDevices();
  };

  setupListener();

  const cancelScan = async () => {
    console.log("clean up!");
    await commands.devices.cancelScanDevices();
    unlistenRef.current?.();
    handleCancelScan();
  };

  return (
    <div className="scan-overlay">
      <div className="scan-overlay-spinner">
        <span className="spinner" />
        <span className="scan-overlay-text">Scanning...</span>

        {foundDevicesCount > 0 && (
          <p className="scan-overlay-count">
            Found {foundDevicesCount} devices so far...
          </p>
        )}

        <button
          className="scan-btn"
          style={{ marginTop: 24, minWidth: 120 }}
          onClick={cancelScan}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
